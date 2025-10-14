# API ドキュメント

`./scripts/generate-api-docs.sh` を実行すると、OpenAPI/GraphQL の成果物が `docs/api` 配下に生成されます。GitHub Actions の **API Docs** ワークフローでも同じスクリプトを用いて差分チェックと PR コメント投稿を行います。PR では GitHub Pages プレビューリンクもコメントされるため、生成結果をブラウザで直接確認できます。

## OpenAPI
- [Projects v1 HTML](openapi/projects-v1.html)

## GraphQL
- [Project API Schema](graphql/index.html)
