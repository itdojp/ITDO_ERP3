# PoC Metrics Template

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

## Decision Summary
- Winner: AWS | GCP (TBD)
- Rationale: cost / ops / performance / reliability / DX (TBD)
