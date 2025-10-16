output "athena_workgroup" {
  description = "Athena workgroup used for BI queries"
  value       = aws_athena_workgroup.analytics_workgroup.name
}

output "athena_results_bucket" {
  description = "S3 bucket used for Athena query results (null when an external bucket is supplied)"
  value       = local.athena_create_bucket ? aws_s3_bucket.athena_results[0].bucket : null
}

output "athena_results_location" {
  description = "Final S3 URI for Athena query results"
  value       = var.athena_result_bucket != "" ? var.athena_result_bucket : "s3://${aws_s3_bucket.athena_results[0].bucket}/athena-results/"
}

output "quicksight_dashboard_id" {
  description = "QuickSight dashboard identifier"
  value       = length(aws_quicksight_dashboard.analytics_dashboard) > 0 ? aws_quicksight_dashboard.analytics_dashboard[0].dashboard_id : null
}
