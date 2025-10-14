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
  description = "Deployment environment tag (e.g., prod, qa)"
  type        = string
  default     = "sandbox"
}

variable "service_name" {
  description = "Service tag value"
  type        = string
  default     = "project-api"
}

variable "dashboard_name" {
  description = "CloudWatch dashboard name"
  type        = string
  default     = "billing-invoice-operations"
}
