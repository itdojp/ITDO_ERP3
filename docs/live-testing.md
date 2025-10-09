# UI PoC Live Testing Guide

このドキュメントでは、Podman ベースのバックエンド PoC と Next.js UI を組み合わせたライブ検証の手順をまとめています。MinIO 署名 URL の確認や GraphQL/SSE の整合性チェック、GitHub Actions を利用した自動化のポイントを含みます。

## 1. 必要ツールの確認
- Podman / podman-compose
- Node.js 20 系（`npm` が利用可能なこと）
- `curl`（ヘルスチェックで使用）
- Playwright（`npx playwright install chromium` 済み）

## 2. ローカルでのライブ検証
```bash
# デフォルト設定でライブテストのみ実行
make live-tests

# MinIO 署名 URL を必須にしたい場合
make live-tests-minio PM_PORT=3101 UI_PORT=4100 UI_HEADLESS=true

# 直接スクリプトを呼び出したい場合
FORCE_PM_PORT=3001 USE_MINIO=true PM_PORT=3101 UI_PORT=4100 UI_HEADLESS=true scripts/run_podman_ui_poc.sh --tests-only
```

- `FORCE_PM_PORT=3001` : Playwright ライブテストを既定ポート 3001 で実行するためにスタックを再起動します。
- `USE_MINIO=true` : MinIO サービスを有効化し、署名付き URL の生成をテストします（`make live-tests-minio` が自動で付与）。
- `SKIP_GRAPHQL_PREFLIGHT=true` を指定すると、GraphQL ウォームアップをスキップして素早くテストに入れます（起動直後の 400 応答が気になる場合は `false` のままにしてください）。
- `E2E_REQUIRE_MINIO=true` を併用すると、Playwright が MinIO 署名 URL の有無を検証します。

- `PODMAN_AUTO_HOST_FALLBACK=true` (既定値) の状態では、pm-service のヘルスチェックに失敗した際に `host.containers.internal` を経由した再起動を自動的に試行します。環境に応じて無効化したい場合は `PODMAN_AUTO_HOST_FALLBACK=false` を指定してください。
- Telemetry seed 検証が失敗した場合は `TELEMETRY_SEED_AUTO_RESET=true` を指定すると `scripts/reset_pm_state.sh` を実行し、pm-service を再起動してシードを再投入します。MinIO も初期化したい場合は `TELEMETRY_SEED_RESET_WITH_MINIO=true` を併用してください。再試行回数は `TELEMETRY_SEED_MAX_ATTEMPTS`（既定 2）、ヘルス回復後の待機秒数は `TELEMETRY_SEED_SETTLE_SECONDS`（既定 2）で調整できます。
- フォールバックで利用するホスト名を変更したい場合は `HOST_INTERNAL_ADDR` を上書きできます (既定: `host.containers.internal`)。

## 3. 個別の E2E テスト
```bash
cd ui-poc
E2E_EXPECT_API=true npm run test:e2e:live
# MinIO 必須にする場合
E2E_EXPECT_API=true E2E_REQUIRE_MINIO=true npm run test:e2e:live
```
`npm run test:e2e` だけ実行する場合は、Podman スタックが無くてもモック動作を含めた UI の回帰が確認できます。

## 4. GitHub Actions でのライブ検証
- `.github/workflows/api-live-minio.yaml` を手動トリガーすると、`USE_MINIO=true`／`E2E_REQUIRE_MINIO=true` に加え、`FORCE_PM_PORT=3001` でポートを統一した状態で Playwright のライブシナリオが走ります。
- 成功時は Playwright の HTML レポートがアーティファクトとしてアップロードされます。

## 5. トラブルシューティング
| 症状 | 対策 |
| ---- | ---- |
| GraphQL `/graphql` が 400 を返し続ける | `SKIP_GRAPHQL_PREFLIGHT=false` にしてプレフライトを有効化し、GraphQL が安定するまで待つ。pm-service ログで `rabbitmq connect failed` が続いていないか確認。 |
| MinIO 署名 URL が `https://example.com/...` のまま | `USE_MINIO=true` が渡っているか、`pm-service` のログに MinIO エラーがないかを確認。`scripts/reset_pm_state.sh --with-minio` で状態を再生成する。 |
| Playwright が `ECONNREFUSED 127.0.0.1:3001` で失敗 | `FORCE_PM_PORT` を 3001 に設定した上で `scripts/run_podman_ui_poc.sh --tests-only` を実行し、PoC API を既定ポートで立ち上げ直す。 |

## 6. 参考
- `scripts/run_podman_ui_poc.sh`: Podman スタックと UI 起動を一括管理するスクリプト。`FORCE_PM_PORT` / `SKIP_GRAPHQL_PREFLIGHT` 等の環境変数で挙動を制御できます。
- `docs/poc_live_smoke.md`: PoC スモークテスト（Grafana manifest 検証など）の詳細は別ドキュメントを参照してください。

---
MinIO や GraphQL/SSE といったライブ検証は、PoC 段階でも実際の運用に近い動作を早期に確認するために重要です。上記手順をテンプレートとして活用し、必要に応じてカスタマイズしてください。
