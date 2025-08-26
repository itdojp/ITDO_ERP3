# Local PoC (Docker): RabbitMQ + Redis + Node services

目的: クラウド不要で、timesheet approved → invoice generated のE2Eをローカルコンテナで再現し、順序/冪等/失敗復旧を検証する。

構成
- RabbitMQ (direct exchange `events`, shardキュー `shard.0..N-1`, DLQあり)
- Redis (Idempotency-Key で重複抑止)
- Producer (timesheet_approved を発行、timesheetIdでシャーディング)
- Consumer (各shardを単一コンシューマで処理→invoice_generatedをログ出力)

前提
- Docker / Docker Compose が利用可能

起動
```
cd poc/event-backbone/local
docker compose up --build
```

設定（環境変数）
- NUM_SHARDS: シャード数（デフォルト4）
- PRODUCER_BATCH: 送信イベント数（デフォルト100）
- PRODUCER_RPS: 送信レート（events/s, デフォルト50）
- FAIL_RATE: 失敗率（0.0-1.0, デフォルト0.0）→DLQ動作の検証に使用

テスト
- Producerログ: 送信件数とシャード割り当て
- Consumerログ: invoice生成（冪等時はskip表示）
- RabbitMQ管理画面: http://localhost:15672 （user: guest / pass: guest）
- Redis: idempotencyキーを格納（`idemp:{key}`）

想定確認
- 再送（同一Idempotency-Key）→重複抑止（skip）
- 同一timesheetId→同一shard→コンシューマ単一で順序維持
- FAIL_RATE>0 でDLQへ退避→手動でリドライブ（管理画面 or rabbitmqadmin）

終了
```
docker compose down -v
```

メモ
- 大きなペイロードはS3互換（MinIO）での格納も可能。必要ならcomposeにMinIOサービスを追加して参照URL方式に拡張可能です。

