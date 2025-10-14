terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  namespace      = "ITDO/Sales"
  dashboard_name = "sales-overview-${var.environment}"
}

resource "aws_cloudwatch_dashboard" "sales_overview" {
  dashboard_name = local.dashboard_name
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        x    = 0
        y    = 0
        width = 12
        height = 6
        properties = {
          title = "Quote to Order Conversion"
          metrics = [
            ["${local.namespace}", "QuoteApprovedCount", "Environment", var.environment],
            ["${local.namespace}", "OrderCreatedCount", "Environment", var.environment]
          ]
          period = 300
          stat   = "Sum"
        }
      },
      {
        type = "metric"
        x    = 12
        y    = 0
        width = 12
        height = 6
        properties = {
          title = "Credit Review SLA"
          metrics = [
            ["${local.namespace}", "CreditPendingCount", "Environment", var.environment]
          ]
          period = 300
          stat   = "Average"
        }
      }
    ]
  })
}

resource "aws_cloudwatch_metric_alarm" "credit_review_sla" {
  alarm_name          = "sales-credit-review-sla-${var.environment}"
  alarm_description   = "Triggers when pending credit reviews exceed threshold"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "CreditPendingCount"
  namespace           = local.namespace
  period              = 300
  statistic           = "Average"
  threshold           = 5
  treat_missing_data  = "breaching"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [var.alert_topic_arn]
  ok_actions    = [var.alert_topic_arn]
}
