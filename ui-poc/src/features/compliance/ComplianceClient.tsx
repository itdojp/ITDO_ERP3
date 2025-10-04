'use client';

import { useMemo, useState } from "react";
import type { ChangeEventHandler, FormEventHandler } from "react";
import { apiRequest } from "@/lib/api-client";
import { reportClientTelemetry } from "@/lib/telemetry";
import { searchMockInvoices, statusOptions } from "./mock-data";
import type {
  InvoiceAttachment,
  InvoiceListResponse,
  InvoiceRecord,
  InvoiceSearchFormState,
  InvoiceSortKey,
} from "./types";
import { STATUS_LABEL } from "./types";

const initialFormState: InvoiceSearchFormState = {
  keyword: "",
  status: "all",
  startDate: "",
  endDate: "",
  minAmount: "",
  maxAmount: "",
};

type QuerySource = "api" | "mock";

const TABLE_COLUMN_COUNT = 7;

const sortKeyOptions: Array<{ value: InvoiceSortKey; label: string }> = [
  { value: "issueDate", label: "発行日" },
  { value: "updatedAt", label: "更新日時" },
  { value: "amount", label: "金額" },
];

const sortDirectionOptions: Array<{ value: "asc" | "desc"; label: string }> = [
  { value: "desc", label: "降順" },
  { value: "asc", label: "昇順" },
];

const pageSizeOptions = [10, 25, 50];

type FetchOptions = {
  page?: number;
  pageSize?: number;
  sortBy?: InvoiceSortKey;
  sortDir?: "asc" | "desc";
  preserveSelection?: boolean;
  refresh?: boolean;
  silent?: boolean;
};

type ComplianceClientProps = {
  initialData: InvoiceListResponse;
};

