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
