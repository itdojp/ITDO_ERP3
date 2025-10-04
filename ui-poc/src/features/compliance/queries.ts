export const COMPLIANCE_INVOICES_QUERY = `
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
