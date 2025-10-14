output "invoice_alarm_name" {
  value       = aws_cloudwatch_metric_alarm.invoice_failures.alarm_name
  description = "Name of the invoice failure alarm"
}

output "webhook_alarm_name" {
  value       = aws_cloudwatch_metric_alarm.webhook_errors.alarm_name
  description = "Name of the DocuSign webhook alarm"
}

output "dashboard_name" {
  value       = aws_cloudwatch_dashboard.billing.dashboard_name
  description = "CloudWatch dashboard name"
}
