import type { ProjectListResponse } from "./types";

export const mockProjects: ProjectListResponse = {
  items: [
    {
      id: "PRJ-1001",
      code: "DX-2025-01",
      name: "DX推進プロジェクト",
      clientName: "Acme Corp",
      status: "active",
      startOn: "2025-04-01",
      manager: "山田太郎",
      health: "green",
      tags: ["DX", "Priority"],
    },
    {
      id: "PRJ-1002",
      code: "OPS-BCP",
      name: "BCP整備プログラム",
      clientName: "Internal",
      status: "onhold",
      startOn: "2025-05-10",
      health: "yellow",
      tags: ["Risk", "Compliance"],
    },
    {
      id: "PRJ-1003",
      code: "SAP-ROLL",
      name: "SAPロールアウトフェーズ2",
      clientName: "Itdo Manufacturing",
      status: "planned",
      startOn: "2025-11-01",
      health: "green",
      tags: ["SAP", "Rollout"],
    },
    {
      id: "PRJ-1004",
      code: "AMS-2024",
      name: "アプリ保守2024",
      clientName: "Acme Corp",
      status: "closed",
      startOn: "2024-01-01",
      endOn: "2024-12-31",
      health: "green",
      tags: ["AMS"],
    },
  ],
  meta: {
    total: 4,
    fetchedAt: new Date("2024-09-30T09:00:00+09:00").toISOString(),
    fallback: true,
  },
};
