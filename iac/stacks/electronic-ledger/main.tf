locals {
  base_tags = {
    Environment = var.environment
    Service     = "ElectronicLedger"
  }

  merged_tags = merge(local.base_tags, var.tags)
}

provider "aws" {
  region                      = var.aws_region
  skip_credentials_validation = var.skip_credentials_validation
  skip_metadata_api_check     = var.skip_credentials_validation
  skip_region_validation      = var.skip_credentials_validation
  skip_requesting_account_id  = var.skip_credentials_validation
}

module "ledger" {
  source = "../../modules/electronic-ledger"

  bucket_name       = var.ledger_bucket_name
  aws_account_id    = var.aws_account_id
  account_admin_arn = var.account_admin_arn
  alarm_topics      = var.alarm_topics
  tags              = local.merged_tags
}
