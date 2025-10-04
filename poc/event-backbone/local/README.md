# Local PoC (Docker): RabbitMQ + Redis + Node services

目的: クラウド不要で、timesheet approved → invoice generated のE2Eをローカルコンテナで再現し、順序/冪等/失敗復旧を検証する。

構成
- RabbitMQ (direct exchange `events`, shardキュー `shard.0..N-1`, DLQあり)
- Redis (Idempotency-Key で重複抑止)
- Producer (timesheet_approved を発行、timesheetIdでシャーディング)
- Consumer (各shardを単一コンシューマで処理→invoice_generatedをログ出力)
 - MinIO（任意）: 大きなペイロードをS3互換ストレージへ保存し、イベントは参照URLを送出

前提
- Docker / Docker Compose もしくは Podman + podman-compose が利用可能

起動
```
cd poc/event-backbone/local
docker compose up --build
```

### Podman でのPoC起動

Podman でも `podman-compose` (Podman v4+) を利用して RabbitMQ + Redis + pm-service + producer + consumer の構成を再現できる。

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

v3.1 以降の `podman-compose.yml` には MinIO サービスが同梱されているため、以下のように環境変数を指定するだけで添付ファイル向けオブジェクトストレージ連携を有効化できる。

```
USE_MINIO=true MINIO_PORT=9000 MINIO_CONSOLE_PORT=9001 podman compose -f podman-compose.yml up -d
```

`pm-service` は MinIO 連携が有効な場合、請求書添付を `compliance/<invoiceId>/...` のキーで自動生成し、APIレスポンスには有効期限付きのダウンロードURLが含まれる。

`MINIO_PRESIGN_SECONDS`（既定 600）でURLの有効時間を調整できる。

#### Podman向けスモークテスト

以下のスクリプトは Podman 上でスタックを起動し、タイムシート承認イベントを1件発火→consumerが請求書生成ログを出力するまで待機してから停止します。

```
scripts/run_podman_poc.sh
```

#### UI + API ライブE2Eスモーク

Podman スタックを再起動しつつ Playwright の `test:e2e:live` を走らせるユーティリティ:

```
TIMEOUT_SECONDS=120 scripts/poc_live_smoke.sh           # 単発実行
TIMEOUT_SECONDS=120 scripts/poc_live_smoke.sh --loop    # 継続実行（10分間隔）
```

MinIO を利用した添付ダウンロードも検証したい場合は `USE_MINIO=true` を付与して実行してください。

#### 永続化状態の手動確認手順

pm-service では `/app/state/pm-poc-state.json`（ホスト側では `services/pm-service/state/pm-poc-state.json`）に最新データを保存します。コンテナ再起動時に状態復元が期待どおり行われることを以下の手順で確認できます。

1. スタック起動: `podman compose -f podman-compose.yml up -d`
2. サンプル変更: 別シェルで以下コマンドを実行し、新規プロジェクトとタイムシートを投入します。
   ```bash
   curl -X POST http://localhost:3001/api/v1/projects \
     -H 'Content-Type: application/json' \
     -d '{"projectCode":"POC-999","projectName":"Persist Check","status":"planned"}'

   curl -X POST http://localhost:3001/api/v1/timesheets \
     -H 'Content-Type: application/json' \
     -d '{"projectCode":"POC-999","userName":"永続テスター","hours":5.5,"workDate":"2025-09-15"}'
   ```
3. 状態ファイル確認: `services/pm-service/state/pm-poc-state.json` に追加されたレコードが記録されていることを確認します。
4. スタック停止 → 再起動: `podman compose -f podman-compose.yml down` → `podman compose -f podman-compose.yml up -d`
5. API再取得: `curl http://localhost:3001/api/v1/projects` などで投入したデータが復元されていることを確認します。
6. リセットが必要な場合は `scripts/reset_pm_state.sh` を実行すると状態ファイルが初期化されます。
   - MinIO 連携中に添付ファイルをクリアしたい場合は `scripts/reset_pm_state.sh --with-minio` を使用すると、状態ファイルに加えてバケット上の `compliance/` / `timesheets/` オブジェクトも削除できます。

#### 設定（環境変数）
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
