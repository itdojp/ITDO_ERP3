# 電子帳簿法対応 Runbook

## 目的
S3 Object Lock + KMS + DynamoDB を利用した電子帳簿法（WORM）準拠のストレージを Terraform で管理します。

## 手順概要
1. `iac/stacks/electronic-ledger/backend.tf.example` と `backend.hcl.example` をコピーし、S3 バケット / DynamoDB テーブルを設定
2. `terraform.tfvars` に環境変数を定義（例を後述）
3. `terraform init -backend-config=backend.hcl` を実行して初期化
4. `terraform plan` で差分を確認（`make ledger-plan` で Dry-run 可）
5. `terraform apply` で本番 / QA 環境へデプロイ

### `terraform.tfvars` サンプル
```hcl
aws_region             = "ap-northeast-1"
ledger_bucket_name     = "prod-electronic-ledger"
aws_account_id         = "123456789012"
account_admin_arn      = "arn:aws:iam::123456789012:role/SecurityAdmin"
alarm_topics           = ["arn:aws:sns:ap-northeast-1:123456789012:security-alerts"]
tags = {
  Owner       = "compliance-team"
  CostCenter  = "FIN-OPS"
}
```

### Dry-run
```
make ledger-plan
```
CI と同じ `skip_credentials_validation=true` の設定で `terraform plan` が実行されます。

## バケット構成
- バージョニング + Object Lock (COMPLIANCE モード)
- 非現行バージョンは 365 日後に削除
- 90 日後に Glacier Instant Retrieval へ自動移行
- CMK で暗号化し、アクセス許可は最小限に制限

## 監視
- CloudWatch アラーム `4xxErrors` (PUT 失敗) を SNS トピックへ通知
- DynamoDB でログのインデックスを保持し、PITR を有効化

## CI
- `.github/workflows/terraform-compliance.yml` で `terraform fmt`, `validate`, `plan` を自動チェック
- `TF_VAR_environment=ci` + `TF_VAR_skip_credentials_validation=true` でダミー認証のまま差分検知

## 想定トラブルシュート
- **アラームが発火した場合**: CloudTrail で失敗した API を確認し、権限設定を見直す
- **WORM モードの解除要求**: Object Lock は変更不可のため、監査部門承認のうえ新バケットへ移行する
