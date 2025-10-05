import { ComplianceClient } from "@/features/compliance/ComplianceClient";
import { mockInvoices } from "@/features/compliance/mock-data";
import type { InvoiceListResponse } from "@/features/compliance/types";
import { COMPLIANCE_INVOICES_QUERY } from "@/features/compliance/queries";
import { graphqlRequest } from "@/lib/api-client.server";
import { reportServerTelemetry } from "@/lib/telemetry";

const defaultMeta: InvoiceListResponse["meta"] = {
  total: 0,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  sortBy: "issueDate",
  sortDir: "desc",
  fetchedAt: new Date().toISOString(),
  fallback: true,
};

async function fetchComplianceInvoices(): Promise<InvoiceListResponse> {
  const base = process.env.POC_API_BASE ?? "http://localhost:3001";
  const filterInput = { page: 1, pageSize: 25, sortBy: "issueDate", sortDir: "desc" as const };

  try {
    const gql = await graphqlRequest<{
      complianceInvoices?: {
        items?: InvoiceListResponse["items"];
        meta?: InvoiceListResponse["meta"];
      };
    }>({
      query: COMPLIANCE_INVOICES_QUERY,
      variables: { filter: filterInput },
      baseUrl: base,
    });

    const connection = gql.complianceInvoices;
    if (!connection) {
      throw new Error("graphql response missing complianceInvoices");
    }
    const items = Array.isArray(connection.items) ? connection.items : [];
    const meta = connection.meta ?? {};
    const normalizedMeta: InvoiceListResponse["meta"] = {
      total: meta.total ?? items.length,
      page: meta.page ?? filterInput.page,
      pageSize: meta.pageSize ?? filterInput.pageSize,
      totalPages: meta.totalPages ?? 1,
      sortBy: (meta.sortBy as InvoiceListResponse["meta"]["sortBy"]) ?? filterInput.sortBy,
      sortDir: (meta.sortDir as InvoiceListResponse["meta"]["sortDir"]) ?? filterInput.sortDir,
      fetchedAt: meta.fetchedAt ?? new Date().toISOString(),
      fallback: meta.fallback ?? false,
    };

    await reportServerTelemetry({
      component: "compliance/page",
      event: "graphql_fetch_succeeded",
      level: normalizedMeta.fallback ? "warn" : "info",
      detail: {
        stage: "initial",
        items: items.length,
        fallback: normalizedMeta.fallback,
      },
    });

    return { items, meta: normalizedMeta } satisfies InvoiceListResponse;
  } catch (graphqlError) {
    console.warn("[compliance] GraphQL fetch failed, fallback to REST", graphqlError);
    await reportServerTelemetry({
      component: "compliance/page",
      event: "graphql_fetch_failed",
      level: "warn",
      detail: {
        stage: "initial",
        error: graphqlError instanceof Error ? graphqlError.message : String(graphqlError),
      },
    });
    try {
      const res = await fetch(`${base}/api/v1/compliance/invoices`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const data = (await res.json()) as Partial<InvoiceListResponse>;
      await reportServerTelemetry({
        component: "compliance/page",
        event: "rest_fallback_succeeded",
        level: "info",
        detail: {
          stage: "initial",
          items: data.items?.length ?? 0,
        },
      });
      return {
        items: data.items ?? [],
        meta: {
          total: data.meta?.total ?? data.items?.length ?? 0,
          page: data.meta?.page ?? 1,
          pageSize: data.meta?.pageSize ?? 25,
          totalPages: data.meta?.totalPages ?? 1,
          sortBy: data.meta?.sortBy ?? "issueDate",
          sortDir: data.meta?.sortDir ?? "desc",
          fetchedAt: data.meta?.fetchedAt ?? new Date().toISOString(),
          fallback: data.meta?.fallback ?? false,
        },
      } satisfies InvoiceListResponse;
    } catch (restError) {
      console.warn("[compliance] falling back to mock data due to fetch error", restError);
      await reportServerTelemetry({
        component: "compliance/page",
        event: "mock_fallback",
        level: "warn",
        detail: {
          stage: "initial",
          error: restError instanceof Error ? restError.message : String(restError),
        },
      });
      return {
        ...mockInvoices,
        meta: {
          ...defaultMeta,
          ...mockInvoices.meta,
        },
      };
    }
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
