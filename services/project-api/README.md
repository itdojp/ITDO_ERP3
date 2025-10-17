# Project API (NestJS)

Project API は ITDO ERP3 のプロジェクト管理・チャット連携の試験実装です。NestJS を用いた REST / GraphQL ハイブリッド構成となっており、以下の機能を提供します。

- プロジェクト一覧と Earned Value Management (EVM) 指標の取得
- プロジェクトの新規作成
- プロジェクトタイムラインとチャット要約の取得
- バーンダウンチャートとリスクサマリを含むメトリクスの取得
- Slack / Teams スレッドのプロビジョニング
- OpenAI ベースのチャット要約（再試行・多言語切替・ベクトル保存・Datadog メトリクス連携）
- DocuSign Webhook / 契約イベント連携による請求書生成パイプライン
- CRM 顧客管理と Sales オペレーション（見積・受注・クレジット審査）API、CloudWatch メトリクス連携
- HR 評価サイクルとスキルタグ管理（Prisma ベースの Employee / ReviewCycle API）

## セットアップ

```bash
cd services/project-api
cp .env.example .env
npm install
npm run db:setup     # prisma migrate deploy + seed（既存 SQLite 用）
npm run build        # 型検証と GraphQL スキーマ生成
npm run start:dev    # http://localhost:3000/api/v1, http://localhost:3000/graphql
```

起動時に `app.setGlobalPrefix('api/v1')` が適用されるため、REST エンドポイントには `/api/v1` プレフィックスが付きます。GraphQL Playground は `/graphql` で利用できます。Prisma は既定では SQLite (`DATABASE_URL`) を参照しており、`npm run db:setup` でマイグレーションとシードデータを投入します。別ファイルの SQLite や他データソースへ切り替える場合は `DATABASE_URL` を調整してください。

### CKM チャット用ローカル環境（PostgreSQL + Redis）

CKM モジュールは pgvector 対応 PostgreSQL (`DATABASE_CKM_URL`) と Redis (`CKM_REDIS_URL`) が必要です。ローカル検証はリポジトリ直下の compose ファイルで初期化できます。

```bash
# リポジトリ直下で実行
docker compose -f docker/docker-compose.ckm.yml up -d

# DB マイグレーションとサンプルデータ投入
cd services/project-api
npm run prisma:generate:ckm
npm run prisma:db:ckm:execute:init
npm run prisma:seed:ckm

# Project API を起動（.env に DATABASE_CKM_URL / CKM_REDIS_URL を設定）
npm run start:dev
```

既定では PostgreSQL は `localhost:7432`、Redis は `localhost:7637` で待ち受けます。必要に応じて `CKM_DB_PORT` や `CKM_REDIS_PORT` などの環境変数でポートを変更してください。compose で生成したデータは永続化ボリューム `ckm-db-data` / `ckm-redis-data` に保持されます。クリーンアップする場合は `docker compose -f docker/docker-compose.ckm.yml down -v` を利用してください。

### Chat Summarizer 設定

OpenAI を利用する場合は `.env` に以下の変数を設定してください。

| 環境変数 | 役割 |
|----------|------|
| `CHAT_SUMMARIZER_PROVIDER` | `openai` を指定すると本番モード、未設定時は `mock` |
| `CHAT_SUMMARIZER_API_KEY` / `CHAT_SUMMARIZER_SECRET_ID` | 直接キーを指定するか、AWS Secrets Manager から取得 |
| `CHAT_SUMMARIZER_LANGUAGE` | 要約出力言語 (`ja` / `en`) |
| `CHAT_SUMMARIZER_MAX_CHARS` | 1 チャンクあたりの最大文字数（長文は自動分割） |
| `CHAT_SUMMARIZER_RETRY_*` | リトライ回数とバックオフ (`ATTEMPTS` / `BASE_MS` / `MAX_MS`) |
| `VECTOR_STORE_URL` | `pgvector` 対応 PostgreSQL への接続文字列。未設定で無効化 |
| `DATADOG_AGENT_HOST` / `DD_SERVICE` / `DD_ENV` | Datadog StatsD への送出設定 |

`VECTOR_STORE_URL` を指定するとチャット要約の埋め込みを `pgvector` テーブルへ保存します。要約成功・失敗やリトライ状況は Datadog StatsD 経由でメトリクス化されます（`DD_SERVICE` / `DD_ENV` でタグ付け）。

### 請求パイプライン設定

| 環境変数 | 説明 |
|----------|------|
| `INVOICE_S3_BUCKET` / `INVOICE_S3_PREFIX` | S3 へ PDF/HTML を格納。設定されない場合はローカル出力 |
| `INVOICE_OUTPUT_DIR` | ローカル保存先（デフォルト `logs/invoices`） |
| `INVOICE_EMAIL_FROM` / `INVOICE_EMAIL_RECIPIENT` | AWS SES を用いた通知メール宛先 |
| `AWS_REGION` | S3 / SES / Secrets Manager で利用するリージョン |

DocuSign Webhook (`/billing/docusign/webhook`) は `completed` イベントを `SIGNED` として取り込み、契約 ID 単位で請求書をキューイングします。ローカル検証では `/billing/contracts/events` に `SIGNED` イベントを POST すると同じフローを起動できます。

