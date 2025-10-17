# CKM Prisma マイグレーション / テスト方針

CKM チャット用データストアは PostgreSQL + pgvector を前提とする。`services/project-api/prisma/ckm.prisma` でモデル定義を分割し、既存 SQLite ベースのスキーマとは独立に管理する。

## 1. 環境変数

```bash
# .env / .env.local
DATABASE_CKM_URL="postgresql://user:pass@localhost:5434/itdo_ckm?schema=public"
```

- CKM 用に専用 DB を用意する（本番：マネージド PostgreSQL、開発：Docker 等）。
- 既存 `DATABASE_URL`（Project/CRM 等）とは切り離し、マイグレーションを相互に影響させない。

## 2. ローカルセットアップ

```bash
# pgvector 拡張入りの PostgreSQL（14+）を起動
docker run --rm -d \
  --name itdo-ckm-db \
  -e POSTGRES_DB=itdo_ckm \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5434:5432 \
  ankane/pgvector:latest

# pgvector extension を有効化
psql postgresql://postgres:postgres@localhost:5434/itdo_ckm -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

## 3. Prisma コマンド

```bash
# 既定 + CKM 双方のクライアントを生成
npm run prisma:generate

# CKM スキーマの差分確認（SQL 出力）
npm run prisma:migrate:ckm:diff

# 既存 SQL を適用（初期セットアップ）
DATABASE_CKM_URL="postgresql://user:pass@localhost:5434/itdo_ckm?schema=public" \
  npm run prisma:db:ckm:execute:init

# スキーマ検証
prisma validate --schema prisma/ckm.prisma
```

- `npm run prisma:generate` は `prisma generate`（既存 SQLite スキーマ）→`prisma generate --schema prisma/ckm.prisma` の順に実行するようパッケージスクリプトを更新済み。`prebuild` / `prestart(:dev)` / `pretest` でも自動実行される。
- CKM 用マイグレーションは `services/project-api/prisma/ckm-migrations` に SQL で管理する。初期ファイルは `20251017000000_init/migration.sql`。
- 生成された CKM クライアントは `services/project-api/generated/ckm-client` に出力され `.gitignore` 下で管理。

## 4. テスト戦略

| 種別 | 目的 | 実施内容 |
|------|------|----------|
| Unit | リポジトリ層の整合性 | Prisma Mock + Jest。モデルの必須項目・Default 値を検証。 |
| Integration | 実 DB での CRUD / ACL | TestContainer（Postgres+pgvector）で `prisma migrate deploy` → リポジトリ/API 経由で操作。 |
| Pipeline | Embedding 更新 | BullMQ ワーカーのエンドツーエンドテスト。OpenAI 呼び出しはモック + 例外再試行を確認。 |
| Migration | 後方互換確認 | 既存 DB のバックアップに対して `prisma migrate diff` を実行し、破壊的変更がないことを監査ログに記録。 |

- CI では PostgreSQL サービスを追加し、`DATABASE_CKM_URL` を設定して `prisma migrate deploy --schema prisma/ckm.prisma` を検証。
- `pgvector` 関連のテストは Embedding フィールドへ `vector` 型を投入して類似度検索クエリ（Raw SQL）を確認。

## 5. ロールアウト

1. QA 環境で CKM DB をプロビジョニングし、`DATABASE_CKM_URL` を設定した上で `npm run prisma:db:ckm:execute:init` を実行（もしくは `psql -f` で `ckm-migrations` SQL を適用）→ 必要ならシード投入。
2. 開発時は `npm run prisma:migrate:ckm:diff` で差分を確認し、新規 SQL を `prisma/ckm-migrations` に追加してレビューする。
3. NestJS の `CkmPrismaService` を通じて接続（`DATABASE_CKM_URL` 未設定時は自動的に無効化されるため、ロールアウトフェーズでは Feature Flag と併用）。
4. 本番リリース時はメンテナンスウィンドウ内で移行 CLI（Chatwork/ClickUp インポート）を Dry-run → 本適用。
5. Datadog ダッシュボード（`docs/monitoring/ckm-chat-dashboard.json`）をインポートし、Migration 関連メトリクス（`ckm.chat.*`）を監視。

## 6. 既知のリスク

- pgvector 未対応のマネージド DB（例: Aurora Serverless v1）では利用不可。選定時に互換性を確認する。
- 既存 SQLite からの移行タイミングに注意。CKM モジュールの導入前に PostgreSQL 接続が確立されていないとアプリ起動時に失敗するため、Feature Flag で段階的に接続を有効化する。`CkmPrismaService` は `DATABASE_CKM_URL` が未設定の場合は無効化されるが、将来的な API 実装では利用可否チェックを忘れない。
- Prisma の `migrations/` ディレクトリは既存 SQLite 向けと共有になるため、CKM 向けは SQL ファイルで運用する。`prisma migrate diff` を利用して差分を確認しつつ、`prisma/ckm-migrations` に手動で反映する。
- `prisma migrate dev` では vector 型の diff を正しく検出できない場合がある。`ckm-migrations` に追記する SQL をレビューし、pgvector 依存項目を手動補正する。
