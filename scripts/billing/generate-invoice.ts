import fs from 'node:fs/promises';
import path from 'node:path';
import mjml2html from 'mjml';

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoicePayload {
  invoiceNumber: string;
  contractCode: string;
  billingPeriod: string;
  lines: InvoiceLine[];
}

export async function generateInvoiceHtml(payload: InvoicePayload) {
  const templatePath = path.resolve(__dirname, '../../templates/billing/invoice.mjml');
  const template = await fs.readFile(templatePath, 'utf-8');
  const total = payload.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const compiled = template
    .replace('{{invoiceNumber}}', payload.invoiceNumber)
    .replace('{{contractCode}}', payload.contractCode)
    .replace('{{billingPeriod}}', payload.billingPeriod)
    .replace('{{total}}', total.toFixed(2));
  const rendered = mjml2html(compiled, { validationLevel: 'soft' });
  if (rendered.errors.length) {
    throw new Error(rendered.errors.map((err) => err.formattedMessage).join('\n'));
  }
  return rendered.html;
}
