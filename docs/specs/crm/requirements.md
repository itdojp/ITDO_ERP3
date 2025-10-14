# CRM モジュール要件定義

Issue #295 / #159 に基づき、Phase2 で実装する CRM モジュールの詳細要件を整理します。顧客・案件情報の 360° ビューを提供し、会話要約 AI と連携できることをゴールとします。

## 1. ユースケース
- 顧客マスタ管理（法人／拠点／担当者）
- 案件ライフサイクル管理（リード→案件→受注）
- コンタクト履歴の集約と会話要約の参照
- タグ／スコアリングによる優先度付け
- KPI ダッシュボードへの指標提供（獲得率・活性度など）

## 2. エンティティとリレーション
| エンティティ | 主な属性 | 備考 |
|--------------|----------|------|
| Customer | id, name, type, industry, ownerUserId, tagsJson | タグは JSON 文字列（SQLite 互換）。本番では pgvector + JSONB へ移行予定 |
| Contact | id, customerId, name, role, email, phone | 顧客担当者。Slack/Meet 等の識別子も保持 |
| Opportunity | id, customerId, title, stage, amount, expectedClose | 案件フェーズ（Lead/Qualified/Proposal/Negotiation/Won/Lost） |
| InteractionNote | id, customerId, contactId?, occurredAt, channel, rawText | 会話ログの原文保存。要約は AI 側で付随 |
| ConversationSummary | id, interactionId, embedding, summaryText, followupSuggestedJson | LangGraph で生成した要約。フォローアップは JSON 文字列で保持 |

リレーション:
- Customer 1 - n Contact / Opportunity / InteractionNote
- InteractionNote 1 - 1 ConversationSummary

## 3. API / GraphQL スキーマ草案
```graphql
# Query
customers(filter: CustomerFilter): [Customer!]
customer(id: ID!): Customer
opportunities(filter: OpportunityFilter): [Opportunity!]

# Mutation
createCustomer(input: CreateCustomerInput!): Customer!
updateCustomer(id: ID!, input: UpdateCustomerInput!): Customer!
createOpportunity(input: CreateOpportunityInput!): Opportunity!

# Conversation
conversationSummaries(customerId: ID!, limit: Int = 20): [ConversationSummary!]
```

REST エンドポイント：
- `GET /api/v1/crm/customers` (search/type/industry クエリパラメータ対応)
- `POST /api/v1/crm/customers`
- `PATCH /api/v1/crm/customers/:id`
- `GET /api/v1/crm/customers/:id/opportunities`
- `POST /api/v1/crm/opportunities`
- `POST /api/v1/crm/interaction-notes`

## 4. バリデーション / ビジネスルール
- 顧客名 + 担当者の組合せで重複登録を防止
- 案件金額は通貨単位 (JPY/USD/EUR) と精度 2 を保持
- InteractionNote の rawText は最長 16,000 文字、PII マスキングは後段で対応
- ConversationSummary の followupSuggested は最大 5 件

## 5. 非機能要件
- pgvector を利用して ConversationSummary.embedding を格納し、会話検索を最適化（SQLite では TEXT, 本番は pgvector）
- 監査ログ (customer.created/updated, opportunity.stageChanged) を既存監査ストリームへ発行
- 1 分毎のバッチ連携（外部チャット統合）を想定し、API タイムアウトは 5 秒以下

## 6. AI 連携とスタブ
- `shared/ai/conversation` にスタブを配置し、LangGraph 経由で会話要約を取得するインターフェースを定義
- フェーズ初期はモック結果を返却し、OpenAI 接続は Feature Flag で切替える

## 7. qa/ops テスト
- `npm run lint --workspace services/project-api` を通過させる
- `jest` でスキャフォールド後のユニットテストを追加予定（現時点ではプレースホルダ）

## 8. AI DevFlow バリデーション
- Spec 作成 → `node scripts/templates/create-module.js --type nest-module --name crm --target services/project-api/src/crm`
- `npx eslint src/crm src/sales` で新規モジュールの整合性を確認（プロジェクト全体 lint は別 Issue で追跡）
- `2025-10-14` 時点で CRM / Sales モジュール配下は lint OK。全体 lint の修正は別 Issue で追跡

## 9. 未決事項
- Customer スキーマのセグメント分類 (ARR/NRR) → Finance チームと連携予定
- ConversationSummary の保管期間（90 日 or 180 日）を法務へ確認
- 外部チャット統合の Webhook 仕様の最終決定
