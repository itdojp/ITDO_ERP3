# Slack 通知ランブック

PoC スモークテストや `podman_status.sh` の実行状況は Slack Webhook を設定すると通知されます。本書では通知フォーマットと想定されるアクションをまとめます。

## 通知レベル

| レベル | 送信元 | 例 | 対応 |
| --- | --- | --- | --- |
| `failure` | `poc_live_smoke.sh`, `podman_status.sh` | `pm-service failed health check` | 収集済みログ（`logs/poc-smoke/`）を確認し、必要に応じて再試行。 |
| `warning` | `poc_live_smoke.sh`, `podman_status.sh` | `Host fallback enabled (attempt=1, host=host.containers.internal)` | フォールバックが成功したか、続く成功通知で確認。多数発生する場合は DNS/ネットワークを調査。 |
| `success` | 両スクリプト | `Live smoke completed successfully (runs=1, fallback=used, telemetry=verified-after-reset)` | 依頼者に共有しつつ、`fallback` や `telemetry` のサマリ値を確認。 |

## Telemetry seed の詳細

成功通知には Telemetry seed の情報が含まれます。

```
telemetry=verified (seeded=5, min=5, attempts=1)
```

- `seeded`: 最終的に確認できた seeded イベント数。`failed`/`unreachable` などの文字列が入ることもあります。
- `min`: `TELEMETRY_MIN_SEEDED` の値。
- `attempts`: 検証に要した試行回数（自動リセットの回数を含む）。

`podman_status.sh` は成功通知を抑制したい場合に `PODMAN_STATUS_SLACK_NOTIFY_SUCCESS=false` を利用できます。`poc_live_smoke.sh` は成功通知を常に送信します。

## トラブルシュート

1. **failure 通知が届いた場合**: 通知内の `reason` を確認し、`logs/poc-smoke/` にある収集ログから詳細を切り分けます。
2. **warning のみで終了する場合**: フォールバック後に success 通知が届かないときは、スタックが停止していないか（`podman-compose ps`）を確認し再実行してください。
3. **通知が来ない場合**: `SLACK_WEBHOOK_URL` が環境変数として渡されているか、Outbound が許可されているかを確認します。`podman_status.sh` / `poc_live_smoke.sh` は送信失敗時に標準エラーへ警告を出力します。

より詳細な実行手順は [PoC Live Smoke Tests](poc_live_smoke.md) を参照してください。
