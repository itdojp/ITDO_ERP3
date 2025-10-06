import { TimesheetsClient } from "@/features/timesheets/TimesheetsClient";
import { mockTimesheets } from "@/features/timesheets/mock-data";
import { TIMESHEETS_PAGE_QUERY } from "@/features/timesheets/queries";
import type { TimesheetListResponse } from "@/features/timesheets/types";
import { graphqlRequest } from "@/lib/api-client.server";
import { reportServerTelemetry } from "@/lib/telemetry";

const defaultMeta: NonNullable<TimesheetListResponse["meta"]> = {
  total: 0,
  returned: 0,
  fetchedAt: new Date().toISOString(),
  fallback: true,
  status: "all",
};

const ALLOWED_STATUS = new Set(["all", "submitted", "rejected", "approved", "draft"]);

type TimesheetFetchParams = {
  status?: string | null;
  keyword?: string | null;
  manager?: string | null;
  projectCode?: string | null;
};

async function fetchTimesheets({ status, keyword, manager, projectCode }: TimesheetFetchParams = {}): Promise<TimesheetListResponse> {
  const base = process.env.POC_API_BASE ?? "http://localhost:3001";
  const normalizedStatus = typeof status === "string" && ALLOWED_STATUS.has(status) ? status : "submitted";
  const normalizedKeyword = typeof keyword === "string" && keyword.trim().length > 0 ? keyword.trim() : undefined;
  const normalizedManager = typeof manager === "string" && manager.trim().length > 0 ? manager.trim() : undefined;
  const normalizedProjectCode = typeof projectCode === "string" && projectCode.trim().length > 0 ? projectCode.trim() : undefined;
  try {
    const payload = await graphqlRequest<{
      timesheets?: TimesheetListResponse["items"];
    }>({
      query: TIMESHEETS_PAGE_QUERY,
      variables: {
        status: normalizedStatus,
        keyword: normalizedKeyword,
        userName: normalizedManager,
        projectCode: normalizedProjectCode,
      },
      baseUrl: base,
    });
    const items = Array.isArray(payload.timesheets) ? payload.timesheets : [];
    return {
      items,
      meta: {
        total: items.length,
        returned: items.length,
        fetchedAt: new Date().toISOString(),
        fallback: false,
        status: normalizedStatus,
      },
    } satisfies TimesheetListResponse;
  } catch (error) {
    console.warn("[timesheets] GraphQL fetch failed, fallback to REST", error);
    await reportServerTelemetry({
      component: "timesheets/page",
      event: "graphql_fetch_failed",
      level: "warn",
      detail: {
        stage: "initial",
        status: normalizedStatus,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    try {
      const params = new URLSearchParams();
      if (normalizedStatus !== "all") {
        params.set("status", normalizedStatus);
      }
      const res = await fetch(`${base}/api/v1/timesheets${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const data = (await res.json()) as Partial<TimesheetListResponse>;
      await reportServerTelemetry({
        component: "timesheets/page",
        event: "rest_fallback_succeeded",
        level: "info",
        detail: {
          stage: "initial",
          status: normalizedStatus,
          items: data.items?.length ?? 0,
        },
      });
      const filteredItems = (data.items ?? []).filter((entry) => {
        if (normalizedStatus !== "all" && entry.approvalStatus !== normalizedStatus) {
          return false;
        }
        if (normalizedManager && !(entry.userName ?? '').toLowerCase().includes(normalizedManager.toLowerCase())) {
          return false;
        }
        if (normalizedProjectCode && (entry.projectCode ?? '').toLowerCase() !== normalizedProjectCode.toLowerCase()) {
          return false;
        }
        if (normalizedKeyword) {
          const haystack = `${entry.projectCode ?? ''} ${entry.projectName ?? ''} ${entry.userName ?? ''} ${entry.note ?? ''}`.toLowerCase();
          return haystack.includes(normalizedKeyword.toLowerCase());
        }
        return true;
      });
      return {
        items: filteredItems,
        meta: {
          total: filteredItems.length,
          returned: filteredItems.length,
          fetchedAt: data.meta?.fetchedAt ?? new Date().toISOString(),
          fallback: data.meta?.fallback ?? false,
          status: normalizedStatus,
        },
      } satisfies TimesheetListResponse;
    } catch (restError) {
      console.warn("[timesheets] falling back to mock data", restError);
      await reportServerTelemetry({
        component: "timesheets/page",
        event: "mock_fallback",
        level: "warn",
        detail: {
          stage: "initial",
          status: normalizedStatus,
          error: restError instanceof Error ? restError.message : String(restError),
        },
      });
      return {
        ...mockTimesheets,
        meta: {
          ...defaultMeta,
          ...mockTimesheets.meta,
        },
      };
    }
  }
}

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const statusParam = typeof searchParams?.status === "string" ? searchParams.status : Array.isArray(searchParams?.status) ? searchParams.status[0] ?? null : null;
  const keywordParam = typeof searchParams?.keyword === "string"
    ? searchParams.keyword
    : Array.isArray(searchParams?.keyword)
      ? searchParams.keyword[0] ?? null
      : null;
  const managerParam = typeof searchParams?.manager === "string"
    ? searchParams.manager
    : Array.isArray(searchParams?.manager)
      ? searchParams.manager[0] ?? null
      : null;
  const projectCodeParam = typeof searchParams?.projectCode === "string"
    ? searchParams.projectCode
    : Array.isArray(searchParams?.projectCode)
      ? searchParams.projectCode[0] ?? null
      : null;

  const data = await fetchTimesheets({
    status: statusParam,
    keyword: keywordParam,
    manager: managerParam,
    projectCode: projectCodeParam,
  });

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Timesheets PoC</h2>
        <p className="text-sm text-slate-400">
          工数承認のUXを検証するための画面です。承認ステータスに応じたフィルタやコメント付き承認/
          差戻しを試せます。Podman スタックを起動すると `/api/v1/timesheets` の PoC API が利用できます。
        </p>
      </header>

      <TimesheetsClient initialTimesheets={data} />
    </section>
  );
}
