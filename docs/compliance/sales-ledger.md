# 販売管理モジュール 電子帳簿法対応ガイド

Issue #296 / #159 における販売管理モジュールの電子帳簿法要件を整理します。与信・見積・受注データを改ざん防止しつつ、検索性・保存性を確保することを目的とします。

## 1. 対象帳簿
| 区分 | 対象データ | 保存期間 | 補足 |
|------|-------------|-----------|------|
| 見積書 | Quote / QuoteItem | 7 年 | CSV / PDF 出力両対応 |
| 受注記録 | Order / OrderAuditLog | 7 年 | 与信ログ含む |
| 与信稟議 | CreditReview | 7 年 | 署名付き PDF を S3 保存 |

## 2. 保管ポリシー
- S3 バケット: `itdo-erp3-sales-ledger-${env}` を用意し、SSE-KMS 暗号化
- バージョニング + MFA Delete を有効化
- OrderAuditLog は KMS 署名付きハッシュ (`kms_sign`) を保持し、DB と S3 の整合性チェックを週次で実施

## 3. 検索要件
- 登録日・取引先・金額帯でフィルタリング可能にする (`/api/v1/sales/orders?from=...`)
- 監査対応のため 2 秒以内に検索結果を返却することを SLA とする
- Quote / Order の PDF は S3 オブジェクトキーを付与し、CLI (`scripts/compliance/export-ledger.js`) 経由で一括取得

## 4. 電子取引データの真正性確保
- OrderAuditLog へ改ざん検知コード (`hash = sha256(payload + nonce)`) を保存
- 重要なステータス変更時に Slack 通知 + PagerDuty をトリガ
- 監査時は `docs/compliance/electronic-ledger-runbook.md` の手順に従い、Sales Ops が報告書を提出

## 5. 運用チェックリスト
- [ ] S3 バケットと KMS Key の IaC を Terraform で管理
- [ ] CloudWatch メトリクス `CreditPendingCount` / `QuoteApprovedCount` を監視し、アラートを Slack (#finance-alerts) へ送信
- [ ] 週次で監査ログ整合性を検証 (`npm run audit:sales-ledger` ※要実装)
- [ ] 取引先マスタの変更時、電子帳簿法影響確認を PM へエスカレーション
- [ ] 年次で保管期間満了データを Glacier へ移行
