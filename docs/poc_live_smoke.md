# PoC Live Smoke Tests

`scripts/poc_live_smoke.sh` は Podman スタックを起動し、pm-service・Grafana・Telemetry の健全性をまとめて検証するスモークテストです。ここでは Slack 通知やフォールバック設定など、運用時に押さえておきたい情報を整理します。

## Slack 通知

`SLACK_WEBHOOK_URL` を設定すると進捗が Slack に投稿されます。通知レベルとメッセージの読み方は次の通りです。

| レベル | 例 | 説明 |
| --- | --- | --- |
| `failure` | `pm-service failed health check` | 致命的なエラーが発生した場合。対応後は `logs/poc-smoke` の収集ログを参照して原因を確認します。 |
| `warning` | `Host fallback enabled (attempt=1, host=host.containers.internal)` | pm-service の起動に時間がかかり、`host.containers.internal` へのフォールバックを試みた際に送信されます。フォールバック後も問題が続くと `failure` へ移行します。 |
| `success` | `Live smoke completed successfully (runs=1, fallback=used, telemetry=verified-after-reset)` | `fallback=used/unused` でフォールバックの有無、`telemetry=<status>` で Telemetry seed 検証の結果を確認できます。 |

Slack 通知例:

```
[warning] Host fallback enabled (attempt=1, host=host.containers.internal)
[success] Live smoke completed successfully (runs=1, fallback=used, telemetry=verified-after-reset)
```

補助スクリプトの `scripts/podman_status.sh` でも `SLACK_WEBHOOK_URL` を指定すると同様の通知が送信されます。成功時の通知が不要な場合は `PODMAN_STATUS_SLACK_NOTIFY_SUCCESS=false` のまま抑制できます。

## フォールバック関連の環境変数

| 変数 | 既定値 | 役割 |
| ---- | ------ | ---- |
| `PODMAN_AUTO_HOST_FALLBACK` | `true` | pm-service が `TIMEOUT_SECONDS` 内に起動しない場合にフォールバックを試すかどうか。 |
| `HOST_INTERNAL_ADDR` | `host.containers.internal` | フォールバック時に使用するホスト名。Podman Desktop など環境に応じて変更できます。 |
| `POC_LOKI_URL` | `http://loki:3100` | Grafana の Loki データソース URL。フォールバックが発動した場合は自動的に `http://localhost:${LOKI_PORT}` へ切り替わります。 |

## Telemetry seed 検証

| 変数 | 既定値 | 役割 |
| ---- | ------ | ---- |
| `TELEMETRY_MIN_SEEDED` | `5` | Telemetry API (`/api/v1/telemetry/ui`) に期待する seeded イベント件数。 |
| `TELEMETRY_SEED_AUTO_RESET` | `false` | 検証失敗時に `scripts/reset_pm_state.sh` を実行し、pm-service をリセットした上で再検証するかどうか。 |
| `TELEMETRY_SEED_MAX_ATTEMPTS` | `2` | 自動リセットが有効な場合の最大試行回数。 |
| `TELEMETRY_SEED_SETTLE_SECONDS` | `2` | pm-service 再起動後に Telemetry API を再確認するまでの待機秒数。 |

成功通知の `telemetry` フィールドは以下を表します。

| 表示値 | 意味 |
| --- | --- |
| `verified` | 初回検証で閾値を満たした。 |
| `verified-after-reset` | 自動リセット後に閾値を満たした。 |
| `failed` | Telemetry API の閾値未達。 |
| `failed-endpoint` | Telemetry API に到達できなかった。 |
| `skipped-no-python` | Python が見つからず検証できなかった。 |

---

より詳細な手順や GitHub Actions での実行方法は [`docs/live-testing.md`](live-testing.md) を参照してください。
