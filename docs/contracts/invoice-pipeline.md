# 請求書生成パイプライン (PoC)

## フロー概要
1. DocuSign から Webhook (`/billing/docusign/webhook`) を受信
2. 契約イベント (`SIGNED` / `ACTIVATED` など) を `ContractAutomationService` に渡す
3. `InvoiceQueueService` がジョブを直列実行し、`InvoiceProcessorService` で以下を実施
   - MJML → HTML → PDF (pdfkit) で請求書を生成
   - `INVOICE_S3_BUCKET` が設定されていれば S3 へアップロード (バージョン確認)
   - Fallback としてローカル (`INVOICE_OUTPUT_DIR`) へ保存
   - `INVOICE_EMAIL_FROM` / `INVOICE_EMAIL_RECIPIENT` が設定されていれば AWS SES で通知メールを送信
4. すべての処理結果は NestJS ログ + Datadog メトリクスに送出

## ローカル検証
```bash
# 契約イベントを手動投入
curl -X POST http://localhost:3000/billing/contracts/events \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "SIGNED",
    "contractId": "demo-001",
    "contractCode": "DEMO-001",
    "customerEmail": "billing@example.com"
  }'

# 失敗後にバックフィル実行
node scripts/billing/replay-invoice.js \
  --project demo-001 \
  --code DEMO-001 \
  --event SIGNED \
  --base-url http://localhost:3000 \
  --dry-run
```

- `INVOICE_OUTPUT_DIR` (既定 `logs/invoices`) に PDF/HTML が生成されます。
- S3 / SES を利用する場合は `.env` に対応する環境変数を設定してください。

## 監視とアラート
- Datadog: `billing.invoice.success`, `billing.invoice.failure`, `billing.invoice.duration_ms`, `billing.invoice.email.success`
- CloudWatch (新規モジュール `iac/modules/billing-monitoring`):
  - Invoice Failure Alarm (`BillingInvoiceFailure`)
  - DocuSign Webhook Error Alarm (`DocuSignWebhookError`)
  - ダッシュボード `billing-invoice-operations`

## 障害対応
1. **DocuSign webhook 失敗**: CloudWatch アラーム発火 → 再試行 (Webhook 再送 or CLI `replay-invoice`).
2. **請求ジョブ失敗**: Datadog メトリクス `billing.invoice.failure` を確認し、`scripts/billing/replay-invoice.js` でリプレイ。
3. **メール送信失敗**: `billing.invoice.email.success` が上がらない場合、SES 権限や送信未認証アドレスを確認。
4. **S3 保存失敗**: CloudWatch Logs で `aws:s3` エラーを確認、`INVOICE_OUTPUT_DIR` にフォールバックしているか確認。

Runbook の当番手順:
- 失敗イベントが Slack に通知された場合、`replay-invoice.js --dry-run` でペイロードを確認し再送。
- 連続失敗時は `INVOICE_OUTPUT_DIR` にエラーログ (`invoice-processor` logger) が出力されるので確認。
