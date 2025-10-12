# Projects Slack 共有 CLI ガイド

Projects 一覧の共有メッセージを手元や CI から生成するときは `scripts/project-share-slack.js` を利用します。UI の共有モーダルと同じロジックでフィルタ内容を整形し、Slack でそのまま貼り付けられるフォーマットを作れます。

## 前提条件
- Node.js 20 以上を利用することを想定しています（GitHub Actions では `actions/setup-node@v4` を使用）。
- `ui-poc` ディレクトリで `npm install` を実行し、依存関係を解決しておきます。

## 基本的な使い方
最小構成では共有リンク URL を渡すだけでテキスト形式を出力します。

```bash
node scripts/project-share-slack.js \
  --url 'https://example.com/projects?status=active&manager=Yamada'
```

必要に応じてタイトルやメモを付与できます。

```bash
node scripts/project-share-slack.js \
  --url 'https://example.com/projects?status=active&manager=Yamada' \
  --title 'Weekly Projects Update' \
  --notes 'ヘルスチェック済み'
```

`ui-poc/package.json` には npm スクリプトも用意されています。

- `npm run share:projects -- --url <url> ...`
- `npm run --silent share:projects:sample`（サンプルの URL/TITLE/NOTES は環境変数で上書き可能）

## 出力形式の切り替え
`--format` オプションで text / markdown / json の 3 形式を切り替えられます（既定値は text）。

```bash
# Markdown
node scripts/project-share-slack.js --url '<URL>' --format markdown

# JSON
node scripts/project-share-slack.js --url '<URL>' --format json
```

JSON 形式では Slack で利用するメッセージ文字列に加え、フィルタ条件や生成日時が含まれます。

```json
{
  "title": "Weekly Projects Update",
  "generatedAt": "2025-10-10T21:30:00.000Z",
  "filters": {
    "status": "active",
    "manager": "Yamada",
    "tags": ["DX", "SAP"],
    "count": 24
  },
  "projectCount": 24,
  "message": ":clipboard: *Weekly Projects Update* _(2025/10/11 6:30:00)_\n..."
}
```

この JSON をそのままワークフローへ渡すことで、Slack 以外の通知基盤にも再利用できます。
`--count <number>` を指定すると、bullet / JSON の両方に対象件数 (`filters.count` / `projectCount`) が含まれるため、KPI 抜粋やダッシュボードとの照合にも活用できます。

Slack への投稿を自動化したい場合は Incoming Webhook URL を `--post` に渡してください。メッセージ本文（text 形式）がそのまま送信されます。

```bash
node scripts/project-share-slack.js \
  --url '<URL>' \
  --format json \
  --post 'https://hooks.slack.com/services/XXX/YYY/ZZZ'
```

Webhook 呼び出しに失敗すると終了コード 1 で落ちるため、CI でも失敗を検知できます。Slack Webhook の応答本文が `ok` になることを保証したい場合は `--ensure-ok` を併用してください。ネットワーク揺らぎへの耐性を持たせたい場合は `--retry 3 --retry-delay 2000` のように再送回数と待機ミリ秒を指定できます。

- `--retry-backoff` で遅延時間に乗算する係数（既定 2）を調整できます。
- `--retry-max-delay` で遅延時間の上限をミリ秒単位で指定できます（既定 60000）。
- `--retry-jitter` で各再試行に加算する 0〜指定値ミリ秒のジッタを追加できます。
- `--respect-retry-after` を付けると、Slack から返される `Retry-After` ヘッダー（秒/日時）に応じて次回再試行までの待機時間を自動で延長します。
- `--fetch-metrics` を有効にすると、Projects API から集計指標（件数 / リスク件数 / 警戒件数）を取得して JSON 出力に含めます。API の接続情報は `--projects-api-base` / `--projects-api-token` / `--projects-api-tenant` / `--projects-api-timeout` で上書きできます。

## 設定ファイルの利用
繰り返し利用する設定は JSON ファイルにまとめておくのがおすすめです。`--config <path>` を指定すると、ファイル内の値を既定値として読み込み、CLI 引数で上書きできます。

