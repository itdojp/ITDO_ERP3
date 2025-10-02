# PoC Metrics Template

## Measurement Plan
- **環境準備**: `poc/event-backbone/local` の Podman Compose を利用し、AWS/GCP いずれの構成も `NUM_SHARDS`, `PRODUCER_BATCH` を変更して同条件に揃える。ローカル確認は `scripts/run_podman_poc.sh` を実行するだけで完了する。
- **ウォームアップ**: 各バッチ実行前に 1,000 件のドライランを実施し、コネクション確立時間を除外。
- **計測**: k6 もしくは内蔵スクリプトで送信し、`producer`/`consumer` 双方のログから Latency/Throughput を収集。MinIO 利用有無で差分を確認。
- **メトリクス収集**: CloudWatch / Cloud Monitoring / Prometheus から p50/p95/p99 を取得。コストは公式料金表に基づき 1万 / 10万 イベントの月間推定を算出。
- **記録**: 下記テンプレートに各試行の生データと平均値を記入し、Issue #X (決定チケット) へリンクする。

## Workload
- Batches: 100 / 1,000 / 10,000 events
- Payload size (bytes): avg / p95 / max
- Runs: 3 per batch size (average the results)

## AWS Results

### 100 events
- E2E latency (ms): p50=TBD / p95=TBD / p99=TBD
- Throughput (events/s): sustained=TBD / peak=TBD
- Failures: to DLQ=TBD% / recovery time=TBDs
- Idempotency: duplicates blocked=TBD%
- Cost est. (month): EventBridge=TBD / SQS=TBD / Lambda=TBD / S3=TBD

### 1,000 events
- E2E latency (ms): p50=TBD / p95=TBD / p99=TBD
- Throughput (events/s): sustained=TBD / peak=TBD
- Failures: to DLQ=TBD% / recovery time=TBDs
- Idempotency: duplicates blocked=TBD%
- Cost est. (month): EventBridge=TBD / SQS=TBD / Lambda=TBD / S3=TBD

### 10,000 events
- E2E latency (ms): p50=TBD / p95=TBD / p99=TBD
- Throughput (events/s): sustained=TBD / peak=TBD
- Failures: to DLQ=TBD% / recovery time=TBDs
- Idempotency: duplicates blocked=TBD%
- Cost est. (month): EventBridge=TBD / SQS=TBD / Lambda=TBD / S3=TBD

## GCP Results

### 100 events
- E2E latency (ms): p50=TBD / p95=TBD / p99=TBD
- Throughput (events/s): sustained=TBD / peak=TBD
- Failures: to DLT=TBD% / recovery time=TBDs
- Idempotency: duplicates blocked=TBD%
- Cost est. (month): Pub/Sub=TBD / Cloud Run=TBD / BigQuery=TBD / GCS=TBD

### 1,000 events
- E2E latency (ms): p50=TBD / p95=TBD / p99=TBD
- Throughput (events/s): sustained=TBD / peak=TBD
- Failures: to DLT=TBD% / recovery time=TBDs
- Idempotency: duplicates blocked=TBD%
- Cost est. (month): Pub/Sub=TBD / Cloud Run=TBD / BigQuery=TBD / GCS=TBD

### 10,000 events
- E2E latency (ms): p50=TBD / p95=TBD / p99=TBD
- Throughput (events/s): sustained=TBD / peak=TBD
- Failures: to DLT=TBD% / recovery time=TBDs
- Idempotency: duplicates blocked=TBD%
- Cost est. (month): Pub/Sub=TBD / Cloud Run=TBD / BigQuery=TBD / GCS=TBD

## Observations
- Operational notes (alerts, dashboards): TBD
- DX (local testing, logs, traces): TBD
- Risks & mitigations: TBD

## Local Smoke Test (Podman)
- Date: 2025-10-02
- Config: `NUM_SHARDS=4`, `PRODUCER_BATCH=100`, `PRODUCER_RPS=20`, `USE_MINIO=false`
- Result: producer送信100件完了・DLQなし（`podman logs local_producer_1`で確認）。
- Notes: RabbitMQ/Redis/pm-serviceのみ起動した軽量構成。consumerは未起動のためE2Eレイテンシは未計測。

## Decision Summary
- Winner: AWS | GCP (TBD)
- Rationale: cost / ops / performance / reliability / DX (TBD)
