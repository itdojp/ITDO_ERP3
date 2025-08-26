# AWS PoC: EventBridge + SQS (FIFO) + Lambda

アーキテクチャ
- EventBridge: `pm.timesheet.approved` 受信 → ルールで SQS FIFO に転送
- SQS FIFO: `MessageGroupId=timesheetId` で順序確保、DLQ設定
- Lambda: コンシューマ（冪等処理: Idempotency-Key + 重複検知テーブル）
- 監査/保管: EventBridge Archive/Replay + S3 (WORM)
- 監視: CloudWatch Alarms（キュー深さ、失敗率、DLQ増加）

実施手順（概要）
1) Event命名/スキーマ確定（schema/*.json）
2) EventBridge バス/ルール作成（フィルタ: `detail-type`, `source`, `detail.action` 等）
3) SQS FIFO 作成（Content-based dedup off, DLQ 紐付け）
4) Lambda 作成（Node.js/TypeScript）
   - 入力: SQSイベント
   - 処理: 冪等チェック→Invoiceドラフト作成（モック）→結果ログ
5) Archive/Replay 有効化、S3 への定期エクスポート（7年）
6) CloudWatch ダッシュボード/アラーム作成

測定
- E2Eレイテンシ: 送信時刻→Lambda完了時刻
- スループット: バッチ送信（100/1,000/10,000 events）
- 失敗シナリオ: わざと失敗→DLQ→リドライブ
- 冪等確認: 同一Idempotency-Key再送

概算コスト（目安）
- EventBridge（イベント課金）、SQS（リクエスト課金）、Lambda（GB秒/リクエスト）
- MVP規模（数万イベント/月）: 数千円〜1万円台

注意
- 大きなペイロードはS3格納、イベントは参照URL
- VPCエンドポイントでNATコスト節約

