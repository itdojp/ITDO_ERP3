# CRM KPI 指標一覧

CRM モジュールでトラッキングする主要 KPI を整理し、BI/分析モジュールへ提供することを目的とします。Issue #295 / #159。

| KPI | 定義 | 算出方法 | 更新頻度 | 備考 |
|-----|------|----------|-----------|------|
| パイプライン額 (Pipeline Value) | 各ステージの見込み金額合計 | Opportunity.amount のステージ毎集計 | 毎時 | 失注は除外 |
| リード→案件転換率 | Lead ステージから Qualified 以上への移行割合 | qualified_opportunities / leads | 週次 | MA 連携で自動補完 |
| 顧客活性度スコア | 直近接触・会話回数・follow-up 実施状況の複合スコア | 0-100 スケール | 日次 | ConversationSummary.followUps を参照 |
| 商談滞留日数 | 現在ステージの滞留期間 | now - Opportunity.stageEnteredAt | 日次 | アラート >14 日 |
| フォローアップ遵守率 | 指定期日までに follow-up を実行した割合 | completed_followups / planned_followups | 週次 | SRE が監視 |

## ダッシュボード要件
- Tableau / QuickSight いずれかで提供、Phase2 PoC では QuickSight を想定
- KPI カード + ファネルチャート + 活性度ヒートマップ
- 直近 90 日の推移、顧客セグメント別のドリルダウン
- アラート条件を GitHub Actions → Slack 通知に連携（#299 にて実装予定）

## BI チーム向けチェックリスト
- [ ] KPI 定義のレビュー完了
- [ ] データソース (PostgreSQL + pgvector) の接続検証
- [ ] ETL (Airbyte or 自社) で KPI 抽出に必要なテーブルを取得
- [ ] ダッシュボード雛形の共有
- [ ] SLA / アラートポリシーを Docs に追記
