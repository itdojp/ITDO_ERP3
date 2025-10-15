# 自然言語クエリ PoC (LangGraph)

Phase2 BI モジュールで計画している LangGraph ベースの自然言語クエリを再現する PoC。Issue #298 / #159。

## 構成
1. Intent Resolver: ユーザー入力から KPI / 指標を推定
2. Query Planner: Athena 用 SQL を生成
3. Executor: 環境変数が設定されている場合は Athena に接続し、なければダミーデータを返却
4. Summarizer: 結果を日本語で返却

`flow.ts` では疑似的なノード実装を記載しています。LangGraph 実装時は `@langchain/langgraph` を導入し、各ノードをエージェント化してください。

## 使い方
```bash
cd examples/bi/nl-query-poc
npm install
node flow.ts <<<'案件の受注率を教えて'
```

### Athena 連携の前提
以下の環境変数を設定すると、PoC は実際の Athena に対してクエリを実行します。未設定の場合は従来通りのダミーデータを返却します。

| 変数名 | 説明 |
|--------|------|
| `AWS_REGION` | 利用するリージョン（例: `ap-northeast-1`） |
| `ATHENA_WORKGROUP` | 実行対象のワークグループ名（Terraform `aws_athena_workgroup.analytics_workgroup` と揃える） |
| `ATHENA_DATABASE` | Glue Catalog 上のデータベース名（例: `analytics_dev`） |
| `ATHENA_OUTPUT_LOCATION` | クエリ結果の出力先 `s3://.../athena-results/` |
| `ATHENA_POLL_INTERVAL_MS` | （任意）ステータスポーリング間隔、既定 1500ms |
| `ATHENA_TIMEOUT_MS` | （任意）タイムアウト、既定 60000ms |

Athena 連携を有効化した状態でエラーが発生した場合は `DEBUG=1` を指定するとフォールバック理由を標準出力へ書き出します。
