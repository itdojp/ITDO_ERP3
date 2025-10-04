import { TimesheetsClient } from "@/features/timesheets/TimesheetsClient";
import { mockTimesheets } from "@/features/timesheets/mock-data";
import type { TimesheetListResponse } from "@/features/timesheets/types";

const defaultMeta: NonNullable<TimesheetListResponse["meta"]> = {
  total: 0,
  returned: 0,
  fetchedAt: new Date().toISOString(),
  fallback: true,
  status: "all",
};

async function fetchTimesheets(): Promise<TimesheetListResponse> {
  const base = process.env.POC_API_BASE ?? "http://localhost:3001";
  try {
    const res = await fetch(`${base}/api/v1/timesheets?status=submitted`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`status ${res.status}`);
    }
    const data = (await res.json()) as Partial<TimesheetListResponse>;
    return {
      items: data.items ?? [],
      meta: {
        total: data.meta?.total ?? data.items?.length ?? 0,
        returned: data.meta?.returned ?? data.items?.length ?? 0,
        fetchedAt: data.meta?.fetchedAt ?? new Date().toISOString(),
        fallback: data.meta?.fallback ?? false,
        status: (data.meta?.status as string | undefined) ?? "submitted",
      },
    } satisfies TimesheetListResponse;
  } catch (error) {
    console.warn("[timesheets] falling back to mock data due to fetch error", error);
    return {
      ...mockTimesheets,
      meta: {
        ...defaultMeta,
        ...mockTimesheets.meta,
      },
    };
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
