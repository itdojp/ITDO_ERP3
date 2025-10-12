import fs from 'node:fs/promises';
import path from 'node:path';
import mjml2html from 'mjml';

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amountCents?: number;
}

export interface InvoicePayload {
  invoiceNumber: string;
  contractCode: string;
  billingPeriod: string;
  lines: InvoiceLine[];
}

function toCents(value: number) {
  return Math.round(value * 100);
}

function formatCurrency(cents: number) {
  return (cents / 100).toFixed(2);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function generateInvoiceHtml(payload: InvoicePayload) {
  const templatePath = path.resolve(__dirname, '../../templates/billing/invoice.mjml');
  const template = await fs.readFile(templatePath, 'utf-8');

  const linesWithAmounts = payload.lines.map((line) => {
    const amountCents = line.amountCents ?? toCents(line.quantity * line.unitPrice);
    return {
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: toCents(line.unitPrice),
      amountCents,
    };
  });

  const lineRows = linesWithAmounts
    .map(
      (line) => `          <tr>
            <td>${escapeHtml(line.description)}</td>
            <td align="right">${line.quantity}</td>
            <td align="right">${formatCurrency(line.unitPriceCents)}</td>
            <td align="right">${formatCurrency(line.amountCents)}</td>
          </tr>`
    )
    .join('\n');

  const totalCents = linesWithAmounts.reduce((sum, line) => sum + line.amountCents, 0);

  const replacements: Record<string, string> = {
    invoiceNumber: payload.invoiceNumber,
    contractCode: payload.contractCode,
    billingPeriod: payload.billingPeriod,
    total: formatCurrency(totalCents),
    lineRows,
  };

  let compiled = template;
  for (const [key, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`{{${key}}}`, 'g');
    compiled = compiled.replace(pattern, value);
  }

  const rendered = mjml2html(compiled, { validationLevel: 'soft' });
  if (rendered.errors.length) {
    throw new Error(rendered.errors.map((err) => err.formattedMessage).join('\n'));
  }
  return rendered.html;
}
