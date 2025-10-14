# Templates Directory

Phase2 以降で利用する Codex CLI テンプレート群です。`scripts/templates/create-module.js` を使うことで雛形をプロジェクトに追加できます。

## テンプレート一覧
- `nest-module/` : NestJS + GraphQL モジュール (module/service/resolver)
- `terraform-stack/` : 監視スタックなどの Terraform 骨格
- `runbook/` : 運用 Runbook の雛形

## 使い方
```
node scripts/templates/create-module.js --type nest-module --name crm --target services/project-api/src/modules
```

テンプレート内の `{{name}}` や `{{pascalName}}` などのプレースホルダが、指定した名前に置き換わります。
