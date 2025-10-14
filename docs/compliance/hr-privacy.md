# 人事モジュール 個人情報保護ガイドライン

Issue #297 / #159 のタスクとして、人事モジュールで扱う個人情報の保護方針とアクセス制御を定義します。

## 1. データ分類
| データ種別 | 例 | 区分 | 保管期限 |
|-------------|----|------|-----------|
| 基本情報 | 氏名・メールアドレス | 機微ではない PII | 退職後 5 年 |
| 評価コメント | マネージャーのフィードバック | 機微情報 | 退職後 3 年 |
| スキルタグ | AI 推定タグ・自己申告タグ | 機微ではない PII | 更新時上書き |
| 補足資料 | PDF/画像（査定資料） | 特定個人情報の可能性 | 直近 3 サイクル |

## 2. アクセス制御
- IAM ロール `hr-module-admin` を新設し、評価サイクルの CRUD を限定
- Lambda / API 経由のアクセスは Attribute-Based Access Control (ABAC) を採用
- GitHub Actions からのジョブは OIDC 経由で `hr-ci-runner` ロールを Assume

## 3. ログ・監査
- 変更操作 (employee.upsert/reviewCycle.create) を CloudTrail + Kinesis Firehose へ送信
- 監査ログの整合性チェックは週次で `npm run audit:hr-privacy`（実装予定）
- 監査結果は `docs/runbooks/hr-ops.md` の手順に沿って PeopleOps と共有

## 4. データマスキング
- GraphQL Resolver では `@UseGuards(HrOwnershipGuard)` を適用し、自己以外の個人情報アクセスを制限
- BI Export 時はメールアドレスをハッシュ化（SHA-256 + salt）。
- 生成 AI への入力は `skillTags` のみを許可し、評価コメントは除外

## 5. インシデント対応
1. 個人情報漏えいを検知したら 30 分以内に CISO / PeopleOps リードへ報告
2. 影響範囲を `audit_logs` テーブルで特定し、暫定措置として該当 API を停止
3. 法務・広報と連携して外部報告の要否を判断
4. 再発防止策を 72 時間以内にレビューし、Issue #HR-PRIVACY-POSTMORTEM にまとめる

## 6. チェックリスト
- [ ] IAM ポリシーのドラフトを作成し、Security チームレビューを完了
- [ ] `hr-ci-runner` ロールに必要な最小権限を付与
- [ ] CloudWatch Logs の保持期間を 365 日に設定
- [ ] Slack #hr-ops へインシデント連絡テンプレートを共有
- [ ] BI Export スクリプトでハッシュ化が実装されていることを確認
