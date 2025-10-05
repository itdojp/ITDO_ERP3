import { TimesheetsClient } from "@/features/timesheets/TimesheetsClient";
import { mockTimesheets } from "@/features/timesheets/mock-data";
import { TIMESHEETS_PAGE_QUERY } from "@/features/timesheets/queries";
import type { TimesheetListResponse } from "@/features/timesheets/types";
import { graphqlRequest } from "@/lib/api-client";
import { reportServerTelemetry } from "@/lib/telemetry";

const defaultMeta: NonNullable<TimesheetListResponse["meta"]> = {
  total: 0,
  returned: 0,
  fetchedAt: new Date().toISOString(),
  fallback: true,
  status: "all",
};

async function fetchTimesheets(): Promise<TimesheetListResponse> {
  const base = process.env.POC_API_BASE ?? "http://localhost:3001";
  const status = "submitted";
  try {
    const payload = await graphqlRequest<{
      timesheets?: TimesheetListResponse["items"];
    }>({
      query: TIMESHEETS_PAGE_QUERY,
      variables: { status },
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
        status,
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
        status,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    try {
      const res = await fetch(`${base}/api/v1/timesheets?status=${status}`, { cache: "no-store" });
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
          status,
          items: data.items?.length ?? 0,
        },
      });
      return {
        items: data.items ?? [],
        meta: {
          total: data.meta?.total ?? data.items?.length ?? 0,
          returned: data.meta?.returned ?? data.items?.length ?? 0,
          fetchedAt: data.meta?.fetchedAt ?? new Date().toISOString(),
          fallback: data.meta?.fallback ?? false,
          status: (data.meta?.status as string | undefined) ?? status,
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
          status,
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

export default async function TimesheetsPage() {
  const data = await fetchTimesheets();

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
