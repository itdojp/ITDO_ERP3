# Codex CLI テンプレート利用ガイド

本ガイドでは `templates/` 配下に追加した Codex CLI テンプレートの構造と利用方法を説明します。テンプレートは Issue [#257](https://github.com/itdojp/ITDO_ERP3/issues/257) に基づき Phase1 開発での迅速なスキャフォールドを目的としています。

## 1. テンプレート一覧
テンプレ設計前に `src/`, `ui/`, `scripts/` など既存コードベースの共通パターンを棚卸しし、NestJS モジュール構成や React Feature フォルダ構成、GitHub Actions のマトリクス設定などを反映しています。

`templates/catalog.json` にメタ情報が定義されています。

| ID | 用途 | 生成物の例 |
|----|------|------------|
| `nest-api` | NestJS モジュール（Service/Resolver/DTO/OpenAPI） | `src/modules/<module>`、`openapi/<module>.yaml` |
| `react-ui` | React Feature パネル + Storybook + テスト | `ui/src/features/<feature>` |
| `github-action` | GitHub Actions Workflow 雛形 | `.github/workflows/<workflow>.yaml` |
| `terraform-module` | Terraform Module ベース | `iac/terraform/<module>` |

Terraform モジュールでは、リモートステート設定用に `stateBucket` / `stateDynamoTable` / `stateRegion` / `stateKeyPrefix` (任意) を指定してください。

## 2. 使い方
1. Codex CLI でテンプレートをプレビュー
   ```bash
   codex templates list --catalog templates/catalog.json
   codex templates show nest-api --catalog templates/catalog.json
   ```
2. 生成（例: プロジェクトモジュール）
   ```bash
   codex templates generate \
     --catalog templates/catalog.json \
     --template nest-api \
     --set moduleName=Project \
     --set route=projects
   ```
3. 生成結果を確認し、必要に応じて `npm run lint` や `npm run test` を実行してください。

## 3. カスタマイズ
- `templates/<id>/template.json` にテンプレファイルのマッピングを記述しています。
- `helpers` セクションで camelCase / kebabCase などの変換を利用できます。
- 共通のプレースホルダやパスを追加する場合は catalog.json とテンプレートを合わせて更新してください。

## 4. サンプル出力
`modules/codex-samples/` にサンプル出力を段階的に保存予定です。初期段階では下記の生成例を参照してください。

```bash
codex templates generate --template react-ui --set featureName=ProjectTimeline
codex templates generate --template github-action --set workflowName="Web CI"
```

## 5. チェックリスト
- [x] catalog.json にテンプレ追加後、`codex templates list` で参照できる
- [x] 生成ファイルに ESLint/Prettier などプロジェクト既定のルールを反映
- [ ] 新テンプレート導入時は README とこのガイドに追記

## 6. プロンプトと適用フロー

最近の開発では、Codex CLI を使って NestJS / React の双方を同じストリームで生成し、生成直後に Prisma schema や UI の状態管理を差し込むワークフローを採用しています。プロンプト例と実際の整備手順は下記の通りです。

1. NestJS モジュール生成と初期調整
   ```bash
   codex templates generate \
     --catalog templates/catalog.json \
     --template nest-api \
     --set moduleName=Project \
     --set route=projects \
     --set includePrisma=true
   ```
   - 生成直後に `prisma/schema.prisma` を拡張し、必要な enum / relation を追加する。
   - `src/app.module.ts` へ PrismaModule / ConfigModule を組み込み、`npm run db:setup` でマイグレーション＋シードを実行。

2. React Feature 生成とカスタマイズ
   ```bash
   codex templates generate \
     --catalog templates/catalog.json \
     --template react-ui \
     --set featureName=ProjectTimeline \
     --set withTests=true
   ```
   - 生成された `ProjectTimelinePanel.tsx` を基点に、`@tanstack/react-query` で REST/GraphQL を両方呼び出す実装へと拡張。
   - UI 側はステータス / フェーズフィルタや詳細カードを追加し、Vitest でカバレッジを確保。

3. 生成後の共通タスク
   - `npm run lint && npm run test` をサービス / UI 両方で実行し、生成コードが既存ルールに抵触しないか確認する。
   - ドキュメント（README, docs/codex-templates.md 等）に差分を追記し、Issue のチェックリストを更新。

このフローに沿うことで、Issue #265/#266 のようなサーバ / クライアント複合タスクを 1 スプリントでまとめて着地させやすくなります。

## 7. CI での自動検証
- `.github/workflows/codex-template-smoke.yml` では、テンプレート更新や Pull Request 時に `scripts/ci/run-codex-template-smoke.sh` を実行し、`nest-api` / `react-ui` / `github-action` の各テンプレートが `npx codex templates generate` で再生成できるかを検証します。
- 生成物に `package.json` が含まれる場合は `npm install`・`npm run lint`・`npm run test` まで実行して破損を早期検知します。テンプレート編集時はローカルでも同スクリプトを実行してから PR を作成してください。

---
最終更新: 2025-10-12 / Maintainer: AI Platform Engineering

## 8. 実装適用例
- `services/project-api` で `nest-api` テンプレから生成した骨子をベースに NestJS モジュールを構築しています。
- `ui-poc/src/features/project-timeline` では `react-ui` テンプレを起点にタイムラインパネルを拡張しています。
- 詳細な適用手順は Issue #265 / #266 / #269 を参照してください。
