'use client';

import { useMemo, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type {
  ActionPayload,
  TimesheetAction,
  TimesheetEntry,
  TimesheetListMeta,
  TimesheetListResponse,
  TimesheetStatus,
} from "./types";
import { ACTION_LABEL, STATUS_LABEL } from "./types";

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

  const source: QuerySource = meta.fallback ? "mock" : "api";

  const filtered = useMemo(() => {
    if (filter === "all") return timesheets;
    return timesheets.filter((ts) => ts.approvalStatus === filter);
  }, [timesheets, filter]);

  const closeDialog = () => setDialog(initialDialog);

  const performAction = async (entry: TimesheetEntry, action: TimesheetAction, payload?: ActionPayload) => {
    setPendingId(entry.id);
    setMessage(null);
    try {
      await apiRequest({
        path: `/api/v1/timesheets/${entry.id}/${action}`,
        method: "POST",
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const nextStatus = inferNextStatus(entry.approvalStatus, action);
      setTimesheets((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                approvalStatus: nextStatus,
                note: payload?.comment ?? item.note,
              }
            : item,
        ),
      );
      setMessage(`${entry.userName} / ${entry.projectCode}: ${ACTION_LABEL[action]} 完了`);
      setMeta((prev) => ({
        ...prev,
        fallback: false,
        fetchedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error("timesheet action failed", error);
      setMessage(`${ACTION_LABEL[action]} に失敗しました`);
    } finally {
      setPendingId(null);
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
