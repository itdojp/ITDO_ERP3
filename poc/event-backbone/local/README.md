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

開発中にビルド済みイメージを再利用したい場合は `PODMAN_BUILD=false scripts/run_podman_ui_poc.sh --no-build` のように指定すると、`podman-compose --build` をスキップできます。

メトリクスは `/metrics/summary` のほか `/metrics/stream` から Server-Sent Events (SSE) 形式で購読可能です。ダッシュボードや通知向けに利用してください。

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
 - MINIO_PUBLIC_ENDPOINT/MINIO_PUBLIC_PORT: 署名付きURLを生成する際の公開URL（デフォルト localhost:9000）
 - MINIO_MAX_RETRIES/MINIO_RETRY_BACKOFF_MS: MinIOシード処理のリトライ回数/バックオフ設定
  - IDEMP_TTL_MS: Idempotency-Key を Redis に保持する期間（ミリ秒）。デフォルトは 24 時間。

テスト
- Producerログ: 送信件数とシャード割り当て
- Consumerログ: invoice生成（冪等時はskip表示）
- RabbitMQ管理画面: http://localhost:15672 （user: guest / pass: guest）
- Redis: idempotencyキーを格納（`idemp:{key}`）

#### Observability (Loki + Promtail)
- `poc/event-backbone/local/logging/promtail-config.yml` で `logs/poc-smoke/*.log` を対象に Promtail を構成しています。
- `scripts/poc_live_smoke.sh` は失敗時に `logs/poc-smoke/` 以下へスタックログを収集し、Promtail 経由で Loki に連携されます。
- Loki の UI は http://localhost:3100/ からアクセスできます。
- Grafana は http://localhost:3000/ （既定ユーザー: `admin` / パスワード: `admin`） で起動し、Loki データソースと PoC Logs ダッシュボードが事前設定されています。
- `dashboards/poc-metrics.json` を通じて `/metrics/summary` のスナップショットログを可視化するテンプレートを追加しました。ログ面からメトリクス変化を追跡し、SSE と組み合わせて Podman 側の監視に活用できます。
- Grafana のサイドバーから **Dashboards → Browse → Poc Dashboards** を開くと、以下の2つのダッシュボードが利用できます。
  - `PoC Metrics Overview`: `/metrics/summary` と `/metrics/stream` の値を時系列で確認（ログ由来）。SSEでの最新値を確認したい場合は「Refresh」を実行してください。
  - `PoC Logs Explorer`: Loki へ送信された pm-service / producer / consumer / Playwright スモークログを検索できます。`{app="pm-service"}` のクエリで pm-service ログだけを絞り込めます。
  - `PoC UI Telemetry`: UI クライアント/サーバが `POST /api/v1/telemetry/ui` に送ったイベントをリアルタイムで確認できます（Loki クエリ `{job="poc-telemetry"}`）。
