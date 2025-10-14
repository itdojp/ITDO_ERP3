import { memo, useMemo } from "react";
import { RefreshCcw } from "lucide-react";
import clsx from "clsx";
import { useProjectInsights } from "./useProjectInsights";
import type { ProjectSummary } from "./types";

type Props = {
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  listLoading?: boolean;
};

const severityClass: Record<"good" | "warning" | "critical", string> = {
  good: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40",
  warning: "bg-amber-500/10 text-amber-300 border border-amber-500/40",
  critical: "bg-rose-500/10 text-rose-300 border border-rose-500/40",
};

const statusBadge: Record<string, string> = {
  todo: "bg-slate-700 text-slate-200",
  inProgress: "bg-sky-700 text-sky-100",
  review: "bg-purple-700 text-purple-100",
  done: "bg-emerald-700 text-emerald-100",
  blocked: "bg-rose-700 text-rose-100",
};

export const ProjectInsightsPanel = memo(function ProjectInsightsPanel({ projects, selectedProjectId, onSelectProject, listLoading }: Props) {
  const hasProjects = projects.length > 0;
  const defaultProject = hasProjects ? projects[0] : null;
  const effectiveProjectId = selectedProjectId ?? defaultProject?.id ?? null;
  const selectedProject = useMemo(() => projects.find((project) => project.id === effectiveProjectId) ?? null, [projects, effectiveProjectId]);
  const { insights, highlight, loading, error, source, refresh, burndownTrend } = useProjectInsights(effectiveProjectId);

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    onSelectProject(value.length > 0 ? value : null);
  };

  return (
    <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/80 p-4 shadow-sm" data-testid="project-insights-panel">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">AI ハイライト & ダッシュボード</h3>
          <p className="text-xs text-slate-400">タイムライン、EVM、リスクを自動集約し、重要な着眼点を提示します。</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <select
            value={effectiveProjectId ?? ""}
            onChange={handleSelect}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            disabled={!hasProjects || listLoading}
            data-testid="project-insights-selector"
          >
            {projects.length === 0 ? <option value="">プロジェクトがありません</option> : null}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} — {project.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={refresh}
            disabled={loading || !effectiveProjectId}
            data-testid="project-insights-refresh"
          >
            <RefreshCcw className={clsx("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
            更新
          </button>
        </div>
      </header>

      {!hasProjects ? (
        <p className="rounded-md border border-dashed border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-300">
          表示可能なプロジェクトがありません。フィルタ条件を変更するか、新しいプロジェクトを作成してください。
        </p>
      ) : null}

      {effectiveProjectId && selectedProject ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <div
              className={clsx(
                "space-y-3 rounded-lg border p-4",
                highlight ? severityClass[highlight.severity] : "border-slate-700 bg-slate-800 text-slate-200",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">日次ハイライト</p>
                  <h4 className="text-base font-semibold">{highlight?.headline ?? "進捗情報を取得しています…"}</h4>
                </div>
                <span className="rounded-full bg-slate-900/40 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-300">
                  {loading ? "取得中" : source === "graphql" ? "API" : source === "rest" ? "REST" : source === "mock" ? "MOCK" : "待機中"}
                </span>
              </div>
              <ul className="space-y-2 text-sm leading-relaxed text-slate-100">
                {highlight?.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-sky-400" aria-hidden="true" />
                    <span>{bullet}</span>
                  </li>
                ))}
                {loading ? <li className="animate-pulse text-slate-400">AI ハイライトを解析しています…</li> : null}
              </ul>
              {error ? <p className="text-xs text-rose-300">データ取得に失敗しました: {error}</p> : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-wide text-slate-400">EVM スナップショット</p>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-[11px] text-slate-400">Planned Value</dt>
                    <dd className="font-mono text-sm">{insights?.metrics.evm.plannedValue.toLocaleString()} 円</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-400">Earned Value</dt>
                    <dd className="font-mono text-sm">{insights?.metrics.evm.earnedValue.toLocaleString()} 円</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-400">Actual Cost</dt>
                    <dd className="font-mono text-sm">{insights?.metrics.evm.actualCost.toLocaleString()} 円</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-400">CPI / SPI</dt>
                    <dd className="font-mono text-sm">
                      {insights ? insights.metrics.evm.cpi.toFixed(2) : "--"} / {insights ? insights.metrics.evm.spi.toFixed(2) : "--"}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[11px] text-slate-400">Variance</dt>
                    <dd className="font-mono text-sm">
                      CV {insights ? insights.metrics.evm.costVariance.toLocaleString() : "--"} 円 / SV{" "}
                      {insights ? insights.metrics.evm.scheduleVariance.toLocaleString() : "--"} 円
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-wide text-slate-400">バーンダウン進捗</p>
                <p className="mt-1 text-xs text-slate-400">
                  {burndownTrend === "ahead" ? "予定より完了量が進んでいます。" : burndownTrend === "behind" ? "計画線より遅れ気味です。" : "計画ラインに沿って進行中。"}
                </p>
                <table className="mt-3 w-full table-fixed border-collapse text-xs">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="w-1/3 border-b border-slate-700 pb-1 text-left font-medium">期間</th>
                      <th className="w-1/3 border-b border-slate-700 pb-1 text-right font-medium">計画</th>
                      <th className="w-1/3 border-b border-slate-700 pb-1 text-right font-medium">実績</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights?.metrics.burndown.labels.map((label, index) => (
                      <tr key={label} className="border-b border-slate-800 text-slate-200">
                        <td className="py-1">{label}</td>
                        <td className="py-1 text-right">{insights.metrics.burndown.planned[index]?.toFixed(0)}</td>
                        <td className="py-1 text-right">{insights.metrics.burndown.actual[index]?.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">今後の主なタスク</p>
            <ul className="space-y-2 text-sm text-slate-100">
              {insights?.timeline.tasks.slice(0, 5).map((task) => (
                <li key={task.id} className="flex flex-col rounded border border-slate-700 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-50">{task.name}</span>
                    <span className={clsx("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide", statusBadge[task.status] ?? "bg-slate-700 text-slate-200")}>
                      {task.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {task.startDate} → {task.endDate} {task.phase ? `（${task.phase}）` : ""}
                  </p>
                </li>
              ))}
              {insights && insights.timeline.tasks.length === 0 ? <li className="text-xs text-slate-400">タイムラインに未登録のタスクがあります。</li> : null}
            </ul>

            <div className="rounded border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-200">
              <p className="text-xs uppercase tracking-wide text-slate-400">リスクサマリ</p>
              <ul className="mt-2 space-y-2">
                {insights?.metrics.risks.slice(0, 5).map((risk) => (
                  <li key={risk.id} className="rounded border border-slate-700/70 bg-slate-800/70 p-2">
                    <p className="text-xs text-slate-400">
                      影響 {risk.impact} / 確率 {risk.probability}
                    </p>
                    <p className="font-medium text-slate-100">{risk.status}</p>
                  </li>
                ))}
                {insights && insights.metrics.risks.length === 0 ? <li className="text-xs text-slate-400">登録されたリスクはありません。</li> : null}
              </ul>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
});
