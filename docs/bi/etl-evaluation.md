# ETL 方式比較 (Airbyte vs 自社実装)

Issue #298 のアクションとして、Phase2 BI モジュール向け ETL 方式を比較します。第一次評価結果を記録し、最終決定は Sprint6 レトロで行います。

## 1. 評価観点
| 観点 | Airbyte Cloud | 自社実装 (Node.js + Step Functions) |
|------|---------------|--------------------------------------|
| 初期セットアップ | コネクタ設定のみ。30 分で PoC 開始できる | コード + IaC 準備で 2-3 日 |
| メンテナンス | コネクタ更新は自動。費用は接続数課金 | ランタイム・ライブラリ更新を自前担保 |
| コスト | 月額 $500〜 (コネクタ数次第) | Lambda + Step Functions + Glue 利用分 |
| 拡張性 | コネクタ追加が容易 / カスタム可 | 実装自由度は高いが工数増 |
| セキュリティ | SaaS 上でデータ転送、Private Link で保護可能 | 完全自社運用だが IAM 設計が必要 |

## 2. PoC 結果
- Airbyte: PostgreSQL → S3 Parquet を 30 分で実行。CDC 処理もサポート。ただし VPC コネクタ料金が追加
- 自社実装: TypeScript Lambda + Step Functions の雛形を作成。CDC を扱う場合は Debezium 相当の仕組みが必要
- 共通課題: PII マスキングをどこで実施するか（Airbyte は Transform、Lambda は独自実装）

## 3. 推奨案
- Phase2 では **Airbyte を採用**。早期にデータマートを構築し、Phase3 で自社実装へリフト検討
- 監査要件上、Airbyte の接続ログを CloudWatch Logs へ転送する設定を必須化

## 4. TODO
- [ ] Airbyte コネクタの本番アカウント作成
- [ ] Private Link 接続のネットワーク設計
- [ ] Lambda ベースのフォールバック処理を設計（Airbyte 障害時）
- [ ] コスト監視ダッシュボードを作成（QuickSight or CloudWatch）
