# Podman UI PoC フロー手順

このドキュメントは、Podman スタック上で UI PoC を操作する際の標準手順をまとめたものです。環境準備から代表的な業務フロー、終了方法までを記載し、人による検証結果をそのまま本実装の改善に反映できるようにします。

## 前提

- `podman` / `podman-compose` が導入済みであること
- `ui-poc` ディレクトリで `npm install` 済みであること
- Playwright など E2E テストを並行して実行しないこと（ポート競合を避けるため）

## 起動手順

1. 端末 A でバックエンド + UI を起動（Detach 推奨）
   ```bash
   PM_PORT=3101 UI_PORT=4100 scripts/run_podman_ui_poc.sh --detach
   ```
   - `--detach` を付けるとスクリプトが即時終了し、他のターミナルで作業を継続できます。
   - ログ: `ui-poc/.next/dev.log`
   - コンテナ確認: `cd poc/event-backbone/local && podman-compose -f podman-compose.yml ps`

2. 動作確認
   ```bash
   curl -fsS http://localhost:3101/health
   curl -fsS http://localhost:4100 | head -n5
   ```
   200 が返ればスタックは正常に稼働しています。

## 代表業務フロー

| ステップ | 画面 | 操作 | 成功基準 | 備考 |
| -------- | ---- | ---- | -------- | ---- |
| 1 | Home | `http://localhost:4100/` を開く | Metrics パネルのカウントが表示される | `Podman Metrics Snapshot` を確認 |
| 2 | Projects | ナビゲーションから `Projects` を選択 | `API live` バッジが付き、カードが 4 件表示される | GraphQL エラーが出た場合は REST フォールバックを許容 |
| 3 | Timesheets | `Timesheets` を選択し、ステータス/メンバー/プロジェクトフィルタを操作 | フィルタサマリに入力値が反映され、テーブルが更新される | 承認/差戻しボタンでトースト表示を確認 |
| 4 | Compliance | `Compliance` を選択し、検索→ソート→ページング | リスト数が更新され、詳細パネルが表示される | Podman 停止時はモックバナーが表示される |
| 5 | Telemetry | `Telemetry` を選択し、フィルタを設定 → `適用` | 起動直後のサンプルイベント（5件）が表示され、フィルタ結果で絞り込みできる | 自動更新のカウントダウンが進んでいること |
| 6 | Metrics / Events | 必要に応じて `scripts/show_telemetry.js` や `/metrics/summary` を確認 | 最新イベント・メトリクスの値が更新されている | RabbitMQ/Redis を使ったイベントフローを確認する場合は `local_consumer` ログを参照 |

> 💡 テレメトリ PoC では、pm-service 起動時にサンプルイベントが自動投入されます。実検証用に空の状態で開始したい場合は `TELEMETRY_SEED_DISABLE=true` を環境変数として渡してください。

`scripts/podman_status.sh` を実行すると `Telemetry seed verification` セクションでシードイベント件数が自動判定されます。閾値を変更する場合は `TELEMETRY_MIN_SEEDED` 環境変数で上書きしてください。

検証結果は Issue コメントに箇条書きで残し、UI/UX 上の気付きや不具合を新規 Issue に切り出してください。

## 停止手順

```bash
# Podman スタックを停止
cd poc/event-backbone/local
podman-compose -f podman-compose.yml down

# Next.js Dev Server を停止（Detach モードの場合のみ）
pkill -f "next dev --hostname 0.0.0.0 --port"
```

`podman-compose down` は現在のネットワークとコンテナを全て削除します。次回起動時には `run_podman_ui_poc.sh --detach` を再実行してください。


## ログ記録とサンプル

- 簡易ヘルスチェック: `PM_PORT=3103 UI_PORT=4103 scripts/podman_status.sh` （Telemetry seed verification で seeded 件数を自動チェック）
- テンプレート: [`docs/podman-manual-log-template.md`](podman-manual-log-template.md)
- Telemetryイベント送信（追加が必要な場合）: `PM_PORT=3103 TELEMETRY_BASE=http://localhost:3103 scripts/send_telemetry_sample.sh manual/ui-check event_info` (curl のレスポンスは自動でログに記録されますが、エラーとなった場合は標準エラー出力にメッセージが表示されます)

### 実施例 (2025-10-07 08:00 JST)
| 項目 | 結果 | 備考 |
| ---- | ---- | ---- |
| `scripts/podman_status.sh` | ok | すべてのヘルスチェックが `ok` |
| Projects 件数 | 4 | `curl http://localhost:3103/api/v1/projects` |
| Timesheets submitted | 2 | `curl http://localhost:3103/api/v1/timesheets?status=submitted` |
| Compliance (limit=5) | 3 | `curl http://localhost:3103/api/v1/compliance/invoices?limit=5` |
| Telemetry | >=5 | `TELEMETRY_BASE=http://localhost:3103 node scripts/show_telemetry.js`（既定でサンプルイベントが投入済み） |

## トラブルシューティング

- **UI ポートが競合する**: `UI_PORT` を変更するか、既存の Next.js プロセスを停止します。
- **pm-service が 60 秒以内に起動しない**: `scripts/run_podman_ui_poc.sh` 使用時は自動で `host.containers.internal` フォールバックを試行します。ログ (`podman-compose logs local_pm-service_1`) を確認し、それでも解決しない場合は `PODMAN_AUTO_HOST_FALLBACK=false` で明示的に無効化した上で手動で再起動してください。MinIO 有効時は初回に時間が掛かる場合があります。
- **Grafana アラートが Loki に接続できない**: `POC_LOKI_URL` を `http://localhost:3100` などに上書きして再実行すると、DNS 解決を迂回できます。`scripts/run_podman_ui_poc.sh` のホストフォールバックでも自動でこの値に切り替わります。
- **GraphQL エラーで REST フォールバックになる**: 現状の PoC 仕様上許容されます。フォールバック後も UI 操作に支障がないか確認してください。
- **イベントが流れない**: `podman logs local_producer_1` / `local_consumer_1` を確認し、RabbitMQ の接続エラーが解消されているかチェックします。

以上の手順をベースに、人手によるワークフロー検証とフィードバック収集を継続してください。
