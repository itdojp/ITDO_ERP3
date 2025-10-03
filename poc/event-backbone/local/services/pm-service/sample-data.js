export const projectSeed = [
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
];

export const timesheetSeed = [
  {
    id: "TS-001",
    userName: "佐藤花子",
    employeeId: "EMP-1001",
    projectId: "PRJ-1001",
    projectCode: "DX-2025-01",
    projectName: "DX推進プロジェクト",
    taskName: "要件定義ワークショップ",
    workDate: "2025-09-12",
    hours: 7.5,
    approvalStatus: "submitted",
    submittedAt: "2025-09-12T18:05:00Z",
    note: "クライアントレビュー対応",
    rateType: "standard",
  },
  {
    id: "TS-002",
    userName: "鈴木次郎",
    employeeId: "EMP-1002",
    projectId: "PRJ-1001",
    projectCode: "DX-2025-01",
    projectName: "DX推進プロジェクト",
    taskName: "PoC実装",
    workDate: "2025-09-11",
    hours: 6,
    approvalStatus: "submitted",
    submittedAt: "2025-09-11T19:10:00Z",
    rateType: "overtime",
  },
  {
    id: "TS-003",
    userName: "田中太一",
    employeeId: "EMP-1003",
    projectId: "PRJ-1002",
    projectCode: "OPS-BCP",
    projectName: "BCP整備プログラム",
    taskName: "ドキュメント精査",
    workDate: "2025-09-10",
    hours: 8,
    approvalStatus: "rejected",
    note: "作業内容を詳細化してください",
    rateType: "standard",
  },
  {
    id: "TS-004",
    userName: "高橋優子",
    employeeId: "EMP-1004",
    projectId: "PRJ-1003",
    projectCode: "SAP-ROLL",
    projectName: "SAPロールアウトフェーズ2",
    taskName: "移行計画レビュー",
    workDate: "2025-09-09",
    hours: 4,
    approvalStatus: "approved",
    submittedAt: "2025-09-09T16:40:00Z",
    rateType: "standard",
  },
];

export const invoiceSeed = [
  {
    id: "inv-2024-0001",
    invoiceNumber: "INV-2024-0001",
    issueDate: "2024-09-25",
    dueDate: "2024-10-10",
    counterpartyName: "株式会社ライトニング",
    counterpartyNumber: "LGT-0098",
    subject: "9月度クラウド利用料",
    amountIncludingTax: 550000,
    amountExcludingTax: 500000,
    currency: "JPY",
    status: "matched",
    tags: ["AWS", "サブスクリプション"],
    remarks: "自動仕訳済み / ログID#241001-22",
    matchedPurchaseOrder: "PO-2024-222",
    attachments: [
      {
        id: "att-001",
        kind: "pdf",
        fileName: "INV-2024-0001.pdf",
        mimeType: "application/pdf",
        sizeLabel: "412KB",
        previewNote: "PDF プレビューはモック表示です",
      },
      {
        id: "att-002",
        kind: "xml",
        fileName: "INV-2024-0001.xml",
        mimeType: "application/xml",
        sizeLabel: "36KB",
      },
    ],
    createdAt: "2024-09-25T10:03:00+09:00",
    updatedAt: "2024-09-30T11:22:00+09:00",
  },
  {
    id: "inv-2024-0002",
    invoiceNumber: "INV-2024-0002",
    issueDate: "2024-09-28",
    dueDate: "2024-10-05",
    counterpartyName: "日本エネルギー販売株式会社",
    counterpartyNumber: "JPS-1204",
    subject: "9月分電力使用料",
    amountIncludingTax: 118800,
    amountExcludingTax: 108000,
    currency: "JPY",
    status: "flagged",
    tags: ["電力", "固定費"],
    remarks: "単価変動あり。原本確認要",
    attachments: [
      {
        id: "att-101",
        kind: "pdf",
        fileName: "INV-2024-0002.pdf",
        mimeType: "application/pdf",
        sizeLabel: "256KB",
      },
      {
        id: "att-102",
        kind: "image",
        fileName: "meter-reading.png",
        mimeType: "image/png",
        sizeLabel: "1.2MB",
        previewNote: "検針票サンプル画像",
      },
    ],
    createdAt: "2024-09-28T13:12:00+09:00",
    updatedAt: "2024-09-29T09:54:00+09:00",
  },
  {
    id: "inv-2024-0003",
    invoiceNumber: "INV-2024-0003",
    issueDate: "2024-08-31",
    dueDate: "2024-09-30",
    counterpartyName: "Global Devices Ltd.",
    counterpartyNumber: "GD-88",
    subject: "Laptop refresh program",
    amountIncludingTax: 1650000,
    amountExcludingTax: 1500000,
    currency: "JPY",
    status: "registered",
    tags: ["ハードウェア調達", "英語請求書"],
    remarks: "為替差損考慮。入庫確認待ち",
    attachments: [
      {
        id: "att-201",
        kind: "pdf",
        fileName: "INV-2024-0003.pdf",
        mimeType: "application/pdf",
        sizeLabel: "692KB",
      },
    ],
    createdAt: "2024-08-31T08:43:00+09:00",
    updatedAt: "2024-09-01T10:22:00+09:00",
  },
];

function parseAmount(value) {
  if (value === undefined || value === null) return null;
  const num = Number.parseFloat(String(value));
  return Number.isFinite(num) ? num : null;
}

export function filterInvoices(filters = {}, items = invoiceSeed) {
  const keyword = (filters.keyword || '').trim().toLowerCase();
  const status = filters.status && filters.status !== 'all' ? filters.status : null;
  const startDate = filters.startDate || filters.issued_from || null;
  const endDate = filters.endDate || filters.issued_to || null;
  const minAmount = parseAmount(filters.minAmount ?? filters.min_total ?? undefined);
  const maxAmount = parseAmount(filters.maxAmount ?? filters.max_total ?? undefined);

  return items.filter((invoice) => {
    if (status && invoice.status !== status) return false;
    if (startDate && invoice.issueDate < startDate) return false;
    if (endDate && invoice.issueDate > endDate) return false;
    if (minAmount !== null && invoice.amountIncludingTax < minAmount) return false;
    if (maxAmount !== null && invoice.amountIncludingTax > maxAmount) return false;
    if (!keyword) return true;
    const haystack = [
      invoice.invoiceNumber,
      invoice.counterpartyName,
      invoice.counterpartyNumber || '',
      invoice.subject,
      invoice.remarks || '',
      invoice.tags.join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(keyword);
  });
}
