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
  default     = ""
}

variable "analytics_bucket_name" {
  description = "Optional S3 bucket name override for Athena results (without s3://). Leave empty to auto-generate."
  type        = string
  default     = ""
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

variable "quicksight_template_map" {
  description = "Environment → QuickSight template ARN map (used when quicksight_template_arn is empty)."
  type        = map(string)
  default     = {}
}

variable "quicksight_dataset_map" {
  description = "Environment → QuickSight dataset ARN map (used when quicksight_dataset_arn is empty)."
  type        = map(string)
  default     = {}
}

variable "ai_ops_failure_threshold" {
  description = "Allowed Codex Smoke failure rate (%) before alarming"
  type        = number
  default     = 5
}

variable "ai_ops_latency_threshold" {
  description = "Maximum LangGraph verification latency in seconds"
  type        = number
  default     = 600
}

variable "ai_ops_handoff_threshold" {
  description = "Maximum auto handoff lead time in minutes"
  type        = number
  default     = 45
}
