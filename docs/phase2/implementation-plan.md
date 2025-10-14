# Phase2 実装準備プラン

Issue #159 を前進させるために、Phase2 モジュール（CRM / 販売 / 人事 / BI）の着手順と初期イテレーションの作業項目を整理します。各モジュールは 2 週間のイテレーションを基本とし、テンプレート・AI ワークフローを活用して仕様〜実装〜テストを高速化します。

## 1. スプリント割り当てとゴール
| スプリント | モジュール | 主要ゴール | 依存関係 |
|-------------|------------|-------------|-----------|
| Sprint 5 (T+0) | CRM | 顧客マスタ・案件一覧 API と GraphQL Resolver の骨子実装。会話要約のスタブ組み込み。 | Phase1 で整備済みの Project API / Auth |
| Sprint 6 (T+2) | 販売管理 | 見積作成・受注登録フローの CRUD 実装と Terraform Stack の雛形。 | CRM の顧客マスタ / 契約モジュール |
| Sprint 7 (T+4) | 人事 | スキルタグ + 評価サイクル API と Runbook 初版。 | プロジェクト配属データ、Slack 連携 |
| Sprint 8 (T+6) | BI/分析 | データマート雛形、自然言語クエリ PoC、ダッシュボード基盤。 | CRM/販売/人事 のメトリクス |

## 2. モジュール別 ToDo
### CRM
- [ ] `scripts/templates/create-module.js` の `nest-module` を利用して `services/project-api/src/modules/crm` をスキャフォールド。
- [ ] `docs/specs/crm/requirements.md` を作成し、エンティティ／ユースケース／API を詳細化。
- [ ] 会話要約スタブ向けに `shared/ai` 配下へフォルダを追加し、LangGraph 接続をモック。
- [ ] KPI を `docs/metrics/crm.md` に整理し、BI チームへ共有。

### 販売管理
- [ ] `nest-module` テンプレートで `sales` モジュールを生成し、見積/受注の DTO を追加。
- [ ] Terraform Stack テンプレートから監視用 `iac/terraform/sales-monitoring` を生成し、アラート設計を記述。
- [ ] 電子帳簿法対応の観点から `docs/compliance/sales-ledger.md` をドラフト化。

### 人事
- [ ] Runbook テンプレートを用いて `docs/runbooks/hr-ops.md` を作成し、評価サイクル運用を明文化。
- [ ] スキルタグ辞書を `db/seeds/hr/skill-tags.json` として管理し、AI 推定 API の入力形式を定義。
- [ ] GitHub Actions に HR モジュール専用の lint/test ジョブを追加し、ai-devflow の `test_and_review` ステージへフック。

### BI / 分析
- [ ] `docs/bi/data-mart.md` を作成し、データマート構造と ETL ラインを明文化。
- [ ] Terraform Stack から `analytics-observability` を生成し、Glue/Athena を想定したダッシュボード構成を追加。
- [ ] LangGraph を用いた自然言語クエリ PoC を `examples/bi/` 配下で実装し、Spec-as-Code フローに組み込み。

## 3. クロスカットタスク
- `ai-devflow.yaml` の `code_generation` と `deployment` ステージに Phase2 モジュールのパイプライン ID を追記。
- Codex CLI テンプレートの smoke テストに Phase2 モジュール向けケース（crm/sales/hr/bi）を追加し、生成物の lint を実行。
- プロジェクトボードにスプリント別カードを追加し、AI エージェント向けの担当者／締切を設定。

## 4. リスクと緩和策
| リスク | 影響 | 対応策 |
|--------|------|--------|
| CRM の会話要約が Phase1 チャット統合と競合 | 中 | 共通 `conversation` スキーマを策定し、vector index を共有 |
| 販売管理の与信フローで外部サービス連携が未決 | 高 | 与信 API をモックし、Phase2 中盤で決定。Runbook に暫定手順追加 |
| 人事モジュールの個人情報取り扱い | 中 | IAM Policy と監査ログ Runbook を先行整備し、データアクセスを最小化 |
| BI モジュールの ETL 構築が遅延 | 高 | Sprint 6 で PoC を開始し、Airbyte と自社実装の比較評価を行う |

## 5. 次のアクション
1. CRM モジュールの詳細仕様イシュー（`feat/crm-module-spec`）を起票し、テンプレート生成を実行。
2. Codex CLI smoke テストに Phase2 テンプレートケースを追加する PR を作成。
3. `ai-devflow.yaml` に Phase2 各モジュールのパイプライン参照を追加し、Issue #159 のチェックリストを更新。
4. プロジェクトボードに Sprint 5-8 のカードを作成し、担当者と期日を割り当て。
