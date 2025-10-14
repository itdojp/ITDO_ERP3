output "bucket_id" {
  value       = aws_s3_bucket.ledger.id
  description = "ID of the ledger bucket"
}

output "bucket_arn" {
  value       = aws_s3_bucket.ledger.arn
  description = "ARN of the ledger bucket"
}

output "kms_key_arn" {
  value       = aws_kms_key.ledger.arn
  description = "ARN of the KMS CMK"
}

output "dynamodb_table_name" {
  value       = aws_dynamodb_table.ledger_log.name
  description = "Name of the DynamoDB ledger table"
}
