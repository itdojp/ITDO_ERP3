# Project API (NestJS)

Project API は ITDO ERP3 のプロジェクト管理・チャット連携の試験実装です。NestJS を用いた REST / GraphQL ハイブリッド構成となっており、以下の機能を提供します。

- プロジェクト一覧と Earned Value Management (EVM) 指標の取得
- プロジェクトの新規作成
- プロジェクトタイムラインとチャット要約の取得
- バーンダウンチャートとリスクサマリを含むメトリクスの取得
- Slack / Teams スレッドのプロビジョニング

## セットアップ

```bash
cd services/project-api
cp .env.example .env
npm install
npm run db:setup     # prisma migrate deploy + seed
npm run build        # 型検証と GraphQL スキーマ生成
npm run start:dev    # http://localhost:3000/api/v1, http://localhost:3000/graphql
```

起動時に `app.setGlobalPrefix('api/v1')` が適用されるため、REST エンドポイントには `/api/v1` プレフィックスが付きます。GraphQL Playground は `/graphql` で利用できます。Prisma は SQLite を利用しており、`npm run db:setup` でマイグレーションとシードデータを投入します。`DATABASE_URL` を変更することで、別ファイルの SQLite や他データソースへ切り替え可能です。

## REST エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| `GET` | `/api/v1/projects` | プロジェクト一覧 (`?status=active` などで絞り込み可) |
| `POST` | `/api/v1/projects` | プロジェクト新規作成 (`code`, `name`, `startDate` 必須) |
| `GET` | `/api/v1/projects/:id/timeline` | タスクタイムラインとチャット要約の取得 |
| `GET` | `/api/v1/projects/:id/metrics` | EVM / バーンダウン / リスク指標の取得 |
| `POST` | `/api/v1/projects/:id/chat/threads` | Slack / Teams スレッドの生成 |

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

## GraphQL

GraphQL はコードファースト構成で、`dist/schema.gql` に自動生成されます。主な操作は下記の通りです。

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

`projectTimeline`, `projectMetrics`, `projectChatThreads` などのクエリでタイムラインおよびチャットスレッドの情報を取得できます。

## テスト

```bash
npm run test       # 単体 + E2E（Supertest + Prisma リセット）
npm run test:cov   # カバレッジ取得
```

`ProjectService` のテストでは、プロジェクト作成・フィルタリング・チャットスレッド生成のコアロジックを検証しています。`test/project.e2e.spec.ts` は `prisma/test.db` を対象に `npx prisma migrate reset --force` を実行し、REST/GraphQL 経由でメトリクス取得までのエンドツーエンド検証を行います。

---
サンプルデータは `shared/metrics/evm.ts` を利用して EVM/バーンダウン指標を算出しています。実システムへ接続する際は ProjectService の永続化層を差し替えてください。
