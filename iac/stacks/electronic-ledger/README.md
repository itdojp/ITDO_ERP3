# Electronic Ledger Stack

Usage:

```bash
cd iac/stacks/electronic-ledger
cp backend.tf.example backend.tf
cp backend.hcl.example backend.hcl
terraform init -backend-config=backend.hcl
terraform plan -var="aws_region=ap-northeast-1" \
  -var="ledger_bucket_name=ledger-worm-example" \
  -var="aws_account_id=123456789012" \
  -var="account_admin_arn=arn:aws:iam::123456789012:role/Admin" \
  -var="environment=qa"
```
