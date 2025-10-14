variable "aws_region" {
  description = "AWS Region for analytics observability"
  type        = string
  default     = "ap-northeast-1"
}

variable "environment" {
  description = "Environment name (dev/stg/prod)"
  type        = string
}

variable "alert_topic_arn" {
  description = "SNS topic ARN for analytics alerts"
  type        = string
}

variable "athena_result_bucket" {
  description = "S3 bucket URI (s3://...) for Athena query results"
  type        = string
}

variable "quicksight_template_arn" {
  description = "QuickSight template ARN. Leave empty to skip dashboard provisioning."
  type        = string
  default     = ""
}

variable "quicksight_dataset_arn" {
  description = "QuickSight dataset ARN used by the analytics dashboard."
  type        = string
  default     = ""
}
