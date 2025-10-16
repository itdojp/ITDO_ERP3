# HR Ops Runbook

## 目的
- 人事モジュールの評価サイクルとスキルタグ同期を安定運用し、従業員データの整合性を保つ。

## 事前準備
- [x] `services/project-api` の HR モジュール Feature Flag (`HR_MODULE_ENABLED`) を確認
- [x] Slack `#hr-ops` チャンネルにアクセスできること
- [x] QuickSight ダッシュボード `HR Evaluation Overview` の閲覧権限
- [x] PagerDuty サービス `ITDO ERP3 HR` の On-Call スケジュールを確認

## 運用手順
1. **日次チェック**
   - 09:00 JST までに QuickSight ダッシュボードで評価進捗（完了率/遅延者）を確認
   - `scripts/hr/list-pending-reviews.ts` を実行し、フォローアップが必要な担当者を Slack に通知
   - スキルタグ推定ジョブ (`npm run hr:skill-tag-sync`) の実行結果を CloudWatch Logs で確認
   - GraphQL `/graphql` で `employees` / `reviewCycles` クエリを実行し、Prisma 上の `Employee` / `ReviewCycle` テーブルと整合しているか確認
   - GraphQL `/graphql` で `reviewCycleReminders(cycleId: ...)` を実行し、Slack/Email リマインドの予定時刻が最新か確認
   - スキルタグ推定 API（`suggestSkillTags(input: { profile: "...", seedTags: [...] })`）でサンプル文章を評価し、推定タグと信頼度を記録
2. **障害発生時の初動**
   - API エラー発生時は `services/project-api` の CloudWatch メトリクス `HRReviewFailureCount` を確認
   - 5 分以内に Slack `#hr-ops` へ暫定対応を共有し、再実行またはロールバックを判断
   - データ不整合が疑われる場合は Prisma の `SkillTag` / `EmployeeSkillTag` テーブルと `db/seeds/hr/skill-tags.json` を照合し、差分を抽出
3. **エスカレーション**
   - 重大障害: SRE（@dev-sre）へ PagerDuty 経由でエスカレート
   - 評価制度関連の判断が必要な場合は PeopleOps リード（@people-lead）へ連絡
   - 個人情報保護インシデントは直ちに CISO（@security-lead）へ報告

## 監視メトリクス
| メトリクス | しきい値 | アクション |
|------------|----------|------------|
| HRReviewFailureCount | >= 1 (5分平均) | ジョブログを確認し、再実行または手動登録 |
| SkillTagSyncLagSeconds | > 600 | 同期ジョブを再実行し、Slack で状況共有 |
| PendingEvaluations | > 10 | 評価責任者にリマインド |

## 変更履歴
- 初版作成: 2025-10-14 / Issue #297
