# Billing Monitoring Stack

Usage:

```bash
cd iac/stacks/billing-monitoring
cp ../electronic-ledger/backend.hcl.example backend.hcl
terraform init -backend-config=backend.hcl
terraform plan -var="aws_region=ap-northeast-1" \
  -var="environment=qa" \
  -var='alarm_topics=["arn:aws:sns:ap-northeast-1:123456789012:billing-alerts"]'
```

Outputs:
- `invoice_alarm_name`
- `webhook_alarm_name`
- `dashboard_name`
