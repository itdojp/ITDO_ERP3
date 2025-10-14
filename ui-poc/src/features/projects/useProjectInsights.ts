import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, graphqlRequest } from "@/lib/api-client";
import { PROJECT_INSIGHTS_QUERY } from "./queries";
import { getMockProjectInsights } from "./insights-mock";
import type { BurndownSeries, ProjectInsights, ProjectMetrics, ProjectTimeline } from "./types";

type InsightSource = "graphql" | "rest" | "mock" | "idle";

type HighlightSummary = {
  severity: "good" | "warning" | "critical";
  headline: string;
  bullets: string[];
};

type HookState = {
  loading: boolean;
  source: InsightSource;
  error: string | null;
  insights: ProjectInsights | null;
  highlight: HighlightSummary | null;
};

const initialState: HookState = {
  loading: false,
  source: "idle",
  error: null,
  insights: null,
  highlight: null,
};

function deriveHighlight(insights: ProjectInsights): HighlightSummary {
  const {
    metrics: {
      evm: { cpi, spi, costVariance, scheduleVariance },
      risks,
    },
    timeline,
  } = insights;

  const bullets: string[] = [];
  let severity: HighlightSummary["severity"] = "good";

  if (timeline.chatSummary) {
    bullets.push(timeline.chatSummary);
  }

  const cpiRounded = Number(cpi.toFixed(2));
  const spiRounded = Number(spi.toFixed(2));
  bullets.push(`CPI: ${cpiRounded} / SPI: ${spiRounded}`);

  if (cpiRounded < 1 || spiRounded < 1) {
    severity = cpiRounded < 0.95 || spiRounded < 0.9 ? "critical" : "warning";
  } else if (cpiRounded >= 1.05 && spiRounded >= 1.05) {
    bullets.push("コスト効率と進捗が計画を上回っています。");
  }

  if (scheduleVariance < 0) {
    bullets.push(`スケジュール遅延: ${Math.abs(scheduleVariance).toLocaleString()} 円相当の遅れ`);
    severity = severity === "good" ? "warning" : severity;
  } else if (scheduleVariance > 0) {
    bullets.push("スケジュールは前倒しで進行しています。");
  }

  if (costVariance < 0) {
    bullets.push("コストが計画を上回っています。追加の原価精査が必要です。");
    severity = "warning";
  }

  const highRisks = risks.filter((risk) => risk.probability >= 4 && risk.impact >= 4);
  if (highRisks.length > 0) {
    highRisks.forEach((risk) => {
      bullets.push(`高リスク (${risk.status}) — 影響:${risk.impact}/確率:${risk.probability}`);
    });
    severity = "critical";
  } else if (risks.length > 0) {
    bullets.push(`リスク登録件数: ${risks.length} 件`);
  }

  const headline =
    severity === "critical"
      ? "⚠️ 重要なリスクと遅延に注意が必要です"
      : severity === "warning"
        ? "⚠️ 軽微な遅延やコスト超過が発生しています"
        : "✅ 計画どおりに進行しています";

  return { severity, headline, bullets: Array.from(new Set(bullets)) };
}

async function fetchFromGraphQL(projectId: string) {
  const data = await graphqlRequest<{ timeline: ProjectTimeline; metrics: ProjectMetrics }>({
    query: PROJECT_INSIGHTS_QUERY,
    variables: { projectId },
  });
  return {
    data: { timeline: data.timeline, metrics: data.metrics } satisfies ProjectInsights,
    source: "graphql" as const,
  };
}

async function fetchFromRest(projectId: string) {
  const [timeline, metrics] = await Promise.all([
    apiRequest<ProjectTimeline>({ path: `/api/v1/projects/${projectId}/timeline` }),
    apiRequest<ProjectMetrics>({ path: `/api/v1/projects/${projectId}/metrics` }),
  ]);
  return {
    data: { timeline, metrics } satisfies ProjectInsights,
    source: "rest" as const,
  };
}

export function useProjectInsights(projectId: string | null) {
  const [state, setState] = useState<HookState>(initialState);
  const projectRef = useRef<string | null>(projectId);

  const executeFetch = useCallback(async () => {
    if (!projectId) {
      setState(initialState);
      projectRef.current = null;
      return;
    }
    projectRef.current = projectId;
    setState((prev) => ({ ...prev, loading: true, error: null, source: prev.source === "idle" ? "idle" : prev.source }));

    const computeResult = (insights: ProjectInsights, source: InsightSource) => {
      const highlight = deriveHighlight(insights);
      setState({
        loading: false,
        error: null,
        insights,
        highlight,
        source,
      });
    };

    try {
      const { data, source } = await fetchFromGraphQL(projectId);
      computeResult(data, source);
      return;
    } catch (graphErr) {
      console.warn("[project-insights] GraphQL fetch failed", graphErr);
    }

    try {
      const { data, source } = await fetchFromRest(projectId);
      computeResult(data, source);
      return;
    } catch (restErr) {
      console.warn("[project-insights] REST fallback failed", restErr);
    }

    const mock = getMockProjectInsights(projectId);
    computeResult(mock, "mock");
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await executeFetch();
    };
    run().catch((error) => {
      if (cancelled) {
        return;
      }
      console.error("[project-insights] unexpected error", error);
      const mock = projectId ? getMockProjectInsights(projectId) : null;
      setState({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        insights: mock,
        highlight: mock ? deriveHighlight(mock) : null,
        source: mock ? "mock" : "idle",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [executeFetch, projectId]);

  const refresh = useCallback(() => {
    void executeFetch();
  }, [executeFetch]);

  const burndownTrend = useMemo(() => {
    const series: BurndownSeries | undefined = state.insights?.metrics?.burndown;
    if (!series) {
      return null;
    }
    const lastActual = series.actual.at(-1);
    const lastPlanned = series.planned.at(-1);
    if (lastActual == null || lastPlanned == null) {
      return null;
    }
    const delta = lastActual - lastPlanned;
    if (Math.abs(delta) < 5) {
      return "on-track";
    }
    return delta > 0 ? "behind" : "ahead";
  }, [state.insights]);

  return {
    ...state,
    refresh,
    burndownTrend,
  };
}
