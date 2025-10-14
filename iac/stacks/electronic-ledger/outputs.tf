output "bucket_arn" {
  value = module.ledger.bucket_arn
}

output "kms_key_arn" {
  value = module.ledger.kms_key_arn
}

output "dynamodb_table" {
  value = module.ledger.dynamodb_table_name
}
