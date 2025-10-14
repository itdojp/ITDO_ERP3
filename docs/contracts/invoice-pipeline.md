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
```

- `INVOICE_OUTPUT_DIR` (既定 `logs/invoices`) に PDF/HTML が生成されます。
- S3 / SES を利用する場合は `.env` に対応する環境変数を設定してください。
