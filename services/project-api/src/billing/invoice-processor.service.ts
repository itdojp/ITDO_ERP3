import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetBucketVersioningCommand } from '@aws-sdk/client-s3';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { ContractEventPayload } from '../../../../shared/contracts/lifecycle';
import { generateInvoiceHtml, generateInvoicePdf, InvoicePayload } from './invoice-renderer';
import { DatadogMetricsService } from '../monitoring/datadog.service';

export interface InvoiceJob {
  contractId: string;
  contractCode: string;
  eventType: ContractEventPayload['type'];
  customerEmail?: string;
}

@Injectable()
export class InvoiceProcessorService {
  private readonly logger = new Logger(InvoiceProcessorService.name);
  private s3Client?: S3Client;
  private sesClient?: SESClient;
  private versioningChecked = false;

  constructor(private readonly config: ConfigService, private readonly metrics: DatadogMetricsService) {}

  async process(job: InvoiceJob) {
    const start = Date.now();
    const tags = [`contract:${job.contractCode}`, `event:${job.eventType}`];
    this.logger.log(`Processing invoice job for contract ${job.contractCode}`);
    try {
      const payload = this.buildInvoicePayload(job);
      const [html, pdf] = await Promise.all([generateInvoiceHtml(payload), generateInvoicePdf(payload)]);
      const objectKey = `${payload.contractCode}/invoice-${payload.invoiceNumber}.pdf`;
      const location = await this.persistInvoice(objectKey, pdf, html);
      if (job.customerEmail) {
        await this.dispatchEmail(job.customerEmail, payload.invoiceNumber, location);
      }
      this.metrics.increment('billing.invoice.success', 1, tags);
      const duration = Date.now() - start;
      this.metrics.timing('billing.invoice.duration_ms', duration, tags);
    } catch (error) {
      this.metrics.increment('billing.invoice.failure', 1, tags);
      this.logger.error(`Invoice processing failed for ${job.contractCode}`, error as Error);
      throw error;
    }
  }

  private buildInvoicePayload(job: InvoiceJob): InvoicePayload {
    const now = new Date();
    const invoiceNumber = `${job.contractCode}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${now.getDate()}`;
    return {
      invoiceNumber,
      contractCode: job.contractCode,
      billingPeriod: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      lines: [
        {
          description: `Contract event ${job.eventType}`,
          quantity: 1,
          unitPrice: 1200,
        },
      ],
    };
  }

  private async persistInvoice(key: string, pdf: Buffer, html: string): Promise<string> {
    const bucket = this.config.get<string>('INVOICE_S3_BUCKET');
    if (bucket) {
      this.ensureS3Client();
      if (!this.s3Client) {
        this.logger.warn('S3 client unavailable, skipping upload');
        return 's3://unavailable';
      }
      await this.ensureVersioning(bucket);
      const prefix = this.config.get<string>('INVOICE_S3_PREFIX') ?? '';
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: path.posix.join(prefix, key),
          Body: pdf,
          ContentType: 'application/pdf',
        }),
      );
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: path.posix.join(prefix, key.replace(/\.pdf$/, '.html')),
          Body: html,
          ContentType: 'text/html',
        }),
      );
      const location = `s3://${bucket}/${path.posix.join(prefix, key)}`;
      this.logger.log(`Stored invoice at ${location}`);
      return location;
    }

    const outputDir = this.config.get<string>('INVOICE_OUTPUT_DIR') ?? path.resolve(process.cwd(), 'logs/invoices');
    const pdfPath = path.join(outputDir, key);
    await fs.mkdir(path.dirname(pdfPath), { recursive: true });
    await fs.writeFile(pdfPath, pdf);
    await fs.writeFile(pdfPath.replace(/\.pdf$/, '.html'), html);
    const location = pdfPath;
    this.logger.log(`Stored invoice at ${location}`);
    return location;
  }

  private async dispatchEmail(recipient: string, invoiceNumber: string, location: string) {
    const from = this.config.get<string>('INVOICE_EMAIL_FROM');
    if (!from) {
      this.logger.warn('Email sender not configured, skipping SES dispatch');
      return;
    }
    this.ensureSesClient();
    if (!this.sesClient) {
      this.logger.warn('SES client unavailable, skipping email dispatch');
      return;
    }

    const subject = `Invoice ${invoiceNumber}`;
    const message = `Invoice ${invoiceNumber} is ready. Location: ${location}`;

    await this.sesClient.send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [recipient] },
        Message: {
          Subject: { Data: subject },
          Body: {
            Text: { Data: message },
          },
        },
      }),
    );
    this.metrics.increment('billing.invoice.email.success', 1, [`recipient:${recipient}`]);
  }

  private ensureS3Client() {
    if (this.s3Client) {
      return;
    }
    const region = this.config.get<string>('AWS_REGION') ?? process.env.AWS_REGION;
    if (!region) {
      return;
    }
    this.s3Client = new S3Client({ region });
  }

  private async ensureVersioning(bucket: string) {
    if (this.versioningChecked || !this.s3Client) {
      return;
    }
    try {
      const response = await this.s3Client.send(new GetBucketVersioningCommand({ Bucket: bucket }));
      if (response.Status !== 'Enabled') {
        this.logger.warn(`S3 bucket ${bucket} has versioning disabled. WORM compliance may not be satisfied.`);
      }
    } catch (error) {
      this.logger.warn(`Failed to verify versioning for bucket ${bucket}`, error as Error);
    }
    this.versioningChecked = true;
  }

  private ensureSesClient() {
    if (this.sesClient) {
      return;
    }
    const region = this.config.get<string>('AWS_REGION') ?? process.env.AWS_REGION;
    if (!region) {
      return;
    }
    this.sesClient = new SESClient({ region });
  }
}
