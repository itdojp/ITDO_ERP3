# BI データマート設計 (Phase2)

Issue #298 / #159 に基づき、Phase2 の BI/分析モジュールで構築するデータマートとダッシュボード要件を整理します。

## 1. 全体構成
- **Raw Layer**: PostgreSQL / CRM・販売・人事モジュールのスナップショットを S3 にエクスポート
- **Staging Layer**: Glue ETL で正規化し、S3 Parquet 形式に変換
- **Mart Layer**: Athena/Trino で参照する `analytics_${env}` データベースを構築
- **Serving Layer**: QuickSight ダッシュボード、LangGraph ベースの自然言語クエリ API

## 2. テーブル概要
| テーブル | 粒度 | 主なカラム | ソース |
|----------|------|------------|--------|
| `dim_customer` | 顧客 | customer_id, industry, lifecycle_stage | CRM
| `fact_opportunity` | 案件 | opportunity_id, amount, stage, expected_close | CRM + 販売管理
| `fact_quote` | 見積 | quote_id, total_amount, approval_status, approved_at | 販売管理
| `fact_order` | 受注 | order_id, status, signed_at, margin | 販売管理
| `fact_review_cycle` | 評価サイクル | cycle_id, completion_rate, overdue_count | 人事
| `fact_ai_usage` | AI 推定 | module, request_count, success_rate, latency | 共通 AI ログ

## 3. ETL フロー
1. Airbyte で各モジュールの PostgreSQL テーブルを S3 `raw/` にレプリケート
2. Glue ジョブで `raw/` → `staging/` を変換（PII マスキング + 正規化）
3. Glue Crawler でカタログを更新し、Athena でクエリ可能にする
4. 毎朝 06:00 JST に QuickSight SPICE をリフレッシュ
5. CloudWatch Event で ETL 失敗を `analytics-etl-failure` アラートへ通知

## 4. KPI ダッシュボード
- **Executive Overview**: パイプライン額、受注率、評価完了率、AI アシスト利用率
- **Operational Dashboard**: 各モジュール毎の SLA、フォローアップ滞留、Scorecard
- Product Board へのカード: `Phase2 Sprint5-8 / Analytics Dashboard`（未作成の場合は #159 コメント参照）
- QuickSight テンプレート ID: `analytics-placeholder`（実装時に差し替え）

## 5. LangGraph 自然言語クエリ PoC
- `examples/bi/nl-query-poc` に TypeScript ベースのフローを格納
- ユーザー入力 → Intent 判定 → Athena クエリ生成 → 要約を返す構成
- 現時点ではダミーデータで検証し、Production 適用時に IAM / コスト制御を追加

## 6. テストと課題
- [x] Terraform Skeleton (`iac/terraform/analytics-observability`) を生成し、リソース定義を記述
- [x] LangGraph PoC のモックフローを追加
- [ ] Airbyte vs 自社実装の比較 (Issue #298 チェックリスト参照)
- [ ] QuickSight テンプレートの実装（Phase2 Sprint8）

## 7. 次アクション
1. Airbyte PoC 実施、結果を `docs/bi/etl-evaluation.md` に追記
2. QuickSight テンプレートの JSON 定義を準備
3. LangGraph PoC に Athena 実クエリを接続
4. KPI ダッシュボードカードをプロジェクトボードへ追加（権限取得後）
