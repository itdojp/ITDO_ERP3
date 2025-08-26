# GCP PoC: Pub/Sub + Cloud Run (+ Eventarc)

アーキテクチャ
- Pub/Sub: `pm.timesheet.approved` をトピック配信（ordering key=timesheetId）
- サブスクリプション: DLT設定、ack期限/再試行ポリシー
- Cloud Run: Push 受信コンシューマ（冪等処理: Idempotency-Key + 重複検知テーブル）
- 監査/保管: BigQuery/GCS シンク（7年はGCSで保管）
- 監視: Cloud Monitoring（サブスクリプションlag、error率）、Error Reporting

実施手順（概要）
1) Event命名/スキーマ確定（schema/*.json）
2) Pub/Sub トピック/サブスクリプション作成（ordering/dlt/再試行）
3) Cloud Run サービス作成（Node.js/TypeScript）
   - 入力: Pub/Sub push
   - 処理: 冪等チェック→Invoiceドラフト作成（モック）→結果ログ
4) BigQuery/GCS シンク設定（長期保管）
5) Monitoring/アラート設定

測定
- E2Eレイテンシ: 送信時刻→Cloud Run 完了時刻
- スループット: バッチ送信（100/1,000/10,000 events）
- 失敗シナリオ: わざと失敗→DLT→リドライブ
- 冪等確認: 同一Idempotency-Key再送

概算コスト（目安）
- Pub/Sub（メッセージ課金）、Cloud Run（リク/CPU・メモリ秒）、BigQuery/GCS（保存/取り込み）
- MVP規模（数万イベント/月）: 数千円〜1万円台

注意
- 大きなペイロードはGCS格納、イベントは参照URL
- Serverless VPC Access や VPC-SC で境界強化（必要時）

