output "sales_monitoring_dashboard_url" {
  description = "URL of the CloudWatch dashboard for sales monitoring"
  value       = aws_cloudwatch_dashboard.sales_overview.dashboard_arn
}
