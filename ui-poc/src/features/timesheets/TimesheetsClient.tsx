'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, graphqlRequest } from "@/lib/api-client";
import { reportClientTelemetry } from "@/lib/telemetry";
import type {
  ActionPayload,
  TimesheetAction,
  TimesheetEntry,
  TimesheetListMeta,
  TimesheetListResponse,
  TimesheetStatus,
} from "./types";
import { ACTION_LABEL, STATUS_LABEL } from "./types";
import { mockTimesheets } from "./mock-data";
import { CREATE_TIMESHEET_MUTATION, TIMESHEETS_PAGE_QUERY, TIMESHEET_ACTION_MUTATION } from "./queries";

const statusFilters: Array<{ value: "all" | TimesheetStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "submitted", label: STATUS_LABEL.submitted },
  { value: "rejected", label: STATUS_LABEL.rejected },
  { value: "approved", label: STATUS_LABEL.approved },
  { value: "draft", label: STATUS_LABEL.draft },
];

const REASON_CODES = [
  { value: "detail_missing", label: "作業内容が不足" },
  { value: "hours_exceed", label: "工数上限超過" },
  { value: "other", label: "その他" },
];

const dialogRequired: Record<TimesheetAction, boolean> = {
  submit: false,
  approve: false,
  reject: true,
  resubmit: true,
};

type QuerySource = "api" | "mock";

type TimesheetsClientProps = {
  initialTimesheets: TimesheetListResponse;
};

type DialogState = {
  open: boolean;
  action: TimesheetAction;
  entry: TimesheetEntry | null;
  comment: string;
  reasonCode: string;
};

const initialDialog: DialogState = {
  open: false,
  action: "reject",
  entry: null,
  comment: "",
  reasonCode: "",
};

