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

data "aws_caller_identity" "current" {}

locals {
  namespace        = "ITDO/Analytics"
  glue_database    = "analytics_${var.environment}"
  athena_workgroup = "analytics-${var.environment}"
  dashboard_name   = "analytics-observability-${var.environment}"
}

resource "aws_glue_catalog_database" "analytics" {
  name = local.glue_database
}

resource "aws_athena_workgroup" "analytics_workgroup" {
  name = local.athena_workgroup
  configuration {
    result_configuration {
      output_location = var.athena_result_bucket
    }
    bytes_scanned_cutoff_per_query = 104857600
  }
}

resource "aws_cloudwatch_dashboard" "analytics_overview" {
  dashboard_name = local.dashboard_name
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          title   = "KPI Refresh Latency"
          metrics = [["${local.namespace}", "KpiRefreshLatency", "Environment", var.environment]]
          period  = 300
          stat    = "Average"
        }
      },
      {
        type = "metric"
        properties = {
          title   = "NL Query Success Rate"
          metrics = [["${local.namespace}", "NaturalLanguageQuerySuccess", "Environment", var.environment]]
          period  = 300
          stat    = "Average"
        }
      }
    ]
  })
}

resource "aws_cloudwatch_metric_alarm" "etl_failure" {
  alarm_name          = "analytics-etl-failure-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "EtlFailureCount"
  namespace           = local.namespace
  period              = 900
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [var.alert_topic_arn]
  ok_actions    = [var.alert_topic_arn]
}

resource "aws_quicksight_dashboard" "analytics_dashboard" {
  count          = var.quicksight_template_arn == "" || var.quicksight_dataset_arn == "" ? 0 : 1
  aws_account_id = data.aws_caller_identity.current.account_id
  dashboard_id   = "analytics-${var.environment}"
  name           = "Analytics Overview (${var.environment})"

  source_entity {
    source_template {
      data_set_references = [
        {
          data_set_arn         = var.quicksight_dataset_arn
          data_set_placeholder = "AnalyticsDataset"
        }
      ]
      arn = var.quicksight_template_arn
    }
  }

  permissions {
    principal = "arn:aws:quicksight:${var.aws_region}:${data.aws_caller_identity.current.account_id}:namespace/default"
    actions   = ["quicksight:DescribeDashboard", "quicksight:ListDashboardVersions"]
  }
}
