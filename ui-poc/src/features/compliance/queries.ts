export const COMPLIANCE_INVOICES_QUERY = `#graphql
  query ComplianceInvoices($filter: ComplianceInvoiceFilterInput) {
    complianceInvoices(filter: $filter) {
      items {
        id
        invoiceNumber
        counterpartyName
        issueDate
        dueDate
        amountIncludingTax
        status
        tags
        matchedPurchaseOrder
        attachments {
          id
          fileName
          fileType
          downloadUrl
          storageKey
        }
        createdAt
        updatedAt
      }
      meta {
        total
        page
        pageSize
        totalPages
        sortBy
        sortDir
        fetchedAt
        fallback
      }
    }
  }
`;

export const COMPLIANCE_INVOICES_QUERY_LIVE = `#graphql
  query ComplianceInvoicesLive(
    $status: String
    $keyword: String
    $startDate: String
    $endDate: String
    $minAmount: Float
    $maxAmount: Float
    $page: Int
    $pageSize: Int
    $sortBy: String
    $sortDir: String
  ) {
    complianceInvoices(
      filter: {
        status: $status
        keyword: $keyword
        startDate: $startDate
        endDate: $endDate
        minAmount: $minAmount
        maxAmount: $maxAmount
        page: $page
        pageSize: $pageSize
        sortBy: $sortBy
        sortDir: $sortDir
      }
    ) {
      items {
        id
        invoiceNumber
        counterpartyName
        issueDate
        dueDate
        amountIncludingTax
        status
        matchedPurchaseOrder
        attachments {
          id
          fileName
          fileType
          downloadUrl
        }
      }
      meta {
        total
        page
        pageSize
        totalPages
        sortBy
        sortDir
        fallback
      }
    }
  }
`;

export type ComplianceInvoiceFilterVariables = {
  keyword?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};
