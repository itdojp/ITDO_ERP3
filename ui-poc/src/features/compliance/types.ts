export type InvoiceStatus = "registered" | "pending" | "matched" | "flagged" | "archived";

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  registered: "登録済み",
  pending: "処理待ち",
  matched: "照合済み",
  flagged: "要確認",
  archived: "保管済み",
};

export type InvoiceAttachment = {
  id: string;
  kind: "pdf" | "image" | "xml";
  fileName: string;
  mimeType: string;
  sizeLabel: string;
  previewNote?: string;
};

export type InvoiceRecord = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  counterpartyName: string;
  counterpartyNumber?: string;
  subject: string;
  amountIncludingTax: number;
  amountExcludingTax: number;
  currency: string;
  status: InvoiceStatus;
  tags: string[];
  remarks?: string;
  matchedPurchaseOrder?: string;
  attachments: InvoiceAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type InvoiceSortKey = "issueDate" | "updatedAt" | "amount";

export type InvoiceListMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sortBy: InvoiceSortKey;
  sortDir: "asc" | "desc";
  fetchedAt: string;
  fallback: boolean;
};

export type InvoiceListResponse = {
  items: InvoiceRecord[];
  meta: InvoiceListMeta;
};

export type InvoiceSearchFormState = {
  keyword: string;
  status: InvoiceStatus | "all";
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
};
