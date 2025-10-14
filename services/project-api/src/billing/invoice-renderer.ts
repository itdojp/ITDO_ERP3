import fs from 'node:fs/promises';
import path from 'node:path';
import mjml2html from 'mjml';
import PDFDocument from 'pdfkit';

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
  const templatePath = path.resolve(__dirname, '../../../../templates/billing/invoice.mjml');
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
    throw new Error(rendered.errors.map((err: { formattedMessage: string }) => err.formattedMessage).join('\n'));
  }
  return rendered.html;
}

export async function generateInvoicePdf(payload: InvoicePayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(20).text(`Invoice ${payload.invoiceNumber}`, { align: 'right' }).moveDown();
    doc.fontSize(12).text(`Contract: ${payload.contractCode}`);
    doc.text(`Billing Period: ${payload.billingPeriod}`).moveDown();

    const tableTop = doc.y + 10;
    const descriptionX = 50;
    const quantityX = 280;
    const unitPriceX = 350;
    const amountX = 440;

    doc.font('Helvetica-Bold');
    doc.text('Description', descriptionX, tableTop);
    doc.text('Qty', quantityX, tableTop, { width: 50, align: 'right' });
    doc.text('Unit Price', unitPriceX, tableTop, { width: 70, align: 'right' });
    doc.text('Amount', amountX, tableTop, { width: 80, align: 'right' });
    doc.moveTo(descriptionX, tableTop + 15).lineTo(520, tableTop + 15).stroke();

    doc.font('Helvetica');
    let cursorY = tableTop + 25;
    const linesWithAmounts = payload.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amountCents ?? toCents(line.quantity * line.unitPrice),
    }));

    for (const line of linesWithAmounts) {
      doc.text(line.description, descriptionX, cursorY, { width: 200 });
      doc.text(String(line.quantity), quantityX, cursorY, { width: 50, align: 'right' });
      doc.text(formatCurrency(toCents(line.unitPrice)), unitPriceX, cursorY, { width: 70, align: 'right' });
      doc.text(formatCurrency(line.amount), amountX, cursorY, { width: 80, align: 'right' });
      cursorY += 18;
    }

    const total = linesWithAmounts.reduce((sum, line) => sum + line.amount, 0);
    doc.moveTo(descriptionX, cursorY + 5).lineTo(520, cursorY + 5).stroke();
    doc.font('Helvetica-Bold');
    doc.text('Total', descriptionX, cursorY + 15, { width: 350, align: 'right' });
    doc.text(formatCurrency(total), amountX, cursorY + 15, { width: 80, align: 'right' });
    doc.end();
  });
}
