output "athena_workgroup" {
  description = "Athena workgroup used for BI queries"
  value       = aws_athena_workgroup.analytics_workgroup.name
}

output "quicksight_dashboard_id" {
  description = "QuickSight dashboard identifier"
  value       = aws_quicksight_dashboard.analytics_dashboard.dashboard_id
}
