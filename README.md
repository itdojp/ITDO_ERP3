# ITDO ERP3 - モダンERPシステム仕様書

## 📋 概要

本リポジトリは、Project-Open代替となるモダンなクラウドネイティブERPシステムの仕様書群を管理しています。

## 🎯 プロジェクト目標

- レガシーシステムからの脱却
- クラウドネイティブな設計による運用効率向上
- 日本法制度（インボイス制度、J-SOX）への完全対応
- MVPアプローチによる段階的実装

## 📁 リポジトリ構成

```
ITDO_ERP3/
├── integrated-specs/          # 統合仕様書（最新版）
│   ├── 00-overview/           # システム概要
│   ├── 01-core/              # コア仕様
│   ├── 02-modules/           # モジュール仕様
│   ├── 03-infrastructure/    # 基盤仕様
│   └── 04-implementation/    # 実装仕様
│
├── PlanO/                    # Plan O仕様書（参考）
├── PlanS/                    # Plan S仕様書（参考）
│
├── erp-requirements-spec.md         # 元要求仕様書
├── erp-requirements-spec-review.md   # レビュー結果
└── erp-integrated-requirements-spec.md # 統合要求仕様書
```

## 📚 主要ドキュメント

### 統合仕様書（integrated-specs/）

| カテゴリ | ドキュメント | 説明 |
|---------|------------|------|
| **概要** | [system-overview.md](integrated-specs/00-overview/system-overview.md) | システム全体像、MVP定義、ロードマップ |
| **統合** | [integration-spec.md](integrated-specs/01-core/integration-spec.md) | モジュール間連携、API設計 |
| **データ** | [data-governance-spec.md](integrated-specs/01-core/data-governance-spec.md) | データガバナンス体制、品質管理 |
| **セキュリティ** | [security-spec.md](integrated-specs/03-infrastructure/security-spec.md) | セキュリティ要件、実装方針 |
| **PM** | [pm-module-spec.md](integrated-specs/02-modules/pm-module-spec.md) | プロジェクト管理機能 |
| **財務** | [fi-module-spec.md](integrated-specs/02-modules/fi-module-spec.md) | 財務管理機能 |

詳細は[integrated-specs/README.md](integrated-specs/README.md)を参照してください。

## 🚀 実装ロードマップ

### Phase 1: MVP（0-6ヶ月）
- ✅ プロジェクト管理基本機能
- ✅ タイムシート・原価計算
- ✅ インボイス対応請求管理
- ✅ 基本的な契約管理
- ✅ 会計システム連携

### Phase 2: 機能拡張（7-12ヶ月）
- 📋 販売管理（受注・与信）
- 📋 人事管理
- 📋 CRM基本機能
- 📋 BIダッシュボード

### Phase 3: 高度化（13-18ヶ月）
- 📋 ガバナンス・リスク管理
- 📋 AI/ML予測分析
- 📋 高度な自動化

## 🛠️ 技術スタック

- **フロントエンド**: React 18+, Next.js 14+, TypeScript
- **バックエンド**: Node.js, NestJS, TypeScript
- **データベース**: PostgreSQL 15+, MongoDB, Redis
- **インフラ**: AWS (EKS, RDS, S3), Docker, Kubernetes
- **CI/CD**: GitHub Actions, ArgoCD

## 📊 成功指標（KPI）

| 指標 | 目標値 | 測定時期 |
|------|--------|----------|
| システム稼働率 | 99.9% | MVP完了時 |
| ユーザー満足度 | 80%以上 | 各フェーズ後 |
| 業務効率改善 | 20%以上 | 1年後 |
| プロジェクト原価精度 | 誤差1%以内 | 6ヶ月後 |

## 🤝 コントリビューション

仕様書の改善提案は、Issueまたはプルリクエストでお願いします。

## 🧪 UI PoC テスト実行ガイド

Next.js ベースの UI PoC については、以下の手順でエンドツーエンド検証と Podman スモークを実行できます。

1. **Playwright E2E テスト**
   ```bash
   cd ui-poc
   npm install
   npm run test:e2e
   ```
   - Projects / Timesheets / Compliance / Telemetry など主要画面の UI 操作とフォールバック動作を確認します。
   - Podman 上で API を起動した状態で検証する場合は `npm run test:e2e:live` を利用し、`E2E_EXPECT_API=true` を設定すると API 成功を前提としたアサーションを有効にできます。

2. **Podman ライブスモーク**
   ```bash
   TIMEOUT_SECONDS=180 scripts/poc_live_smoke.sh --tests-only
   ```
   - Podman Compose で pm-service / RabbitMQ / Redis / MinIO / Grafana を起動し、ライブ API に対する Playwright シナリオとメトリクス監視を自動実行します。
   - Slack Webhook を設定すると失敗通知も送信されます。詳細は `scripts/.env.poc_live_smoke.example` と [PoC Live Smoke Tests](docs/poc_live_smoke.md) を参照してください。

3. **CI 監視**
   - GitHub Actions の **PoC Live Smoke** ワークフローでは MinIO 有効/無効の 2 パターンで上記スモークを毎日／手動で実行できます。
   - 実行結果と生成アーティファクト（`logs/poc-smoke/`）を確認し、ダッシュボードやアラート定義に差異がないかチェックしてください。

## 🧰 Slack 共有テンプレート

Projects 一覧の共有メッセージは以下の CLI で生成できます。

- `make share-projects ARGS="--url https://example.com/projects?status=active"`
- `cd ui-poc && PROJECTS_TITLE="Weekly Projects" npm run share:projects -- --url https://example.com/projects?status=active --notes "17 件をレビュー"`
- `cd ui-poc && npm run share:projects -- --url https://example.com/projects?status=active --format json`

`PROJECTS_URL` / `PROJECTS_TITLE` / `PROJECTS_NOTES` の各環境変数を上書きすることでサンプルスクリプトの出力を変更できます。

`--format markdown` / `--format json` を指定すると、それぞれ Markdown 形式・JSON 形式で出力できます。`--count <number>` で対象件数を bullet に追加し、`--out <path>` で生成結果をファイル保存できます。`--post <webhook-url>` を併用すると Slack Incoming Webhook へメッセージを直接送信します（複数指定可）。`--config share.config.json` を指定すると、URL やタイトルなどの既定値を JSON ファイルから読み込めます。

GitHub Actions には週次スケジュール (`Projects Slack Share Check`) を追加し、サンプルメッセージの生成が失敗しないかを継続的に確認しています。

## 📝 ライセンス

本仕様書は社内利用を前提としています。外部公開の際は事前承認が必要です。

## 📧 連絡先

プロジェクトに関するお問い合わせは、プロジェクトマネージャーまでご連絡ください。

---

*最終更新: 2025年8月23日*
