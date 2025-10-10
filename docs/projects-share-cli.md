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
    "tags": ["DX", "SAP"]
  },
  "message": ":clipboard: *Weekly Projects Update* _(2025/10/11 6:30:00)_\n..."
}
```

この JSON をそのままワークフローへ渡すことで、Slack 以外の通知基盤にも再利用できます。

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
