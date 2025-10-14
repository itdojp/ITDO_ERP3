variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "alarm_topics" {
  description = "SNS topics for alarm notifications"
  type        = list(string)
  default     = []
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "sandbox"
}

variable "service_name" {
  description = "Service tag"
  type        = string
  default     = "project-api"
}

variable "dashboard_name" {
  description = "CloudWatch dashboard name"
  type        = string
  default     = "billing-invoice-operations"
}

variable "skip_credentials_validation" {
  description = "Skip AWS credential checks (useful for CI)"
  type        = bool
  default     = false
}
