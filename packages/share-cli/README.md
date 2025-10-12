# @itdo/share-projects

Projects 一覧の共有メッセージを生成する CLI です。リポジトリを直接参照して `npx` から利用できます。

```bash
npx github:itdojp/ITDO_ERP3#feature/share-cli-webhook-policies share-projects --url "https://example.com/projects?status=active" --title "Weekly Projects" --post "$PRIMARY_WEBHOOK"
```

任意のブランチ／タグを指定し、`--config` や `--audit-log` など既存の引数をそのまま利用できます。
