variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "ledger_bucket_name" {
  description = "Ledger S3 bucket name"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account id"
  type        = string
}

variable "account_admin_arn" {
  description = "Principal with admin access to ledger resources"
  type        = string
}

variable "environment" {
  description = "Deployment environment for tagging (e.g., prod, qa, sandbox)"
  type        = string
  default     = "sandbox"
}

variable "tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}

variable "skip_credentials_validation" {
  description = "Skip AWS credential and region validation (set true for CI/dry-run)"
  type        = bool
  default     = false
}

variable "alarm_topics" {
  description = "SNS topics for alarm notifications"
  type        = list(string)
  default     = []
}
