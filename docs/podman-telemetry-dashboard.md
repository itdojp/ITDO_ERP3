# Podman Telemetry Dashboard Guide

PoC で流れる Telemetry イベントやメトリクスを Grafana/Loki から確認する手順をまとめます。pm-service が出力するログは JSON 形式で保存されるため、Loki の LogQL を使って柔軟に検索できます。

## 前提
- `scripts/run_podman_ui_poc.sh --detach` などで Podman スタックを起動していること
- Grafana が `http://localhost:3000` で利用可能であること（ユーザー/パスワードともに `admin` 既定）
- Loki データソースが `Loki` という名前で登録済み（コンポーズファイル既定）
- ダッシュボード JSON (`poc/event-backbone/local/grafana/dashboards/poc-telemetry.json`) は `scripts/run_podman_ui_poc.sh` で自動プロビジョニングされます。

## Explore でのクイックチェック
1. ブラウザで Grafana にアクセスし、左メニューの **Explore** を開く。
2. データソースに `Loki` を選択し、以下のクエリを実行。
   ```logql
   {app="pm-service", level="info"} |= "telemetry"
   ```
3. `/api/v1/telemetry/ui` へ投入されたサンプルイベントが表示されます。`JSON` ビューに切り替えると `detail.seeded` フラグが確認できます。
4. 起動直後にイベントが 0 件の場合は、ログに `[telemetry] log empty after startup, retrying seed` が出力されるので、自動リトライが動作したかどうかを確認してください。

## ダッシュボードの追加
1. Grafana で **Dashboards > New > New dashboard** を開き、**Add visualization** を選択。
2. データソースに `Loki` を指定し、以下の LogQL を入力します。
   ```logql
   sum by (component) (count_over_time({app="pm-service"} |= "\"seeded\": true" [$__range]))
   ```
3. 可視化タイプを `Bar gauge` に変更すると、シード済みイベント数の内訳をリアルタイムで追跡できます。
4. パネルタイトルを `Telemetry seeded events` に変更し、保存します。

## 追加の便利クエリ
- **Retry の検出**
  ```logql
  count_over_time({app="pm-service"} |= "retrying seed" [$__range])
  ```
  → pm-service が自動リトライを試みた回数を確認できます。

- **Fallback 状態の判定**
  ```logql
  {app="pm-service"} |= "PODMAN_HOST_FALLBACK_ACTIVE"
  ```
  → host fallback が有効になったタイミングを把握できます。

## UI 手順書との連携
- Telemetry 画面の操作後に上記クエリを実行し、UI 上でのアクションがログへ反映されているか検証してください。
- Slack 通知と組み合わせて、`scripts/podman_status.sh` が送信した `telemetry seed ok/failure` メッセージのタイムスタンプと Grafana のログの整合性を確認すると原因分析が容易になります。

## Loki への追加取り込み

`scripts/collect_telemetry_health.sh` を cron 等で実行すると `/health/telemetry` の結果が `logs/telemetry-health/telemetry-health.ndjson` に追記されます。Promtail の additional scrape 対象に含めることで Grafana からステータスを確認できます。

```bash
PM_PORT=3103 OUTPUT_DIR=/var/log/poc scripts/collect_telemetry_health.sh
```

---
必要に応じてこのガイドを更新し、よく使うログクエリやパネル構成を蓄積してください。
