# チャット要約検索 / 通知 Runbook

## 目的
- ベクトル保存されたチャット要約を検索して、プロジェクトごとのハイライトを即座に把握する。
- 日次・週次のサマリを Slack へ自動投稿し、PM/ステークホルダーのキャッチアップを支援する。

## API エンドポイント
- REST: `GET /api/v1/projects/:id/chat/summary-search?q=<keyword>&top=5&minScore=0.2`
- GraphQL: `projectChatSummarySearch(projectId: String!, keyword: String!, top: Int, minScore: Float)`

### パラメータ
| 名前 | 説明 | 既定値 |
|------|------|--------|
| `q` / `keyword` | 検索キーワード。ベクトル類似度でマッチングします。 | 必須 |
| `top` | 取得件数 (1〜20) | 5 |
| `minScore` | 類似度スコアしきい値 (0〜1) | 0.2 |

> ベクトル検索 → REST フォールバックの順に自動適用されます。pgvector が未設定でも文字列部分一致で応答します。

## Slack 通知 CLI
`scripts/notifications/send-summary.js`
```
node scripts/notifications/send-summary.js \
  --project PRJ-1001 \
  --base-url https://api.example.com \
  --keyword "リスク" \
  --top 3 \
  --webhook https://hooks.slack.com/services/... \
  --dry-run
```
- `--dry-run` を外すと Slack Webhook へ投稿。
- `PROJECT_API_BASE` 環境変数を設定すると `--base-url` 省略可。

## 運用フロー
1. 毎朝 9:00 の cron / GitHub Actions Nightly で CLI を実行し、#proj-daily に投稿。
2. 投稿内容に「score < 0.3」が多い場合は、`--keyword` を調整またはチャネルの要約更新を依頼。
3. 投稿失敗／0件の場合は Datadog アラートを確認し、pgvector 接続や Slack Webhook の有効性を点検。

## 障害対応
### 検索が失敗する
- Datadog Dashboard「Chat Summarizer SLA」で失敗率 (`chat_summarizer.search.error`) を確認。
- pgvector テーブル `chat_thread_embeddings` の extension/テーブル状態を確認。
- ベクトル取得が不可の場合は `--min-score 0 --dry-run` でテキスト検索結果を確認し暫定運用。

### Slack 投稿が失敗する
- Webhook URL が無効 (HTTP 410) の場合は再発行。
- Payload サイズ (40KB) 超過に注意。結果件数を `--top 3` などで縮小。

## 監視メトリクス
- `chat_summarizer.search.success` / `chat_summarizer.search.error`
- Nightly CLI 実行結果 (予定): GitHub Actions の exit code でモニタリング。

## 関連資料
- [Project Dashboard (AI ハイライト)](project-dashboard.md)
- [contracts/invoice-pipeline.md](../contracts/invoice-pipeline.md)