```json
{
  "url": "https://example.com/projects?status=planned",
  "title": "Weekly Projects",
  "notes": "Config から読み込んだメモ",
  "format": "json",
  "count": 12,
  "retry": 2,
  "retryDelay": 1500,
  "ensure-ok": true,
  "post": ["https://hooks.slack.com/services/AAA/BBB/CCC"]
}
```

```
node scripts/project-share-slack.js --config share.config.json
```

`post` は文字列または配列を指定でき、CLI 側で `--post` を複数回指定した場合はすべての Webhook に送信されます。`ensure-ok` / `respect-retry-after` / `fetch-metrics` / `retry` / `retry-delay` / `retry-backoff` / `retry-max-delay` / `retry-jitter` も同様に設定ファイルで既定値を定義できます。

Projects API の接続情報は `projectsApi` セクションで管理します。

```json
{
  "projectsApi": {
    "baseUrl": "https://api.example.com",
    "token": "${PROJECTS_API_TOKEN}",
    "tenant": "example",
    "timeoutMs": 15000,
    "fetchMetrics": true
  }
}
```

CLI から明示的に `--projects-api-base` などを渡さない場合、このセクションの値が既定として使われます。トークンやテナント ID は環境変数 `PROJECTS_API_TOKEN` / `PROJECTS_API_TENANT` からも読み取れるため、CI ではシークレットを環境変数として注入する運用が推奨です。

Webhook ごとに異なるリトライ設定を適用したい場合は、`post` 配列にオブジェクト形式で URL と上書き値を定義します。

```json
{
  "post": [
    {
      "url": "https://hooks.example.com/services/AAA/BBB/CCC",
      "retry": 2,
      "retryDelay": 1000,
      "retryBackoff": 1.5,
      "retryMaxDelay": 5000,
      "retryJitter": 250,
      "ensure-ok": false,
      "respectRetryAfter": true
    }
  ]
}
```

このように記述すると、特定の Webhook だけ異なる再送回数や遅延、`ensure-ok` の有無、Retry-After ヘッダーの扱いなどを個別に設定できます。配列内では文字列 URL とオブジェクト設定を混在させることも可能です。

`templates` にプリセットを定義すると、`--template <name>` で適用できます。テンプレートで指定した値は CLI 引数に先立って設定されるため、雛形を用意した上で必要な部分だけ上書きするといった使い方ができます。

`--audit-log <path>` を指定すると、Webhook 投稿の各試行（成功/失敗、ステータスコード、待機時間など）を JSON に記録します。リトライ設定と合わせて運用監査の材料にできます。

テンプレートを定義した場合は `--template <name>` で呼び出せます。テンプレート内で指定した値は CLI 引数よりも前に適用されるため、雛形を決めてから一部のみ上書きできます。

テンプレート一覧は `--list-templates` で確認でき、特定のテンプレートを削除したい場合は `--remove-template <name>` を指定します（`--config` で対象ファイルを渡す必要があります）。CLI がテンプレート削除後の JSON を上書き保存するため、削除前に Git 管理やバックアップを取っておくと安全です。

## CI への組み込み例
`.github/workflows/projects-share-template.yml` では CLI を定期実行して体裁崩れを検知しています。JSON 出力を検証する際は `jq` で値をチェックすると安全です。

```yaml
- name: Verify CLI markdown/json output
  run: |
    node scripts/project-share-slack.js --url 'https://example.com/projects?status=active' --format markdown > /tmp/share.md
    node scripts/project-share-slack.js --url 'https://example.com/projects?status=active' --format json | jq -e '.filters.status == "active"'
```

GitHub Actions と同じコマンドをローカルで実行すれば、CI と同じ結果を再現できます。

## トラブルシューティング
- URL にクエリ文字 `&` を含める場合はシェルに解釈されないよう `'` で囲みます。
- `Unknown format` エラーが出る場合は `text` / `markdown` / `json` のいずれかを指定しているか確認してください。
- 文字化けを避けるため、端末のロケールを UTF-8 に設定しておくことを推奨します。
