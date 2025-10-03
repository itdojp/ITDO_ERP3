import { ComplianceClient } from "@/features/compliance/ComplianceClient";
import { mockInvoices } from "@/features/compliance/mock-data";
import type { InvoiceListResponse } from "@/features/compliance/types";

async function fetchComplianceInvoices(): Promise<InvoiceListResponse> {
  const base = process.env.POC_API_BASE ?? "http://localhost:3001";
  try {
    const res = await fetch(`${base}/api/v1/compliance/invoices?limit=25`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`status ${res.status}`);
    }
    const data = (await res.json()) as Partial<InvoiceListResponse>;
    return {
      items: data.items ?? [],
      meta: {
        total: data.meta?.total ?? data.items?.length ?? 0,
        fetchedAt: data.meta?.fetchedAt ?? new Date().toISOString(),
        fallback: data.meta?.fallback ?? false,
      },
    } satisfies InvoiceListResponse;
  } catch (error) {
    console.warn("[compliance] falling back to mock data due to fetch error", error);
    return mockInvoices;
  }
}

export default async function CompliancePage() {
  const data = await fetchComplianceInvoices();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Compliance PoC</h2>
        <p className="text-sm text-slate-400">
          電子取引（インボイス）検索のUXを検証する画面です。複合フィルタで請求書を絞り込み、
          添付ファイルの確認や照合作業メモを想定した操作パターンを確認できます。
        </p>
      </header>

      <ComplianceClient initialData={data} />
    </section>
  );
}
