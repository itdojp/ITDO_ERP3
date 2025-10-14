# 販売管理モジュール要件定義

Issue #296 / #159 の範囲として、見積・受注・与信フローをカバーする販売管理モジュールの要件を整理します。Phase2 Sprint6 の着手を想定しています。

## 1. ユースケース
- 見積作成・版管理・承認ワークフロー
- 受注登録と請求連携（契約モジュール／インボイス生成）
- 与信申請〜結果通知、リトライ処理
- 商談毎の原価／利益率トラッキング

## 2. エンティティ
| エンティティ | 主な属性 | 備考 |
|--------------|----------|------|
| Quote | id, quoteNumber, customerId, status, currency, totalAmount, validUntil, version | ステータス: DRAFT/PENDING_APPROVAL/APPROVED/REJECTED |
| QuoteItem | id, quoteId, productCode, quantity, unitPrice, discountRate | 金額は `REAL` (SQLite) / `NUMERIC(12,2)` (Postgres) |
| Order | id, orderNumber, quoteId, status, signedAt, paymentTerm | ステータス: Pending/Fulfilled/Cancelled |
| CreditReview | id, orderId, status, reviewerUserId, score, remarks | ステータス: Requested/Approved/Rejected |
| OrderAuditLog | id, orderId, changeType, payload, createdAt, checksum | 電子帳簿法対象。payload は JSON 文字列、checksum で改ざん検知 |

## 3. API / GraphQL
```graphql
# Query
quotes(filter: QuoteFilter): [Quote!]
orders(filter: OrderFilter): [Order!]

# Mutation
createQuote(input: CreateQuoteInput!): Quote!
submitQuote(id: ID!): Quote!
createOrder(input: CreateOrderInput!): Order!
approveCreditReview(orderId: ID!, input: ApproveCreditReviewInput!): CreditReview!
```

REST エンドポイント（初期案）:
- `POST /api/v1/sales/quotes`
- `POST /api/v1/sales/quotes/{id}/submit`
- `POST /api/v1/sales/orders`
- `POST /api/v1/sales/orders/{id}/credit-review`

## 4. ビジネスルール
- 見積の合計金額は QuoteItem 単価・数量・割引率から算出し、Order 作成時に確定
- 与信未承認の受注は請求モジュールへ伝播させない Feature Flag を導入
- OrderAuditLog は KMS 署名付きで保存し、7 年保管
- Quote → Order の変換で版履歴を残し、再承認が必要

## 5. 非機能 / インテグレーション
- Terraform Stack `iac/terraform/sales-monitoring` で CloudWatch メトリクス + Slack 通知（`QuoteCreatedCount` / `OrderCreatedCount` / `CreditPendingCount` を監視）
- 環境変数 `SALES_METRICS_ENABLED`, `SALES_METRICS_NAMESPACE`, `SALES_METRICS_ENV` を用意し、CloudWatch メトリクス送信を制御する
- Electron Ledger 対応のため `docs/compliance/sales-ledger.md` で運用ポリシーを定義
- GitHub Actions で sales モジュールのスモークテストを追加（#299で補完）

## 6. AI 連携
- 過去の Quote を元に AI がテンプレート提案（LangGraph の Retrieval Chain）
- 与信リスク評価を OpenAI Function Calling でスコアリング、CreditReview.score に保存
- 生成結果は Sales Ops チームがレビューし、Feedback Loop で学習

## 7. Dry-run
- `node scripts/templates/create-module.js --type nest-module --name sales --target services/project-api/src/sales`
- `npx eslint src/sales` を実行し、コードスタイルを検証（プロジェクト全体 lint は別 Issue で対応）
- Terraform テンプレートから `iac/terraform/sales-monitoring` を生成。ローカルに Terraform CLI が無いため `terraform fmt` は CI で検証予定

## 8. 未確定事項
- 与信外部サービスの最終選定（AWS Marketplace vs 自社）
- 電子帳簿法ログのバックアップ戦略（S3 Glacier Deep Archive）
- Slack 通知チャネル：CloudWatch アラートは `#sales-ops-alerts`、リリース実況・KPI 共有は `#sales-ops`
