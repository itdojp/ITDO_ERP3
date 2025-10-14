terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  tags = {
    Environment = var.environment
    Service     = var.service_name
    ManagedBy   = "terraform"
  }
}

resource "aws_cloudwatch_metric_alarm" "invoice_failures" {
  alarm_name          = "billing-invoice-failure-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "BillingInvoiceFailure"
  namespace           = "ProjectAPI/Billing"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Triggered when invoice processing fails"
  alarm_actions       = var.alarm_topics
  ok_actions          = var.alarm_topics
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "webhook_errors" {
  alarm_name          = "billing-webhook-error-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "DocuSignWebhookError"
  namespace           = "ProjectAPI/Billing"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Triggered when DocuSign webhook handler fails"
  alarm_actions       = var.alarm_topics
  ok_actions          = var.alarm_topics
  tags                = local.tags
}

resource "aws_cloudwatch_dashboard" "billing" {
  dashboard_name = var.dashboard_name
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        width = 12
        height = 6
        properties = {
          view   = "timeSeries"
          region = var.aws_region
          title  = "Billing Invoice Success / Failure"
          metrics = [
            ["ProjectAPI/Billing", "billing.invoice.success", { "stat" : "Sum", "label" : "Success" }],
            ["ProjectAPI/Billing", "billing.invoice.failure", { "stat" : "Sum", "label" : "Failure" }],
          ]
          period = 300
          stacked = false
        }
      },
      {
        type = "metric"
        width = 12
        height = 6
        properties = {
          view   = "timeSeries"
          region = var.aws_region
          title  = "DocuSign Webhook Errors"
          metrics = [
            ["ProjectAPI/Billing", "DocuSignWebhookError", { "stat" : "Sum" }],
          ]
          period = 300
        }
      }
    ]
  })
}