### Sales メトリクス設定

| 環境変数 | 説明 |
|----------|------|
| `SALES_METRICS_ENABLED` | `true` で CloudWatch 送信を有効化（未設定時はローカル集計のみ） |
| `SALES_METRICS_NAMESPACE` | CloudWatch メトリクスの名前空間。デフォルト `ITDO/Sales` |
| `SALES_METRICS_ENV` | メトリクスに付与する Environment タグ（`APP_ENVIRONMENT` / `DD_ENV` をフォールバック） |
| `AWS_REGION` | CloudWatch / SNS などに利用するリージョン |

## REST エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| `GET` | `/api/v1/projects` | プロジェクト一覧 (`?status=active` などで絞り込み可) |
| `POST` | `/api/v1/projects` | プロジェクト新規作成 (`code`, `name`, `startDate` 必須) |
| `GET` | `/api/v1/projects/:id/timeline` | タスクタイムラインとチャット要約の取得 |
| `GET` | `/api/v1/projects/:id/metrics` | EVM / バーンダウン / リスク指標の取得 |
| `POST` | `/api/v1/projects/:id/chat/threads` | Slack / Teams スレッドの生成 |
| `POST` | `/billing/docusign/webhook` | DocuSign Webhook (PoC) |
| `POST` | `/billing/contracts/events` | 契約イベントを手動登録し請求パイプラインを起動 |
| `GET` | `/api/v1/crm/customers` | CRM 顧客一覧と検索 |
| `POST` | `/api/v1/crm/customers` | CRM 顧客の登録 |
| `GET` | `/api/v1/sales/quotes` | 見積一覧（`customerId` / `status` フィルタ対応） |
| `POST` | `/api/v1/sales/quotes` | 見積作成（CloudWatch `QuoteCreatedCount` を送信） |
| `GET` | `/api/v1/sales/orders` | 受注一覧（`customerId` でフィルタ） |
| `POST` | `/api/v1/sales/orders` | 受注作成（見積承認と pending クレジット再計算） |
| `GET` | `/api/v1/sales/metrics` | Sales KPI スナップショット取得 |
| `POST` | `/api/v1/sales/orders/:orderId/credit-review` | クレジット審査承認と CloudWatch 更新 |

サンプル:

```bash
# プロジェクト一覧
curl http://localhost:3000/api/v1/projects

# プロジェクト作成
curl -X POST http://localhost:3000/api/v1/projects \
  -H 'Content-Type: application/json' \
  -d '{"code":"DELTA-04","name":"Workflow Automation","startDate":"2025-02-01"}'

# タイムライン取得
curl http://localhost:3000/api/v1/projects/proj-1001/timeline
```

タイムライン応答では `chatSummaryLanguage` とトークン使用量 (`summaryUsage`) が返り、課金モニタリングや多言語 UI 切り替えに活用できます。

請求フローを試すには `curl -X POST http://localhost:3000/billing/contracts/events -H 'Content-Type: application/json' -d '{"type":"SIGNED","contractId":"test-1","contractCode":"TEST-1"}'` を実行するとローカル出力先に PDF/HTML が生成されます。

## GraphQL

GraphQL はコードファースト構成で、`dist/schema.gql` に自動生成されます。Project ドメインに加えて、CRM / Sales / HR リゾルバから `quotes`, `orders`, `approveCreditReview`, `salesMetrics`, `employees`, `skillTags`, `reviewCycles` などの操作を提供します。主な操作は下記の通りです。

```graphql
query ActiveProjects {
  projects(status: active) {
    id
    name
    status
    evm { cpi spi }
  }
}

mutation CreateProject {
  createProject(
    input: { code: "EPSILON-05", name: "Data Governance", startDate: "2025-03-01" }
  ) {
    id
    code
    status
  }
}
```

```graphql
query SalesSnapshot {
  salesMetrics {
    generatedAt
    totalQuotes
    totalOrders
    pendingCreditReviews
    quoteToOrderConversionRate
  }
}
```

```graphql
query HrOverview {
  employees {
    id
    name
    skillTags
  }
  reviewCycles {
    id
    cycleName
    participantIds
  }
}
```

`projectTimeline`, `projectMetrics`, `projectChatThreads` に加え、`quotes(filter: { status: PENDING_APPROVAL })` や `salesMetrics` で Sales KPI、`employees` / `reviewCycles` で HR 評価サイクルの状況を取得できます。

## テスト

```bash
npm run test       # 単体 + E2E（Supertest + Prisma リセット）
npm run test:cov   # カバレッジ取得
```

`ProjectService` のテストでは、プロジェクト作成・フィルタリング・チャットスレッド生成のコアロジックを検証しています。`test/project.e2e.spec.ts` は `prisma/test.db` を対象に `npx prisma migrate reset --force` を実行し、REST/GraphQL 経由でメトリクス取得までのエンドツーエンド検証を行います。

---
サンプルデータは `shared/metrics/evm.ts` を利用して EVM/バーンダウン指標を算出しています。実システムへ接続する際は ProjectService の永続化層を差し替えてください。
