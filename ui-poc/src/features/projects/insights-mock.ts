import type { ProjectInsights } from "./types";

export const mockProjectInsights: Record<string, ProjectInsights> = {
  "PRJ-1001": {
    timeline: {
      projectId: "PRJ-1001",
      chatSummary: "主要タスクは計画通り進捗。今週はデータ連携の統合作業を完了し、来週から UAT に入ります。",
      chatSummaryLanguage: "ja",
      metrics: {
        plannedValue: 1_200_000,
        earnedValue: 1_080_000,
        actualCost: 950_000,
        costVariance: 130_000,
        scheduleVariance: -120_000,
        cpi: 1.14,
        spi: 0.90,
      },
      phases: [
        { id: "phase-plan", name: "計画", sortOrder: 1 },
        { id: "phase-build", name: "構築", sortOrder: 2 },
        { id: "phase-uat", name: "UAT", sortOrder: 3 },
        { id: "phase-deploy", name: "リリース", sortOrder: 4 },
      ],
      tasks: [
        {
          id: "task-101",
          name: "要件レビュー",
          phase: "計画",
          startDate: "2025-04-01",
          endDate: "2025-04-19",
          status: "done",
        },
        {
          id: "task-102",
          name: "基盤設計",
          phase: "構築",
          startDate: "2025-04-20",
          endDate: "2025-05-12",
          status: "inProgress",
        },
        {
          id: "task-103",
          name: "データ連携テスト",
          phase: "構築",
          startDate: "2025-05-13",
          endDate: "2025-05-25",
          status: "inProgress",
        },
        {
          id: "task-104",
          name: "性能テスト準備",
          phase: "UAT",
          startDate: "2025-05-26",
          endDate: "2025-06-03",
          status: "todo",
        },
      ],
    },
    metrics: {
      projectId: "PRJ-1001",
      evm: {
        plannedValue: 1_200_000,
        earnedValue: 1_080_000,
        actualCost: 950_000,
        costVariance: 130_000,
        scheduleVariance: -120_000,
        cpi: 1.14,
        spi: 0.90,
      },
      burndown: {
        labels: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"],
        planned: [100, 80, 60, 40, 20],
        actual: [100, 85, 70, 55, 35],
      },
      risks: [
        { id: "risk-1", probability: 4, impact: 4, status: "監視中" },
        { id: "risk-2", probability: 2, impact: 5, status: "緩和中" },
      ],
    },
  },
};

const defaultInsight: ProjectInsights = mockProjectInsights["PRJ-1001"] ?? {
  timeline: {
    projectId: "mock-project",
    chatSummary: "最新の更新はありませんが、計画通り進行しています。",
    chatSummaryLanguage: "ja",
    metrics: {
      plannedValue: 1_000_000,
      earnedValue: 950_000,
      actualCost: 900_000,
      costVariance: 50_000,
      scheduleVariance: -80_000,
      cpi: 1.06,
      spi: 0.92,
    },
    phases: [],
    tasks: [],
  },
  metrics: {
    projectId: "mock-project",
    evm: {
      plannedValue: 1_000_000,
      earnedValue: 950_000,
      actualCost: 900_000,
      costVariance: 50_000,
      scheduleVariance: -80_000,
      cpi: 1.06,
      spi: 0.92,
    },
    burndown: {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      planned: [100, 75, 50, 25],
      actual: [100, 80, 55, 30],
    },
    risks: [],
  },
};

export function getMockProjectInsights(projectId: string): ProjectInsights {
  return mockProjectInsights[projectId] ?? {
    timeline: {
      ...defaultInsight.timeline,
      projectId,
    },
    metrics: {
      ...defaultInsight.metrics,
      projectId,
    },
  };
}
