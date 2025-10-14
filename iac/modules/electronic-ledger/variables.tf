variable "bucket_name" {
  description = "Name of the compliance archive bucket"
  type        = string
}

variable "force_destroy" {
  description = "Allow terraform to delete bucket even if it contains objects"
  type        = bool
  default     = false
}

variable "versioning_mfa_delete" {
  description = "Enable MFA delete for versioned bucket"
  type        = string
  default     = "Disabled"
}

variable "object_lock_mode" {
  description = "WORM retention mode"
  type        = string
  default     = "COMPLIANCE"
}

variable "object_lock_retention_days" {
  description = "Default object lock retention period"
  type        = number
  default     = 365
}

variable "glacier_transition_days" {
  description = "Days before transitioning objects to Glacier"
  type        = number
  default     = 90
}

variable "expire_noncurrent_after_days" {
  description = "Days before removing non-current versions"
  type        = number
  default     = 365
}

variable "kms_description" {
  description = "Description for the KMS key"
  type        = string
  default     = "Electronic ledger CMK"
}

variable "kms_deletion_window" {
  description = "KMS deletion window in days"
  type        = number
  default     = 30
}

variable "aws_account_id" {
  description = "AWS account id for access control"
  type        = string
}

variable "account_admin_arn" {
  description = "IAM principal allowed full access to the CMK"
  type        = string
}

variable "dynamodb_table_name" {
  description = "Ledger index DynamoDB table name"
  type        = string
  default     = "electronic-ledger-log"
}

variable "enable_put_alarm" {
  description = "Enable CloudWatch alarm for failed PUT operations"
  type        = bool
  default     = true
}

variable "alarm_topics" {
  description = "SNS topics to notify on alarm"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
