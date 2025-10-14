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
- [ ] catalog.json にテンプレ追加後、`codex templates list` で参照できる
- [ ] 生成ファイルに ESLint/Prettier などプロジェクト既定のルールを反映
- [ ] 新テンプレート導入時は README とこのガイドに追記

---
最終更新: 2025-10-12 / Maintainer: AI Platform Engineering

## 6. 実装適用例
- `services/project-api` で `nest-api` テンプレから生成した骨子をベースに NestJS モジュールを構築しています。
- `ui-poc/src/features/project-timeline` では `react-ui` テンプレを起点にタイムラインパネルを拡張しています。
- 詳細な適用手順は Issue #265 および #266 を参照してください。