- **Alerting → PoC Alerts** フォルダには `TelemetryFallbackSpike` アラートが事前登録されており、5分間に複数回モックフォールバックが発生した際に警告として検知できます。スモークスクリプト (`scripts/poc_live_smoke.sh`) は Grafana のルール/アラート API を監視し、ルールが失われた場合やアラートが発火した場合は Slack 通知とログ採取を行います。
- 同スクリプトではダッシュボード API も照会し、`poc/event-backbone/local/grafana/provisioning/dashboards/manifest.json` に列挙したタイトル/UID (`PoC Metrics Overview` / `PoC Logs Explorer` / `PoC UI Telemetry`) と同じものが Grafana 上に存在するかを確認します。欠落している場合は失敗として扱われ、`last_grafana_dashboards.json` がアーティファクトに含まれます。
- ダッシュボード構成が manifest と一致しているかをローカルで確認したい場合は、プロジェクトルートで `python3 scripts/check_grafana_manifest.py` を実行してください。manifest に未登録のファイルやタイトル/UID の不整合を検出し、CI（`poc-live-smoke` ワークフロー）でも同じ検証を行っています。
- `pm-service` の Telemetry API (`POST /api/v1/telemetry/ui`) に送信されたイベントは `/var/log/poc-smoke/telemetry.log` にも追記され、Promtail 経由で Loki へ転送されます。UI から `reportClientTelemetry` / `reportServerTelemetry` を呼び出すことでフォールバック発生状況を追跡できます。
- Telemetry ログは既定で 5MB 超過時にローテーションされ、最大3世代 (`telemetry.log.[1-3]`) を保持します。閾値は `TELEMETRY_MAX_LOG_BYTES`、保持数は `TELEMETRY_LOG_MAX_ARCHIVES` で調整可能です。
- 最新 200 件の Telemetry イベントは `GET /api/v1/telemetry/ui` でも取得できます。開発時に即座に確認したい場合は `curl http://localhost:3001/api/v1/telemetry/ui` を利用してください。
- クエリパラメータでは `component` / `event` / `detail` / `detail_path` / `level` / `origin` によるフィルタと、`since` / `until` の日付範囲絞り込み、`sort`（`receivedAt`/`timestamp`/`component`/`event`/`level`/`origin`）と `order`（`asc`/`desc`）による並び替えを指定できます。`detail_path` は JSONPath 風の表記 (`$.detail.marker`、`items[1].code`、`checks[*].status` など) に対応しており、配列やワイルドカードを含むネストオブジェクトの検索も可能です。
- `scripts/poc_live_smoke.sh` は `/metrics/summary` のヘルスチェックに加えて `/metrics/stream` の SSE が即時にイベントを返すかも検証し、結果を `logs/poc-smoke/last_metrics_stream.txt` に保存します。
- `scripts/metrics_stream_stress.js` を利用すると複数クライアントで `/metrics/stream` を同時購読する簡易ロードテストを実施できます。例: `METRICS_STREAM_CLIENTS=25 node scripts/metrics_stream_stress.js`
- `scripts/show_telemetry.js` は Telemetry API の最新イベントを一覧表示するユーティリティです。
- `scripts/poc_live_smoke.sh` は RabbitMQ / Redis / MinIO / Loki / Grafana / pm-service それぞれを個別の待機ロジックで監視し、タイムアウトや接続不能時には Slack 通知とログ収集を行います。`RABBITMQ_TIMEOUT_SECONDS` や `GRAFANA_TIMEOUT_SECONDS` などの環境変数で待機時間を上書きできます。
- `.env` 経由で設定を調整したい場合は `scripts/.env.poc_live_smoke.example` を参考にしてください。SSE ストレス検証回数 (`METRICS_STREAM_ITERATIONS`) や WebSocket モード (`METRICS_STREAM_MODE=ws`) もここで変更できます。

#### GraphQL エンドポイント
- `pm-service` は REST API に加えて `http://localhost:3001/graphql` で GraphQL を公開しています。
- スキーマ例:
  ```graphql
  query DemoMetrics($refresh: Boolean) {
    metricsSummary(refresh: $refresh) {
      projects
      timesheets
      invoices
      events
      cachedAt
      stale
    }
    projects(status: "active") {
      id
      name
      status
      manager
    }
    recentEvents(limit: 10)
  }
  ```
- `NODE_ENV` が production でなければ GraphiQL が有効化されるため、ブラウザからクエリを試せます。
- MinIO 連携が有効な場合、請求書の添付 (`invoices.attachments.downloadUrl`) も署名付き URL に置き換えられます。
- ミューテーション例（抜粋）:
  ```graphql
  mutation CreateProject {
    createProject(
      input: { name: "GraphQL Demo", code: "GQL-001", clientName: "Internal", status: "planned" }
    ) {
      ok
      project { id name status manager }
    }
  }

  mutation SubmitTimesheet {
    createTimesheet(
      input: {
        userName: "Playwright Bot"
        projectCode: "DX-2025-01"
        hours: 4.0
        note: "GraphQL submission"
        autoSubmit: true
      }
    ) {
      ok
      timesheet { id approvalStatus submittedAt }
    }
  }

  mutation ApproveTimesheet($input: TimesheetActionInput!) {
    timesheetAction(input: $input) {
      ok
      message
      timesheet { id approvalStatus note }
    }
  }
  ```
- コンプライアンス検索も GraphQL から取得できます。
  ```graphql
  query ComplianceInvoices($keyword: String, $status: String, $page: Int = 1) {
    complianceInvoices(filter: { keyword: $keyword, status: $status, page: $page, pageSize: 10 }) {
      meta { total page pageSize totalPages sortBy sortDir }
      items {
        invoiceNumber
        counterpartyName
        issueDate
        amountIncludingTax
        status
        attachments { fileName downloadUrl }
      }
    }
  }
  ```

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
