# Local PoC (Docker): RabbitMQ + Redis + Node services

目的: クラウド不要で、timesheet approved → invoice generated のE2Eをローカルコンテナで再現し、順序/冪等/失敗復旧を検証する。

構成
- RabbitMQ (direct exchange `events`, shardキュー `shard.0..N-1`, DLQあり)
- Redis (Idempotency-Key で重複抑止)
- Producer (timesheet_approved を発行、timesheetIdでシャーディング)
- Consumer (各shardを単一コンシューマで処理→invoice_generatedをログ出力)
 - MinIO（任意）: 大きなペイロードをS3互換ストレージへ保存し、イベントは参照URLを送出

前提
- Docker / Docker Compose が利用可能

起動
```
cd poc/event-backbone/local
docker compose up --build
```

### Podmanでの最小構成起動

Podman でも `podman-compose` (Podman v4+) を利用して RabbitMQ + Redis + pm-service + producer の軽量構成を起動できる。

```
cd poc/event-backbone/local
podman compose -f podman-compose.yml up --build

# MinIO を合わせて利用する場合（任意）
podman run -d --name minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  docker.io/minio/minio:RELEASE.2024-08-17T01-24-54Z server /data --console-address ":9001"
# その後 USE_MINIO=true を環境変数として渡し pm-service / producer を再起動
```

設定（環境変数）
- NUM_SHARDS: シャード数（デフォルト4）
- PRODUCER_BATCH: 送信イベント数（デフォルト100）
- PRODUCER_RPS: 送信レート（events/s, デフォルト50）
- FAIL_RATE: 失敗率（0.0-1.0, デフォルト0.0）→DLQ動作の検証に使用
 - USE_MINIO: trueでMinIOを使用（デフォルトfalse）
 - MINIO_ENDPOINT/MINIO_PORT/MINIO_ACCESS_KEY/MINIO_SECRET_KEY/MINIO_BUCKET

テスト
- Producerログ: 送信件数とシャード割り当て
- Consumerログ: invoice生成（冪等時はskip表示）
- RabbitMQ管理画面: http://localhost:15672 （user: guest / pass: guest）
- Redis: idempotencyキーを格納（`idemp:{key}`）
- メトリクスダッシュボード: http://localhost:3005 （E2Eレイテンシ、件数の簡易表示）

想定確認
- 再送（同一Idempotency-Key）→重複抑止（skip）
- 同一timesheetId→同一shard→コンシューマ単一で順序維持
- FAIL_RATE>0 でDLQへ退避→手動でリドライブ（管理画面 or rabbitmqadmin）
- MinIO使用時: コンソール http://localhost:9001 でオブジェクト（eventsバケット）を確認

終了
```
docker compose down -v
```

メモ
- 大きなペイロードはS3互換（MinIO）での格納も可能。必要ならcomposeにMinIOサービスを追加して参照URL方式に拡張可能です。
 - 既定でMinIOサービスは同梱。`USE_MINIO=true`でProducerがバケット作成/アップロードを行い、イベントに`attachmentUrl`を付与します。

計測（レイテンシ）
- Consumerは `occurredAt` と処理完了時刻からE2Eレイテンシを算出してログ出力（ms）。
- ログから集計して `poc/event-backbone/metrics.md` に転記してください。

API（サービス間連携の簡易テスト）
- PMサービス（送信）: `POST http://localhost:3001/timesheets/approve`
  - body例: `{ "timesheetId": "TS-001", "hours": 7.5, "note": "optional large note" }`
  - ヘッダ: `Idempotency-Key: <uuid>`（省略時は自動生成）
  - 応答: `{ accepted: true, eventId, shard }`

- FIサービス（参照）:
  - `GET http://localhost:3002/invoices` → 直近の請求ドラフト一覧
  - `GET http://localhost:3002/invoices/{id}` → 個別取得

- Salesサービス（受注確定）: `POST http://localhost:3003/sales/orders/confirm`
  - body例: `{ "orderId": "SO-1001", "customerId": "C-001", "amount": 500000 }`
  - 応答: `{ accepted: true, eventId, shard }`

- Creditサービス（自動処理）: 環境変数 `CREDIT_LIMIT`（デフォルト 1,000,000）以下なら `sales.credit.approved` を発行
  - 手動オーバーライド: `POST http://localhost:3004/credit/override` body例 `{ "orderId": "SO-1001", "amount": 800000, "approver": "manager" }`

- FIサービス（受注ステータス）:
  - `GET http://localhost:3002/orders/{orderId}/status` → `credit`（approved/rejected/unknown）と `projectId`

- Contractサービス（契約・更新）:
  - 追加/更新: `POST http://localhost:3006/contracts` body例 `{ "contractId": "CT-2024-001", "customerId": "C-001", "renewalDate": "2025-09-01", "amount": 1200000 }`
  - 一覧: `GET http://localhost:3006/contracts`
  - リマインド発火: `POST http://localhost:3006/contracts/reminders/trigger` body例 `{ "days": 60 }` → `ckm.contract.renewal.reminder` 発行
  - 更新: `POST http://localhost:3006/contracts/{id}/renew` body例 `{ "newDate": "2026-09-01" }` → `ckm.contract.renewed` 発行
