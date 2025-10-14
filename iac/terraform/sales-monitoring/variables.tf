variable "aws_region" {
  description = "AWS Region for Sales monitoring stack"
  type        = string
  default     = "ap-northeast-1"
}

variable "environment" {
  description = "Deployment environment identifier"
  type        = string
}

variable "alert_topic_arn" {
  description = "SNS topic ARN used for alert notifications"
  type        = string
}
