provider "aws" {
  region                      = var.aws_region
  skip_credentials_validation = var.skip_credentials_validation
  skip_metadata_api_check     = var.skip_credentials_validation
  skip_region_validation      = var.skip_credentials_validation
  skip_requesting_account_id  = var.skip_credentials_validation
}

module "billing_monitoring" {
  source         = "../../modules/billing-monitoring"
  aws_region     = var.aws_region
  alarm_topics   = var.alarm_topics
  environment    = var.environment
  service_name   = var.service_name
  dashboard_name = var.dashboard_name
}
