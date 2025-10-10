'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

const STORAGE_KEY = "timesheets-filters-v1";

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

type BulkDialogState = {
  open: boolean;
  action: TimesheetAction;
  comment: string;
  reasonCode: string;
  targetIds: string[];
};

const initialBulkDialog: BulkDialogState = {
  open: false,
  action: "reject",
  comment: "",
  reasonCode: "",
  targetIds: [],
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
  const initialFilter =
    (initialMeta.status && statusFilters.some((item) => item.value === initialMeta.status)
      ? (initialMeta.status as (typeof statusFilters)[number]["value"])
      : "submitted");
  const [filter, setFilter] = useState<(typeof statusFilters)[number]["value"]>(initialFilter);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(initialDialog);
  const [bulkDialog, setBulkDialog] = useState<BulkDialogState>(initialBulkDialog);
  const [meta, setMeta] = useState(initialMeta);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [managerTerm, setManagerTerm] = useState("");
  const [appliedManager, setAppliedManager] = useState("");
  const [projectCodeTerm, setProjectCodeTerm] = useState("");
  const [appliedProjectCode, setAppliedProjectCode] = useState("");
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

  const statusLabel = useMemo(() => {
    if (filter === "all") {
      return "すべて";
    }
    return STATUS_LABEL[filter];
  }, [filter]);

  const keywordSummary = appliedKeyword.trim().length > 0 ? `"${appliedKeyword}"` : "指定なし";
  const managerSummary = appliedManager.trim().length > 0 ? appliedManager : "指定なし";
  const projectCodeSummary = appliedProjectCode.trim().length > 0 ? appliedProjectCode : "指定なし";
  const apiReturned = meta.returned ?? timesheets.length;
  const apiTotal = meta.total ?? timesheets.length;

  const router = useRouter();
  const pathname = usePathname();
  const hydratedRef = useRef(false);
  const lastSyncedQueryRef = useRef<string | null>(null);
  const filterRef = useRef(filter);
  const keywordRef = useRef(appliedKeyword);
  const managerRef = useRef(appliedManager);
  const projectCodeRef = useRef(appliedProjectCode);

  const filtered = useMemo(() => {
    const keyword = appliedKeyword.trim().toLowerCase();

    const manager = appliedManager.trim().toLowerCase();
    const projectCode = appliedProjectCode.trim().toLowerCase();
    return timesheets.filter((entry) => {
      const statusMatch = filter === "all" || entry.approvalStatus === filter;
      if (!statusMatch) return false;
      if (manager && !(entry.userName ?? "").toLowerCase().includes(manager)) {
        return false;
      }
      if (projectCode && (entry.projectCode ?? "").toLowerCase() !== projectCode) {
        return false;
      }
      if (!keyword) return true;
      const haystack = `${entry.projectCode ?? ""} ${entry.projectName ?? ""} ${entry.userName ?? ""} ${entry.note ?? ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [timesheets, filter, appliedKeyword, appliedManager, appliedProjectCode]);

  const selectedEntries = useMemo(() => timesheets.filter((entry) => selectedIds.includes(entry.id)), [timesheets, selectedIds]);
  const bulkTargets = useMemo(
    () => timesheets.filter((entry) => bulkDialog.targetIds.includes(entry.id)),
    [timesheets, bulkDialog.targetIds],
  );

  const toggleSelection = useCallback((timesheetId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(timesheetId)) {
        return prev.filter((id) => id !== timesheetId);
      }
      return [...prev, timesheetId];
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (filtered.length === 0) {
      setSelectedIds([]);
      return;
    }
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((entry) => entry.id));
    }
  }, [filtered, selectedIds]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => timesheets.some((entry) => entry.id === id)));
  }, [timesheets]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    const isIndeterminate = selectedIds.length > 0 && selectedIds.length < filtered.length;
    selectAllRef.current.indeterminate = isIndeterminate;
  }, [selectedIds, filtered.length]);

  const closeDialog = () => setDialog(initialDialog);
  const closeBulkDialog = () => setBulkDialog(initialBulkDialog);

  const buildBulkActionPayload = useCallback(
    (action: TimesheetAction, comment: string, reasonCode: string): ActionPayload | undefined => {
      const trimmedComment = comment.trim();
      const trimmedReason = reasonCode.trim();
      if (!trimmedComment && !(action === "reject" && trimmedReason)) {
        return undefined;
      }
      return {
        comment: trimmedComment || undefined,
        reasonCode: action === "reject" ? (trimmedReason || undefined) : undefined,
      };
    },
    [],
  );

  const submitBulkDialog = () => {
    if (bulkTargets.length === 0) {
      closeBulkDialog();
      return;
    }
    const payload = buildBulkActionPayload(
      bulkDialog.action,
      bulkDialog.comment,
      bulkDialog.reasonCode,
    );
    void executeBulkAction(bulkDialog.action, bulkTargets, payload);
    closeBulkDialog();
  };

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

  const updateTimesheetItem = useCallback((next: TimesheetEntry) => {
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
  }, []);

  const fetchTimesheets = useCallback(
    async (
      statusValue: TimesheetStatus | "all",
      keywordValue: string,
      options: { manager?: string; projectCode?: string } = {},
    ) => {
      const trimmedKeyword = keywordValue.trim();
      const keywordLower = trimmedKeyword.toLowerCase();
      const managerRaw = options.manager?.trim() ?? "";
      const managerValue = managerRaw.toLowerCase();
      const projectCodeRaw = options.projectCode?.trim() ?? "";
      const projectCodeValue = projectCodeRaw.toLowerCase();
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
            userName: managerRaw.length > 0 ? managerRaw : undefined,
            projectCode: projectCodeRaw.length > 0 ? projectCodeRaw : undefined,
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
        reportClientTelemetry({
          component: "timesheets/client",
          event: "list_fetch_succeeded",
          level: "info",
          detail: {
            strategy: "graphql",
            status: statusValue,
            keyword: trimmedKeyword,
            manager: managerRaw,
            projectCode: projectCodeRaw,
            returned: normalized.length,
            total: normalized.length,
            fallback: false,
          },
        });
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
        const refined = normalized.filter((entry) => {
          if (managerValue && !(entry.userName ?? "").toLowerCase().includes(managerValue)) {
            return false;
          }
          if (projectCodeValue && (entry.projectCode ?? "").toLowerCase() !== projectCodeValue) {
            return false;
          }
          if (keywordLower.length > 0) {
            const haystack = `${entry.projectCode ?? ""} ${entry.projectName ?? ""} ${entry.userName ?? ""} ${entry.note ?? ""}`.toLowerCase();
            if (!haystack.includes(keywordLower)) {
              return false;
            }
          }
          return true;
        });
        assignTimesheets(
          refined,
          rest.meta?.fallback ?? false,
          (rest.meta?.status as TimesheetStatus | "all") ?? statusValue ?? "all",
        );
        reportClientTelemetry({
          component: "timesheets/client",
          event: "list_fetch_succeeded",
          level: "info",
          detail: {
            strategy: "rest",
            status: statusValue,
            keyword: trimmedKeyword,
            manager: managerRaw,
            projectCode: projectCodeRaw,
            returned: refined.length,
            total: rest.meta?.total ?? refined.length,
            fallback: rest.meta?.fallback ?? false,
          },
        });
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
        const refinedFallback = fallbackItems.filter((entry) => {
          if (managerValue && !(entry.userName ?? "").toLowerCase().includes(managerValue)) {
            return false;
          }
          if (projectCodeValue && (entry.projectCode ?? "").toLowerCase() !== projectCodeValue) {
            return false;
          }
          if (keywordLower.length > 0) {
            const haystack = `${entry.projectCode ?? ""} ${entry.projectName ?? ""} ${entry.userName ?? ""} ${entry.note ?? ""}`.toLowerCase();
            return haystack.includes(keywordLower);
          }
          return true;
        });
        assignTimesheets(refinedFallback, true, "all");
        reportClientTelemetry({
          component: "timesheets/client",
          event: "list_fetch_succeeded",
          level: "info",
          detail: {
            strategy: "mock",
            status: statusValue,
            keyword: trimmedKeyword,
            manager: managerRaw,
            projectCode: projectCodeRaw,
            returned: refinedFallback.length,
            total: refinedFallback.length,
            fallback: true,
          },
        });
        finishLoading();
      }
    },
    [normalizeTimesheet],
  );

  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  useEffect(() => {
    keywordRef.current = appliedKeyword;
  }, [appliedKeyword]);

  useEffect(() => {
    managerRef.current = appliedManager;
  }, [appliedManager]);

  useEffect(() => {
    projectCodeRef.current = appliedProjectCode;
  }, [appliedProjectCode]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            status: filter,
            keyword: appliedKeyword,
            manager: appliedManager,
            projectCode: appliedProjectCode,
          }),
        );
      } catch (error) {
        console.warn("[timesheets] failed to persist filters", error);
      }
    }

    const desiredStatusParam = filter === "all" ? null : filter;
    const desiredKeywordParam = appliedKeyword.trim();
    const desiredManagerParam = appliedManager.trim();
    const desiredProjectCodeParam = appliedProjectCode.trim();

    const params = new URLSearchParams();
    if (desiredStatusParam) {
      params.set("status", desiredStatusParam);
    }
    if (desiredKeywordParam.length > 0) {
      params.set("keyword", desiredKeywordParam);
    }
    if (desiredManagerParam.length > 0) {
      params.set("manager", desiredManagerParam);
    }
    if (desiredProjectCodeParam.length > 0) {
      params.set("projectCode", desiredProjectCodeParam);
    }
    const nextQuery = params.toString();
    if (lastSyncedQueryRef.current === nextQuery) {
      return;
    }
    lastSyncedQueryRef.current = nextQuery;
    const target = nextQuery.length > 0 ? `${pathname}?${nextQuery}` : pathname;
    try {
      router.replace(target, { scroll: false });
    } catch (error) {
      console.warn("[timesheets] router.replace failed", error);
    }
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", target);
    }
  }, [filter, appliedKeyword, appliedManager, appliedProjectCode, pathname, router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const parseFilters = () => {
      let stored: { status?: string; keyword?: string; manager?: string; projectCode?: string } | null = null;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          stored = JSON.parse(raw);
        }
      } catch (error) {
        console.warn("[timesheets] failed to parse stored filters", error);
      }

      const params = new URLSearchParams(window.location.search);
      const statusFromQuery = params.get("status");
      const keywordFromQuery = params.get("keyword");
      const managerFromQuery = params.get("manager");
      const projectCodeFromQuery = params.get("projectCode");

      let normalizedStatus: TimesheetStatus | "all" = initialFilter;
      if (statusFromQuery && statusFilters.some((item) => item.value === statusFromQuery)) {
        normalizedStatus = statusFromQuery as TimesheetStatus | "all";
      } else if (stored?.status && statusFilters.some((item) => item.value === stored.status)) {
        normalizedStatus = stored.status as TimesheetStatus | "all";
      }

      let normalizedKeyword = "";
      if (keywordFromQuery && keywordFromQuery.trim().length > 0) {
        normalizedKeyword = keywordFromQuery.trim();
      } else if (typeof stored?.keyword === "string") {
        normalizedKeyword = stored.keyword;
      }

      let normalizedManager = "";
      if (managerFromQuery && managerFromQuery.trim().length > 0) {
        normalizedManager = managerFromQuery.trim();
      } else if (typeof stored?.manager === "string") {
        normalizedManager = stored.manager;
      }

      let normalizedProjectCode = "";
      if (projectCodeFromQuery && projectCodeFromQuery.trim().length > 0) {
        normalizedProjectCode = projectCodeFromQuery.trim();
      } else if (typeof stored?.projectCode === "string") {
        normalizedProjectCode = stored.projectCode;
      }

      if (!hydratedRef.current) {
        setFilter(normalizedStatus);
        setAppliedKeyword(normalizedKeyword);
        setSearchTerm(normalizedKeyword);
        setAppliedManager(normalizedManager);
        setManagerTerm(normalizedManager);
        setAppliedProjectCode(normalizedProjectCode);
        setProjectCodeTerm(normalizedProjectCode);
        hydratedRef.current = true;
      } else {
        if (normalizedStatus !== filterRef.current) {
          setFilter(normalizedStatus);
        }
        if (normalizedKeyword !== keywordRef.current) {
          setAppliedKeyword(normalizedKeyword);
          setSearchTerm(normalizedKeyword);
        }
        if (normalizedManager !== managerRef.current) {
          setAppliedManager(normalizedManager);
          setManagerTerm(normalizedManager);
        }
        if (normalizedProjectCode !== projectCodeRef.current) {
          setAppliedProjectCode(normalizedProjectCode);
          setProjectCodeTerm(normalizedProjectCode);
        }
      }

      lastSyncedQueryRef.current = params.toString();
    };

    parseFilters();
    const handlePop = () => parseFilters();
    window.addEventListener("popstate", handlePop);
    return () => {
      window.removeEventListener("popstate", handlePop);
    };
  }, [initialFilter]);

  useEffect(() => {
    void fetchTimesheets(filter, appliedKeyword, {
      manager: appliedManager,
      projectCode: appliedProjectCode,
    });
  }, [fetchTimesheets, filter, appliedKeyword, appliedManager, appliedProjectCode]);

  const performAction = useCallback(
    async (
      entry: TimesheetEntry,
      action: TimesheetAction,
      payload?: ActionPayload,
      options?: { suppressPending?: boolean },
    ) => {
      if (!options?.suppressPending) {
        setPendingId(entry.id);
        setMessage(null);
      }
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
        if (!options?.suppressPending) {
          setMessage(gql.timesheetAction.message ?? `${entry.userName} / ${entry.projectCode}: ${ACTION_LABEL[action]} 完了`);
        }
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
        if (!options?.suppressPending) {
          setMessage(`${entry.userName} / ${entry.projectCode}: ${ACTION_LABEL[action]} 完了 (REST fallback)`);
        }
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
        if (!options?.suppressPending) {
          setMessage(`${ACTION_LABEL[action]} に失敗しました`);
        }
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
        if (!options?.suppressPending) {
          setPendingId(null);
        }
      }
    },
    [normalizeTimesheet, updateTimesheetItem],
  );

  const BULK_ACTIONS: TimesheetAction[] = ["approve", "reject", "resubmit", "submit"];
  const BULK_PENDING_KEY = "__bulk__";

  const executeBulkAction = useCallback(
    async (action: TimesheetAction, targets: TimesheetEntry[], payload?: ActionPayload) => {
      const applicableTargets = targets.filter((entry) => availableActions(entry.approvalStatus).includes(action));
      if (applicableTargets.length === 0) {
        return;
      }
      setPendingId(BULK_PENDING_KEY);
      try {
        const results = await Promise.allSettled(
          applicableTargets.map((entry) => performAction(entry, action, payload, { suppressPending: true })),
        );
        const succeededIds = applicableTargets
          .map((entry, index) => (results[index]?.status === "fulfilled" ? entry.id : null))
          .filter((id): id is string => Boolean(id));
        if (succeededIds.length > 0) {
          setSelectedIds((prev) => prev.filter((id) => !succeededIds.includes(id)));
          setMessage(`${succeededIds.length} 件の ${ACTION_LABEL[action]} を実行しました`);
        }
        const failed = results.filter((result) => result.status === "rejected");
        if (failed.length > 0) {
          console.warn("[timesheets] bulk action failures", { action, failedCount: failed.length });
        }
      } finally {
        setPendingId(null);
      }
    },
    [performAction, setSelectedIds, setMessage],
  );

  const handleBulkAction = useCallback(
    (action: TimesheetAction) => {
      const targets = selectedEntries.filter((entry) => availableActions(entry.approvalStatus).includes(action));
      if (targets.length === 0) {
        return;
      }
      if (dialogRequired[action]) {
        setBulkDialog({ open: true, action, comment: "", reasonCode: "", targetIds: targets.map((entry) => entry.id) });
        return;
      }
      void executeBulkAction(action, targets);
    },
    [selectedEntries, executeBulkAction],
  );

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
        total: (prev.total ?? 0) + 1,
        returned: (prev.returned ?? prev.total ?? 0) + 1,
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
      void fetchTimesheets(nextFilter, appliedKeyword, {
        manager: appliedManager,
        projectCode: appliedProjectCode,
      });
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
          total: (prev.total ?? 0) + 1,
          returned: (prev.returned ?? prev.total ?? 0) + 1,
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
        void fetchTimesheets(nextFilter, appliedKeyword, {
          manager: appliedManager,
          projectCode: appliedProjectCode,
        });
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
        className="grid gap-3 md:grid-cols-4 items-end"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          setAppliedKeyword(searchTerm.trim());
          setAppliedManager(managerTerm.trim());
          setAppliedProjectCode(projectCodeTerm.trim());
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          <span>キーワード</span>
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="プロジェクト名・メモなど"
            data-testid="timesheets-search-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          <span>メンバー名</span>
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            value={managerTerm}
            onChange={(event) => setManagerTerm(event.target.value)}
            placeholder="例: 佐藤"
            data-testid="timesheets-filter-member"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-300">
          <span>プロジェクトコード</span>
          <input
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            value={projectCodeTerm}
            onChange={(event) => setProjectCodeTerm(event.target.value)}
            placeholder="例: DX-2025-01"
            data-testid="timesheets-filter-project"
          />
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-4">
          <button
            type="submit"
            className="rounded-md border border-sky-500 bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-100 transition-colors hover:border-sky-400 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:text-slate-500"
            disabled={listLoading}
          >
            検索
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setManagerTerm("");
              setProjectCodeTerm("");
              setAppliedKeyword("");
              setAppliedManager("");
              setAppliedProjectCode("");
            }}
            className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:text-slate-500"
            disabled={listLoading}
          >
            クリア
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span data-testid="timesheets-summary-count">
          表示件数: {filtered.length.toLocaleString()} 件 ({apiReturned.toLocaleString()} / {apiTotal.toLocaleString()} 件)
        </span>
        <span data-testid="timesheets-summary-filters">
          フィルタ: 状態={statusLabel} / キーワード={keywordSummary} / メンバー={managerSummary} / プロジェクト={projectCodeSummary}
        </span>
        <span>取得時刻: {formatDateTime(meta.fetchedAt)}</span>
        {meta.status ? <span>APIステータス: {meta.status}</span> : null}
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

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
          <span>選択中: {selectedIds.length} 件</span>
          {BULK_ACTIONS.map((action) => {
            const targets = selectedEntries.filter((entry) => availableActions(entry.approvalStatus).includes(action));
            if (targets.length === 0) return null;
            return (
              <button
                key={action}
                type="button"
                onClick={() => void handleBulkAction(action)}
                className="rounded-md border border-sky-500 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100 transition-colors hover:border-sky-400 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:text-slate-500"
                disabled={pendingId !== null}
              >
                {ACTION_LABEL[action]} ({targets.length})
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
          >
            選択解除
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sky-500"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  ref={selectAllRef}
                  onChange={toggleSelectAll}
                />
              </th>
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
            {filtered.map((entry) => {
              const telemetryParams = new URLSearchParams({
                component: 'ui/timesheets',
                detail: entry.id,
                detail_path: '$.detail.timesheetId',
              });
              const telemetryHref = `/telemetry?${telemetryParams.toString()}`;
              return (
                <tr key={entry.id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-3 align-top">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-sky-500"
                      checked={selectedIds.includes(entry.id)}
                      onChange={() => toggleSelection(entry.id)}
                      aria-label={`select timesheet ${entry.id}`}
                    />
                  </td>
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
                          disabled={pendingId !== null && (pendingId === BULK_PENDING_KEY || pendingId === entry.id)}
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
                      <Link
                        href={telemetryHref}
                        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition-colors hover:border-sky-400 hover:text-sky-100"
                        data-testid={`timesheet-telemetry-link-${entry.id}`}
                      >
                        Telemetry
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
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

      {bulkDialog.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900/90 p-6 text-sm text-slate-200 shadow-lg">
            <h3 className="text-lg font-semibold text-white">
              {ACTION_LABEL[bulkDialog.action]} — 選択 {bulkTargets.length} 件
            </h3>
            {bulkTargets.length > 0 ? (
              <p className="mt-1 text-xs text-slate-400">
                例: {bulkTargets.slice(0, 3).map((entry) => `${entry.userName} / ${entry.projectCode}`).join("、")}
                {bulkTargets.length > 3 ? ` 他 ${bulkTargets.length - 3} 件` : ""}
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              <label className="flex flex-col gap-1 text-xs text-slate-300">
                コメント
                <textarea
                  value={bulkDialog.comment}
                  onChange={(event) => setBulkDialog((prev) => ({ ...prev, comment: event.target.value }))}
                  rows={4}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                  placeholder="全件に適用するコメント"
                />
              </label>

              {bulkDialog.action === "reject" ? (
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  理由コード
                  <select
                    value={bulkDialog.reasonCode}
                    onChange={(event) => setBulkDialog((prev) => ({ ...prev, reasonCode: event.target.value }))}
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
              ) : null}

              <div className="max-h-32 overflow-auto rounded-md border border-slate-800 bg-slate-950/70 p-2 text-[11px] text-slate-300">
                {bulkTargets.length === 0 ? (
                  <p>対象が見つかりませんでした。</p>
                ) : (
                  <ul className="space-y-1">
                    {bulkTargets.map((entry) => (
                      <li key={entry.id}>
                        {entry.userName} / {entry.projectCode}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 text-xs">
              <button
                type="button"
                onClick={closeBulkDialog}
                className="rounded-md border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-600 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitBulkDialog}
                className="rounded-md border border-sky-600 bg-sky-600 px-3 py-1 text-white hover:bg-sky-500"
                disabled={pendingId === BULK_PENDING_KEY}
              >
                {ACTION_LABEL[bulkDialog.action]}
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
