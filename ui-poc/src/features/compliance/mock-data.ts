import type { InvoiceListResponse, InvoiceRecord, InvoiceSearchFormState, InvoiceStatus } from "./types";

const baseDate = new Date("2024-09-30T09:00:00+09:00");

const items: InvoiceRecord[] = [
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

export const mockInvoices: InvoiceListResponse = {
  items,
  meta: {
    total: items.length,
    fetchedAt: baseDate.toISOString(),
    fallback: true,
  },
};

export function searchMockInvoices(filters: InvoiceSearchFormState): InvoiceRecord[] {
  const minAmount = Number.parseFloat(filters.minAmount);
  const maxAmount = Number.parseFloat(filters.maxAmount);
  const hasMin = Number.isFinite(minAmount);
  const hasMax = Number.isFinite(maxAmount);
  const keyword = filters.keyword.trim().toLowerCase();

  return mockInvoices.items.filter((invoice) => {
    if (filters.status !== "all" && invoice.status !== filters.status) {
      return false;
    }

    if (filters.startDate && invoice.issueDate < filters.startDate) {
      return false;
    }
    if (filters.endDate && invoice.issueDate > filters.endDate) {
      return false;
    }

    if (hasMin && invoice.amountIncludingTax < minAmount) {
      return false;
    }
    if (hasMax && invoice.amountIncludingTax > maxAmount) {
      return false;
    }

    if (keyword) {
      const haystack = [
        invoice.invoiceNumber,
        invoice.counterpartyName,
        invoice.counterpartyNumber ?? "",
        invoice.subject,
        invoice.remarks ?? "",
        invoice.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }

    return true;
  });
}

export function statusOptions(): Array<{ value: InvoiceStatus | "all"; label: string }> {
  return [
    { value: "all", label: "すべて" },
    { value: "registered", label: "登録済み" },
    { value: "pending", label: "処理待ち" },
    { value: "matched", label: "照合済み" },
    { value: "flagged", label: "要確認" },
    { value: "archived", label: "保管済み" },
  ];
}