export function TimesheetsClient({ initialTimesheets }: TimesheetsClientProps) {
  const initialMeta: TimesheetListMeta =
    initialTimesheets.meta ?? {
      total: initialTimesheets.items.length,
      returned: initialTimesheets.items.length,
      fetchedAt: new Date().toISOString(),
      fallback: true,
      status: "submitted",
    };
  const [timesheets, setTimesheets] = useState(initialTimesheets.items);
  const [filter, setFilter] = useState<(typeof statusFilters)[number]["value"]>("submitted");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(initialDialog);
  const [meta, setMeta] = useState(initialMeta);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const fetchTokenRef = useRef(0);
  const [creationForm, setCreationForm] = useState({
    userName: "",
    projectCode: "",
    projectName: "",
    workDate: new Date().toISOString().slice(0, 10),
    hours: 7.5,
    note: "",
    status: "submitted" as TimesheetStatus,
  });
  const [creationMessage, setCreationMessage] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [creatingTimesheet, setCreatingTimesheet] = useState(false);

  const source: QuerySource = meta.fallback ? "mock" : "api";

  const filtered = useMemo(() => {
    const keyword = appliedKeyword.trim().toLowerCase();
    return timesheets.filter((entry) => {
      const statusMatch = filter === "all" || entry.approvalStatus === filter;
      if (!statusMatch) return false;
      if (!keyword) return true;
      const haystack = `${entry.projectCode} ${entry.projectName} ${entry.userName} ${entry.note ?? ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [timesheets, filter, appliedKeyword]);

  const closeDialog = () => setDialog(initialDialog);

  const normalizeTimesheet = useCallback(
    (entry: Partial<TimesheetEntry> | null | undefined): TimesheetEntry | null => {
      if (!entry?.id) return null;
      const status = (entry.approvalStatus as TimesheetStatus) ?? "draft";
      return {
        id: entry.id,
      userName: entry.userName ?? "",
      projectCode: entry.projectCode ?? "",
      projectName: entry.projectName ?? entry.projectCode ?? "",
      taskName: entry.taskName ?? undefined,
      workDate: entry.workDate ?? new Date().toISOString().slice(0, 10),
      hours: Number.isFinite(entry.hours) ? Number(entry.hours) : 0,
      approvalStatus: status,
        note: entry.note ?? undefined,
        submittedAt: entry.submittedAt ?? undefined,
      };
    },
    [],
  );

  const updateTimesheetItem = (next: TimesheetEntry) => {
    setTimesheets((prev) =>
      prev.map((item) =>
        item.id === next.id
          ? {
              ...item,
              ...next,
            }
          : item,
      ),
    );
    setMeta((prev) => ({
      ...prev,
      fallback: false,
      fetchedAt: new Date().toISOString(),
    }));
  };

  const fetchTimesheets = useCallback(
    async (statusValue: TimesheetStatus | "all", keywordValue: string) => {
      const trimmedKeyword = keywordValue.trim();
      fetchTokenRef.current += 1;
      const token = fetchTokenRef.current;
      setListLoading(true);
      setListError(null);

      const assignTimesheets = (
        items: TimesheetEntry[],
        fallback: boolean,
        statusMeta: TimesheetStatus | "all",
      ) => {
        if (token !== fetchTokenRef.current) {
          return;
        }
        setTimesheets(items);
        setMeta({
          total: items.length,
          returned: items.length,
          fetchedAt: new Date().toISOString(),
          fallback,
          status: statusMeta,
        });
      };

      const finishLoading = () => {
        if (token === fetchTokenRef.current) {
          setListLoading(false);
        }
      };

      try {
        const gql = await graphqlRequest<{
          timesheets?: Partial<TimesheetEntry>[];
        }>({
          query: TIMESHEETS_PAGE_QUERY,
          variables: {
            status: statusValue,
            keyword: trimmedKeyword.length > 0 ? trimmedKeyword : undefined,
          },
        });

        const items = Array.isArray(gql.timesheets) ? gql.timesheets : [];
        const normalized = items
          .map((entry) => normalizeTimesheet(entry))
          .filter(Boolean) as TimesheetEntry[];
        assignTimesheets(
          normalized,
          false,
          statusValue === "all" ? "all" : (statusValue as TimesheetStatus),
        );
        finishLoading();
        return;
      } catch (error) {
        console.warn("[timesheets] graphql list failed, fallback to REST", error);
        reportClientTelemetry({
          component: "timesheets/client",
          event: "graphql_list_failed",
          level: "warn",
          detail: {
            status: statusValue,
            keyword: trimmedKeyword,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }

      try {
        const params = new URLSearchParams();
        if (statusValue !== "all") {
          params.set("status", statusValue);
        }
        const path = `/api/v1/timesheets${params.toString() ? `?${params.toString()}` : ""}`;
        const rest = await apiRequest<TimesheetListResponse>({ path });
        const items = Array.isArray(rest.items) ? rest.items : [];
        const normalized = items
          .map((entry) => normalizeTimesheet(entry))
          .filter(Boolean) as TimesheetEntry[];
        assignTimesheets(
          normalized,
          rest.meta?.fallback ?? false,
          (rest.meta?.status as TimesheetStatus | "all") ?? statusValue ?? "all",
        );
        reportClientTelemetry({
          component: "timesheets/client",
          event: "rest_list_fallback",
          level: "info",
          detail: {
            status: statusValue,
            keyword: trimmedKeyword,
          },
        });
        finishLoading();
        return;
      } catch (restError) {
        console.error("[timesheets] REST fallback failed, using mock", restError);
        reportClientTelemetry({
          component: "timesheets/client",
          event: "rest_list_failed",
          level: "error",
          detail: {
            status: statusValue,
            keyword: trimmedKeyword,
            error: restError instanceof Error ? restError.message : String(restError),
          },
        });
        setListError("API から取得できなかったためモックデータを表示しています");
        const fallbackItems = (mockTimesheets.items ?? [])
          .map((entry) => normalizeTimesheet(entry))
          .filter(Boolean) as TimesheetEntry[];
        assignTimesheets(fallbackItems, true, "all");
        finishLoading();
      }
    },
    [normalizeTimesheet],
  );

  useEffect(() => {
    void fetchTimesheets(filter, appliedKeyword);
  }, [fetchTimesheets, filter, appliedKeyword]);

  const performAction = async (entry: TimesheetEntry, action: TimesheetAction, payload?: ActionPayload) => {
    setPendingId(entry.id);
    setMessage(null);
    try {
      const gql = await graphqlRequest<{
        timesheetAction: {
          ok: boolean;
          error?: string | null;
          message?: string | null;
          timesheet?: TimesheetEntry;
        };
      }>({
        query: TIMESHEET_ACTION_MUTATION,
        variables: {
          input: {
            timesheetId: entry.id,
            action,
            comment: payload?.comment,
            reasonCode: payload?.reasonCode,
          },
        },
      });
      if (!gql.timesheetAction.ok) {
        throw new Error(gql.timesheetAction.error ?? gql.timesheetAction.message ?? "GraphQL action failed");
      }
      const updated = normalizeTimesheet(gql.timesheetAction.timesheet);
      if (updated) {
        updateTimesheetItem(updated);
      } else {
        updateTimesheetItem({
          ...entry,
          approvalStatus: inferNextStatus(entry.approvalStatus, action),
          note: payload?.comment ?? entry.note,
        });
      }
      setMessage(gql.timesheetAction.message ?? `${entry.userName} / ${entry.projectCode}: ${ACTION_LABEL[action]} 完了`);
      return;
    } catch (error) {
      console.warn("[timesheets] graphql action failed, fallback to REST", error);
      reportClientTelemetry({
        component: "timesheets/client",
        event: "graphql_action_failed",
        level: "warn",
        detail: {
          strategy: "rest",
          timesheetId: entry.id,
          action,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      try {
        await apiRequest({
          path: `/api/v1/timesheets/${entry.id}/${action}`,
          method: "POST",
          body: payload ? JSON.stringify(payload) : undefined,
        });
        updateTimesheetItem({
          ...entry,
          approvalStatus: inferNextStatus(entry.approvalStatus, action),
          note: payload?.comment ?? entry.note,
        });
        setMessage(`${entry.userName} / ${entry.projectCode}: ${ACTION_LABEL[action]} 完了 (REST fallback)`);
        reportClientTelemetry({
          component: "timesheets/client",
          event: "rest_action_succeeded",
          level: "info",
          detail: {
            strategy: "rest",
            timesheetId: entry.id,
            action,
          },
        });
      } catch (restError) {
        console.error("timesheet action failed", restError);
        setMessage(`${ACTION_LABEL[action]} に失敗しました`);
        reportClientTelemetry({
          component: "timesheets/client",
          event: "rest_action_failed",
          level: "error",
          detail: {
            strategy: "rest",
            timesheetId: entry.id,
            action,
            error: restError instanceof Error ? restError.message : String(restError),
          },
        });
      }
    } finally {
      setPendingId(null);
    }
  };

  const handleCreateTimesheet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!creationForm.userName.trim() || !creationForm.projectCode.trim()) {
      setCreationError("メンバー名とプロジェクトコードを入力してください");
      return;
    }
    setCreationError(null);
    setCreationMessage(null);
    setCreatingTimesheet(true);
    const input = {
      userName: creationForm.userName.trim(),
      projectCode: creationForm.projectCode.trim(),
      projectName: creationForm.projectName.trim() || undefined,
      workDate: creationForm.workDate,
      hours: creationForm.hours,
      note: creationForm.note.trim() || undefined,
      autoSubmit: creationForm.status === "submitted",
    };
    try {
      const gql = await graphqlRequest<{
        createTimesheet: {
          ok: boolean;
          error?: string | null;
          message?: string | null;
          timesheet?: TimesheetEntry;
        };
      }>({
        query: CREATE_TIMESHEET_MUTATION,
        variables: { input },
      });
      if (!gql.createTimesheet.ok) {
        throw new Error(gql.createTimesheet.error ?? gql.createTimesheet.message ?? "GraphQL mutation failed");
      }
      const created = normalizeTimesheet(gql.createTimesheet.timesheet);
      if (!created) {
        throw new Error("GraphQL payload missing timesheet");
      }
      const desiredStatus = created.approvalStatus ?? creationForm.status;
      setTimesheets((prev) => [created, ...prev]);
      setMeta((prev) => ({
        ...prev,
        total: prev.total + 1,
        returned: (prev.returned ?? prev.total) + 1,
        fallback: false,
        fetchedAt: new Date().toISOString(),
      }));
      setCreationMessage(gql.createTimesheet.message ?? "タイムシートを追加しました");
      setCreationForm((prev) => ({
        ...prev,
        userName: "",
        projectCode: "",
        projectName: "",
        note: "",
      }));
      const nextFilter =
        desiredStatus !== filter && desiredStatus !== "submitted"
          ? "all"
          : desiredStatus === "submitted"
            ? "submitted"
            : "all";
      setFilter(nextFilter);
      void fetchTimesheets(nextFilter, appliedKeyword);
      return;
    } catch (error) {
      console.warn("[timesheets] graphql create failed, fallback to REST", error);
      reportClientTelemetry({
        component: "timesheets/client",
        event: "graphql_create_failed",
        level: "warn",
        detail: {
          strategy: "rest",
          error: error instanceof Error ? error.message : String(error),
        },
      });
      try {
        const rest = await apiRequest<{ ok: boolean; item: TimesheetEntry }>({
          path: "/api/v1/timesheets",
          method: "POST",
          body: JSON.stringify({
            userName: input.userName,
            projectCode: input.projectCode,
            projectName: input.projectName,
            workDate: input.workDate,
            hours: input.hours,
            note: input.note,
          }),
        });
        if (!rest.ok || !rest.item) {
          throw new Error("REST API response invalid");
        }
        const created = normalizeTimesheet(rest.item);
        if (!created) {
          throw new Error("REST payload missing timesheet");
        }
        const desiredStatus = created.approvalStatus ?? creationForm.status;
        setTimesheets((prev) => [created, ...prev]);
        setMeta((prev) => ({
          ...prev,
          total: prev.total + 1,
          returned: (prev.returned ?? prev.total) + 1,
          fallback: false,
          fetchedAt: new Date().toISOString(),
        }));
        setCreationMessage("REST API でタイムシートを追加しました");
        setCreationForm((prev) => ({
          ...prev,
          userName: "",
          projectCode: "",
          projectName: "",
          note: "",
        }));
        const nextFilter = desiredStatus === "submitted" ? "submitted" : "all";
        setFilter(nextFilter);
        reportClientTelemetry({
          component: "timesheets/client",
          event: "rest_create_succeeded",
          level: "info",
          detail: {
            strategy: "rest",
            timesheetId: created.id,
          },
        });
        void fetchTimesheets(nextFilter, appliedKeyword);
      } catch (restError) {
        setCreationError((restError as Error).message ?? "タイムシート追加に失敗しました");
        reportClientTelemetry({
          component: "timesheets/client",
          event: "rest_create_failed",
          level: "error",
          detail: {
            strategy: "rest",
            error: restError instanceof Error ? restError.message : String(restError),
          },
        });
      }
    } finally {
      setCreatingTimesheet(false);
    }
  };

  const handleAction = (entry: TimesheetEntry, action: TimesheetAction) => {
    if (dialogRequired[action]) {
      setDialog({ open: true, action, entry, comment: entry.note ?? "", reasonCode: "" });
      return;
    }
    void performAction(entry, action);
  };

  const submitDialog = () => {
    if (!dialog.entry) return;
    const payload: ActionPayload = {
      comment: dialog.comment?.trim() ? dialog.comment.trim() : undefined,
      reasonCode: dialog.reasonCode || undefined,
    };
    void performAction(dialog.entry, dialog.action, payload);
    closeDialog();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-inner shadow-slate-950/20">
        <h3 className="text-sm font-semibold text-slate-200">GraphQL: タイムシート追加</h3>
        <p className="mt-1 text-xs text-slate-400">GraphQL ミューテーションで工数申請を投入し、承認フローのデモに利用できます。</p>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={handleCreateTimesheet}>
          <label className="text-xs text-slate-300 md:col-span-1">
            <span className="mb-1 block">メンバー *</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              value={creationForm.userName}
              onChange={(event) => setCreationForm((prev) => ({ ...prev, userName: event.target.value }))}
              required
            />
          </label>
          <label className="text-xs text-slate-300 md:col-span-1">
            <span className="mb-1 block">プロジェクトコード *</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              value={creationForm.projectCode}
              onChange={(event) => setCreationForm((prev) => ({ ...prev, projectCode: event.target.value }))}
              required
            />
          </label>
          <label className="text-xs text-slate-300 md:col-span-1">
            <span className="mb-1 block">プロジェクト名</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              value={creationForm.projectName}
              onChange={(event) => setCreationForm((prev) => ({ ...prev, projectName: event.target.value }))}
            />
          </label>
          <label className="text-xs text-slate-300">
            <span className="mb-1 block">日付</span>
            <input
              type="date"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              value={creationForm.workDate}
              onChange={(event) => setCreationForm((prev) => ({ ...prev, workDate: event.target.value }))}
            />
          </label>
          <label className="text-xs text-slate-300">
            <span className="mb-1 block">工数 (h)</span>
            <input
              type="number"
              step="0.5"
              min="0"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              value={creationForm.hours}
              onChange={(event) => {
                const value = Number(event.target.value);
                setCreationForm((prev) => ({ ...prev, hours: Number.isFinite(value) ? value : 0 }));
              }}
            />
          </label>
          <label className="text-xs text-slate-300">
            <span className="mb-1 block">ステータス</span>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              value={creationForm.status}
              onChange={(event) => setCreationForm((prev) => ({ ...prev, status: event.target.value as TimesheetStatus }))}
            >
              <option value="submitted">submitted</option>
              <option value="draft">draft</option>
            </select>
          </label>
          <label className="text-xs text-slate-300 md:col-span-3">
            <span className="mb-1 block">メモ</span>
            <textarea
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              value={creationForm.note}
              onChange={(event) => setCreationForm((prev) => ({ ...prev, note: event.target.value }))}
              rows={2}
            />
          </label>
          <div className="md:col-span-3 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {creationError ? <span className="text-rose-300">{creationError}</span> : null}
              {creationMessage ? <span className="text-emerald-300">{creationMessage}</span> : null}
            </div>
            <button
              type="submit"
              disabled={creatingTimesheet}
              className="rounded-md border border-sky-500 bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-100 transition-colors hover:border-sky-400 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              {creatingTimesheet ? "送信中..." : "GraphQLで追加"}
            </button>
          </div>
        </form>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {statusFilters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === item.value ? "border-sky-400 bg-sky-500/20 text-sky-100" : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const keyword = searchTerm.trim();
          if (keyword === appliedKeyword) {
            void fetchTimesheets(filter, keyword);
          }
          setAppliedKeyword(keyword);
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          <span>キーワード検索</span>
          <input
            className="w-64 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="プロジェクト・メンバー名など"
            data-testid="timesheets-search-input"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md border border-sky-500 bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-100 transition-colors hover:border-sky-400 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:text-slate-500"
            disabled={listLoading && appliedKeyword === searchTerm.trim()}
          >
            検索
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              if (appliedKeyword !== "") {
                setAppliedKeyword("");
              }
            }}
            className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
            disabled={listLoading && appliedKeyword === "" && searchTerm.trim() === ""}
          >
            クリア
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span>
          表示件数: {filtered.length.toLocaleString()} / {meta.total.toLocaleString()} 件
        </span>
        <span>取得時刻: {formatDateTime(meta.fetchedAt)}</span>
        <span
          className={`rounded-full px-2 py-1 font-medium ${
            source === "api" ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"
          }`}
        >
          {source === "api" ? "API live" : "Mock data"}
        </span>
        {listLoading ? <span className="text-sky-300">読み込み中...</span> : null}
        {listError ? <span className="text-amber-300">{listError}</span> : null}
      </div>

      {message ? <p className="text-xs text-sky-300">{message}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left font-medium">日付</th>
              <th className="px-4 py-3 text-left font-medium">メンバー</th>
              <th className="px-4 py-3 text-left font-medium">プロジェクト</th>
              <th className="px-4 py-3 text-left font-medium">工数</th>
              <th className="px-4 py-3 text-left font-medium">状態</th>
              <th className="px-4 py-3 text-left font-medium">メモ</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-800/40">
                <td className="px-4 py-3 text-slate-200">{entry.workDate}</td>
                <td className="px-4 py-3 text-slate-200">
                  <div className="flex flex-col">
                    <span>{entry.userName}</span>
                    <span className="text-xs text-slate-400">#{entry.id}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  <div className="flex flex-col">
                    <span>{entry.projectName}</span>
                    <span className="text-xs text-slate-400">{entry.projectCode}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  <div className="flex flex-col">
                    <span>{entry.hours.toFixed(1)}h</span>
                    {entry.submittedAt ? (
                      <span className="text-xs text-slate-400">提出: {formatDateTime(entry.submittedAt)}</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <StatusBadge status={entry.approvalStatus} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-300">{entry.note ?? "—"}</td>
                <td className="px-4 py-3 text-right text-xs text-slate-200">
                  <div className="flex flex-wrap justify-end gap-2">
                    {availableActions(entry.approvalStatus).map((action) => (
                      <button
                        key={action}
                        type="button"
                        disabled={pendingId === entry.id}
                        onClick={() => handleAction(entry, action)}
                        className={`rounded-md border px-3 py-1 transition-colors ${
                          pendingId === entry.id
                            ? "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500"
                            : "border-slate-700 bg-slate-800 hover:border-slate-600 hover:text-white"
                        }`}
                      >
                        {ACTION_LABEL[action]}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog.open && dialog.entry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/90 p-6 text-sm text-slate-200 shadow-lg">
            <h3 className="text-lg font-semibold text-white">
              {ACTION_LABEL[dialog.action]} — {dialog.entry.userName}
            </h3>
            <p className="mt-1 text-xs text-slate-400">{dialog.entry.projectName}</p>

            <div className="mt-4 space-y-3">
              <label className="flex flex-col gap-1 text-xs text-slate-300">
                コメント
                <textarea
                  value={dialog.comment}
                  onChange={(event) => setDialog((prev) => ({ ...prev, comment: event.target.value }))}
                  rows={4}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  placeholder="差戻し理由、承認メモなど"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-slate-300">
                理由コード
                <select
                  value={dialog.reasonCode}
                  onChange={(event) => setDialog((prev) => ({ ...prev, reasonCode: event.target.value }))}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  <option value="">未選択</option>
                  {REASON_CODES.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-600 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDialog}
                className="rounded-md border border-sky-600 bg-sky-600 px-3 py-1 text-white hover:bg-sky-500"
              >
                {ACTION_LABEL[dialog.action]}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function availableActions(status: TimesheetStatus): TimesheetAction[] {
  switch (status) {
    case "submitted":
      return ["approve", "reject"];
    case "rejected":
      return ["resubmit"];
    case "approved":
      return [];
    case "draft":
      return ["submit"];
    default:
      return [];
  }
}

function inferNextStatus(status: TimesheetStatus, action: TimesheetAction): TimesheetStatus {
  switch (action) {
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "resubmit":
      return "submitted";
    case "submit":
      return "submitted";
    default:
      return status;
  }
}

function StatusBadge({ status }: { status: TimesheetStatus }) {
  const styles =
    status === "submitted"
      ? "border-sky-500/40 bg-sky-500/20 text-sky-200"
      : status === "approved"
        ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
        : status === "rejected"
          ? "border-rose-500/40 bg-rose-500/20 text-rose-200"
          : "border-slate-500/40 bg-slate-600/20 text-slate-200";

  return <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${styles}`}>{STATUS_LABEL[status]}</span>;
}

function formatDateTime(input?: string) {
  if (!input) return "—";
  try {
    const date = new Date(input);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch (error) {
    console.warn("failed to format date", error);
    return input;
  }
}