export function ComplianceClient({ initialData }: ComplianceClientProps) {
  const initialMeta = initialData.meta;
  const [form, setForm] = useState<InvoiceSearchFormState>(initialFormState);
  const [invoices, setInvoices] = useState(initialData.items);
  const [meta, setMeta] = useState(initialMeta);
  const [page, setPage] = useState(initialMeta.page);
  const [pageSize, setPageSize] = useState(initialMeta.pageSize);
  const [sortBy, setSortBy] = useState<InvoiceSortKey>(initialMeta.sortBy);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialMeta.sortDir);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialData.items[0]?.id ?? null);
  const [previewAttachment, setPreviewAttachment] = useState<InvoiceAttachment | null>(null);

  const source: QuerySource = meta.fallback ? "mock" : "api";

  const applyMeta = (nextMeta: InvoiceListResponse["meta"]) => {
    setMeta(nextMeta);
    setPage(nextMeta.page);
    setPageSize(nextMeta.pageSize);
    setSortBy(nextMeta.sortBy);
    setSortDir(nextMeta.sortDir);
  };

  const fetchInvoices = async (options: FetchOptions = {}) => {
    const { refresh = false, silent = false } = options;
    if (!silent) setLoading(true);
    setError(null);

    const nextSortBy = options.sortBy ?? sortBy;
    const nextSortDir = options.sortDir ?? sortDir;
    const nextPageSize = options.pageSize ?? pageSize;
    const nextPage = options.page ?? page;
    const previousSelection = options.preserveSelection ? selectedId : null;

    const query = buildQueryString(form, {
      page: nextPage,
      pageSize: nextPageSize,
      sortBy: nextSortBy,
      sortDir: nextSortDir,
    });
    const path = refresh ? `/api/v1/compliance/invoices?${query}&refresh=true` : `/api/v1/compliance/invoices?${query}`;
    let result: InvoiceListResponse | null = null;

    try {
      const response = await apiRequest<InvoiceListResponse>({ path });
      setInvoices(response.items);
      applyMeta(response.meta);
      reportClientTelemetry({
        component: "compliance/client",
        event: "api_fetch_succeeded",
        level: response.meta?.fallback ? "warn" : "info",
        detail: {
          fallback: response.meta?.fallback ?? false,
          items: response.items.length,
          page: response.meta?.page,
        },
      });

      const preserved = previousSelection && response.items.some((item) => item.id === previousSelection)
        ? previousSelection
        : response.items[0]?.id ?? null;
      setSelectedId(preserved);
      result = response;
    } catch (err) {
      console.warn("[compliance] falling back to mock data", err);
      reportClientTelemetry({
        component: "compliance/client",
        event: "mock_fallback",
        level: "warn",
        detail: {
          error: err instanceof Error ? err.message : String(err),
          query: {
            keyword: form.keyword,
            status: form.status,
            sortBy: nextSortBy,
            sortDir: nextSortDir,
          },
        },
      });
      const fallbackItems = searchMockInvoices(form);
      const sortedFallback = fallbackItems.slice().sort((a, b) => {
        if (nextSortBy === "updatedAt") {
          const aTime = new Date(a.updatedAt ?? a.issueDate ?? 0).getTime();
          const bTime = new Date(b.updatedAt ?? b.issueDate ?? 0).getTime();
          return nextSortDir === "asc" ? aTime - bTime : bTime - aTime;
        }
        if (nextSortBy === "amount") {
          const delta = (a.amountIncludingTax ?? 0) - (b.amountIncludingTax ?? 0);
          return nextSortDir === "asc" ? delta : -delta;
        }
        const aTime = Date.parse(`${a.issueDate}T00:00:00Z`);
        const bTime = Date.parse(`${b.issueDate}T00:00:00Z`);
        const delta = (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
        return nextSortDir === "asc" ? delta : -delta;
      });
      const fallbackPage = 1;
      const fallbackPageSize = sortedFallback.length === 0 ? nextPageSize : sortedFallback.length;
      setInvoices(sortedFallback.slice(0, fallbackPageSize));
      const fallbackMeta: InvoiceListResponse["meta"] = {
        total: sortedFallback.length,
        page: fallbackPage,
        pageSize: fallbackPageSize,
        totalPages: 1,
        sortBy: nextSortBy,
        sortDir: nextSortDir,
        fetchedAt: new Date().toISOString(),
        fallback: true,
      };
      applyMeta(fallbackMeta);
      setSelectedId(fallbackItems[0]?.id ?? null);
      setError("APIの取得に失敗したため、モックデータを表示しています。");
      result = {
        items: sortedFallback.slice(0, fallbackPageSize),
        meta: fallbackMeta,
      };
    } finally {
      if (!silent) setLoading(false);
    }

    return result;
  };

  const selectedInvoice = useMemo(() => {
    if (!selectedId) return null;
    return invoices.find((invoice) => invoice.id === selectedId) ?? null;
  }, [invoices, selectedId]);

  const handleChange = (
    field: keyof InvoiceSearchFormState,
  ): ChangeEventHandler<HTMLInputElement | HTMLSelectElement> => {
    return (event) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };
  };

  const handleSearch: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    void fetchInvoices({ page: 1 });
  };

  const handleReset = () => {
    setForm(initialFormState);
    setInvoices(initialData.items);
    applyMeta(initialData.meta);
    setSelectedId(initialData.items[0]?.id ?? null);
    setError(null);
  };

  const handleRetryLive = () => {
    void fetchInvoices({ refresh: true });
  };

  const handleSortKeyChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    const value = event.target.value as InvoiceSortKey;
    setSortBy(value);
    void fetchInvoices({ page: 1, sortBy: value });
  };

  const handleSortDirChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    const value = event.target.value === "asc" ? "asc" : "desc";
    setSortDir(value);
    void fetchInvoices({ page: 1, sortDir: value });
  };

  const handlePageSizeChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    const nextSize = Number.parseInt(event.target.value, 10);
    const validSize = Number.isFinite(nextSize) ? nextSize : pageSize;
    setPageSize(validSize);
    void fetchInvoices({ page: 1, pageSize: validSize });
  };

  const goToPreviousPage = () => {
    if (page <= 1) return;
    void fetchInvoices({ page: page - 1 });
  };

  const goToNextPage = () => {
    if (page >= meta.totalPages) return;
    void fetchInvoices({ page: page + 1 });
  };

  const handleDownload = async (invoice: InvoiceRecord, attachment: InvoiceAttachment) => {
    const openInNewTab = (url: string | undefined) => {
      if (!url) return false;
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        setError('ポップアップがブロックされました。ブラウザの設定を確認してください。');
        return false;
      }
      return true;
    };

    const opened = openInNewTab(attachment.downloadUrl);
    const refreshed = await fetchInvoices({ refresh: true, preserveSelection: true, silent: true });
    if (!refreshed) {
      if (!opened) {
        setError('ダウンロードリンクの再生成に失敗しました。');
      }
      return;
    }

    const updatedInvoice = refreshed.items.find((item) => item.id === invoice.id);
    const updatedAttachment = updatedInvoice?.attachments.find((item) => item.id === attachment.id);
    if (!opened && !openInNewTab(updatedAttachment?.downloadUrl)) {
      setError('ダウンロードリンクの再生成に失敗しました。');
    }
  };

  return (
    <div className="space-y-6">
      <form
        className="grid gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-200 md:grid-cols-4"
        onSubmit={handleSearch}
      >
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">フリーワード</span>
          <input
            value={form.keyword}
            onChange={handleChange("keyword")}
            placeholder="請求書番号 / 取引先 / タグ等"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">請求書ステータス</span>
          <select
            value={form.status}
            onChange={handleChange("status")}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
          >
            {statusOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">発行日 (From)</span>
          <input
            type="date"
            value={form.startDate}
            onChange={handleChange("startDate")}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">発行日 (To)</span>
          <input
            type="date"
            value={form.endDate}
            onChange={handleChange("endDate")}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">金額 (Min)</span>
          <input
            type="number"
            inputMode="numeric"
            value={form.minAmount}
            onChange={handleChange("minAmount")}
            placeholder="100000"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">金額 (Max)</span>
          <input
            type="number"
            inputMode="numeric"
            value={form.maxAmount}
            onChange={handleChange("maxAmount")}
            placeholder="500000"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
          />
        </label>

        <div className="flex items-end gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md border border-sky-500 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 transition-colors hover:border-sky-400 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {loading ? "検索中..." : "検索"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            条件クリア
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 md:col-span-2">
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">並び順 (項目)</span>
            <select
              value={sortBy}
              onChange={handleSortKeyChange}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            >
              {sortKeyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">並び順 (方向)</span>
            <select
              value={sortDir}
              onChange={handleSortDirChange}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            >
              {sortDirectionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">1ページ表示件数</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option} 件
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-700 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={handleRetryLive}
            disabled={loading}
            className="rounded-md border border-amber-400 px-3 py-1 font-semibold text-amber-100 transition-colors hover:border-amber-300 hover:text-white disabled:cursor-not-allowed disabled:border-amber-700 disabled:text-amber-500"
            data-testid="compliance-retry-live"
          >
            ライブAPIを再試行
          </button>
        </div>
      ) : null}

      {!error && source === "mock" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-xs text-slate-200">
          <span>現在はモックデータを表示しています。ポッドマン環境を確認したらライブAPIを再試行できます。</span>
          <button
            type="button"
            onClick={handleRetryLive}
            disabled={loading}
            className="rounded-md border border-sky-500 px-3 py-1 font-semibold text-sky-100 transition-colors hover:border-sky-400 hover:text-white disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
            data-testid="compliance-retry-live"
          >
            ライブAPIを再試行
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400" data-testid="compliance-meta">
        <div className="flex flex-wrap items-center gap-3">
          <span>ヒット件数: {meta.total.toLocaleString()} 件</span>
          <span>
            ページ: {page} / {meta.totalPages.toLocaleString()}
          </span>
          <span>取得時刻: {formatDateTime(meta.fetchedAt)}</span>
          <span
            className={`rounded-full px-2 py-1 font-medium ${
              source === "api"
                ? "bg-emerald-500/20 text-emerald-200"
                : "bg-amber-500/20 text-amber-200"
            }`}
          >
            {source === "api" ? "API live" : "Mock data"}
          </span>
        </div>
        <div className="flex items-center gap-2" data-testid="compliance-pager">
          <button
            type="button"
            onClick={goToPreviousPage}
            disabled={page <= 1 || loading}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
          >
            前へ
          </button>
          <span>
            {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, meta.total)}
          </span>
          <button
            type="button"
            onClick={goToNextPage}
            disabled={page >= meta.totalPages || loading}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
          >
            次へ
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left font-medium">発行日</th>
              <th className="px-4 py-3 text-left font-medium">請求書番号</th>
              <th className="px-4 py-3 text-left font-medium">取引先</th>
              <th className="px-4 py-3 text-left font-medium">件名</th>
              <th className="px-4 py-3 text-right font-medium">税込金額</th>
              <th className="px-4 py-3 text-left font-medium">ステータス</th>
              <th className="px-4 py-3 text-left font-medium">タグ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {invoices.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={TABLE_COLUMN_COUNT}>
                  条件に一致する請求書が見つかりませんでした。
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  onClick={() => setSelectedId(invoice.id)}
                  className={`cursor-pointer transition-colors hover:bg-slate-800/40 ${
                    selectedId === invoice.id ? "bg-slate-800/40" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-slate-200">{formatDate(invoice.issueDate)}</td>
                  <td className="px-4 py-3 text-slate-200">
                    <div className="flex flex-col">
                      <span>{invoice.invoiceNumber}</span>
                      <span className="text-xs text-slate-500">#{invoice.id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    <div className="flex flex-col">
                      <span>{invoice.counterpartyName}</span>
                      {invoice.counterpartyNumber ? (
                        <span className="text-xs text-slate-500">{invoice.counterpartyNumber}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-200">{invoice.subject}</td>
                  <td className="px-4 py-3 text-right text-slate-200">
                    {formatCurrency(invoice.amountIncludingTax, invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    <div className="flex flex-wrap gap-1">
                      {invoice.tags.map((tag) => (
                        <span key={tag} className="rounded-md bg-slate-800 px-2 py-1">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedInvoice ? (
        <DetailPanel invoice={selectedInvoice} onPreview={setPreviewAttachment} onDownload={handleDownload} />
      ) : null}

      {previewAttachment ? (
        <AttachmentPreview attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
      ) : null}
    </div>
  );
}

type DetailPanelProps = {
  invoice: InvoiceRecord;
  onPreview: (attachment: InvoiceAttachment) => void;
  onDownload: (invoice: InvoiceRecord, attachment: InvoiceAttachment) => void;
};

function DetailPanel({ invoice, onPreview, onDownload }: DetailPanelProps) {
  return (
    <div className="grid gap-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-200 md:grid-cols-[1.3fr_1fr]">
      <div className="space-y-4">
        <header className="space-y-2">
          <h3 className="text-lg font-semibold text-white">{invoice.subject}</h3>
          <p className="text-xs text-slate-400">
            {invoice.invoiceNumber} ・ 発行日 {formatDate(invoice.issueDate)} ・ 最終更新 {formatDateTime(invoice.updatedAt)}
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-4 text-xs text-slate-300">
          <div>
            <dt className="text-slate-500">取引先</dt>
            <dd className="mt-1 text-sm text-slate-100">{invoice.counterpartyName}</dd>
            {invoice.counterpartyNumber ? (
              <dd className="text-xs text-slate-500">{invoice.counterpartyNumber}</dd>
            ) : null}
          </div>
          <div>
            <dt className="text-slate-500">金額 (税込)</dt>
            <dd className="mt-1 text-sm text-slate-100">
              {formatCurrency(invoice.amountIncludingTax, invoice.currency)}
            </dd>
            <dd className="text-xs text-slate-500">税抜 {invoice.amountExcludingTax.toLocaleString()} {invoice.currency}</dd>
          </div>
          <div>
            <dt className="text-slate-500">状態</dt>
            <dd className="mt-1">
              <StatusBadge status={invoice.status} />
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">対応メモ</dt>
            <dd className="mt-1 text-slate-200">{invoice.remarks ?? "—"}</dd>
          </div>
          {invoice.matchedPurchaseOrder ? (
            <div>
              <dt className="text-slate-500">ひも付く購買</dt>
              <dd className="mt-1 text-slate-200">{invoice.matchedPurchaseOrder}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <aside className="space-y-4">
        <h4 className="text-sm font-semibold text-white">添付ファイル</h4>
        <div className="space-y-3">
          {invoice.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="rounded-lg border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-slate-100">{attachment.fileName}</p>
                  <p className="text-slate-500">
                    {attachment.mimeType} ・ {attachment.sizeLabel}
                  </p>
                </div>
                <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400">
                  {attachment.kind}
                </span>
              </div>
              {attachment.previewNote ? (
                <p className="mt-2 text-slate-400">{attachment.previewNote}</p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onPreview(attachment)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition-colors hover:border-sky-500 hover:text-white"
                >
                  プレビュー
                </button>
                <button
                  type="button"
                  onClick={() => onDownload(invoice, attachment)}
                  className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                    attachment.downloadUrl
                      ? 'border-sky-500 bg-sky-500/20 text-sky-100 hover:border-sky-400 hover:bg-sky-500/30'
                      : 'border-slate-800 bg-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                  data-download-url={attachment.downloadUrl ?? ''}
                >
                  ダウンロード
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

type AttachmentPreviewProps = {
  attachment: InvoiceAttachment;
  onClose: () => void;
};

function AttachmentPreview({ attachment, onClose }: AttachmentPreviewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-200">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white">{attachment.fileName}</h3>
            <p className="text-xs text-slate-400">
              {attachment.mimeType} ・ {attachment.sizeLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            閉じる
          </button>
        </header>
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
          <p>プレビューは PoC 用のモック表示です。実装時には PDF / 画像ビューアを埋め込みます。</p>
          {attachment.previewNote ? <p className="mt-2 text-slate-500">{attachment.previewNote}</p> : null}
        </div>
      </div>
    </div>
  );
}

function buildQueryString(
  filters: InvoiceSearchFormState,
  options: { page: number; pageSize: number; sortBy: InvoiceSortKey; sortDir: "asc" | "desc" },
): string {
  const params = new URLSearchParams();
  if (filters.keyword.trim()) {
    params.set("keyword", filters.keyword.trim());
  }
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.startDate) {
    params.set("issued_from", filters.startDate);
  }
  if (filters.endDate) {
    params.set("issued_to", filters.endDate);
  }
  if (filters.minAmount.trim()) {
    params.set("min_total", filters.minAmount.trim());
  }
  if (filters.maxAmount.trim()) {
    params.set("max_total", filters.maxAmount.trim());
  }
  params.set("page", String(options.page));
  params.set("page_size", String(options.pageSize));
  params.set("sort_by", options.sortBy);
  params.set("sort_dir", options.sortDir);
  return params.toString();
}

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ja-JP", { style: "currency", currency }).format(value);
  } catch (err) {
    console.warn("[compliance] failed to format currency", err);
    return `${value.toLocaleString()} ${currency}`;
  }
}

function formatDate(date: string): string {
  if (!date) return "—";
  const parsed = parseIsoDate(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: InvoiceRecord["status"] }) {
  const color = badgeColor(status);
  return (
    <span
      className={`${color} inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function badgeColor(status: InvoiceRecord["status"]): string {
  switch (status) {
    case "matched":
      return "bg-emerald-500/20 text-emerald-200";
    case "flagged":
      return "bg-amber-500/20 text-amber-200";
    case "pending":
      return "bg-sky-500/20 text-sky-100";
    case "archived":
      return "bg-slate-700/50 text-slate-300";
    default:
      return "bg-slate-500/20 text-slate-200";
  }
}

function parseIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
