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
  ai_ops_namespace = "ITDO/AIOps"
  athena_create_bucket     = var.athena_result_bucket == ""
  derived_bucket_name      = var.analytics_bucket_name != "" ? lower(var.analytics_bucket_name) : lower("itdo-analytics-${var.environment}-${data.aws_caller_identity.current.account_id}")
  athena_bucket_name       = replace(local.derived_bucket_name, "_", "-")
  quicksight_template_arn  = var.quicksight_template_arn != "" ? var.quicksight_template_arn : lookup(var.quicksight_template_map, var.environment, "")
  quicksight_dataset_arn   = var.quicksight_dataset_arn != "" ? var.quicksight_dataset_arn : lookup(var.quicksight_dataset_map, var.environment, "")
}

resource "aws_glue_catalog_database" "analytics" {
  name = local.glue_database
}

resource "aws_s3_bucket" "athena_results" {
  count  = local.athena_create_bucket ? 1 : 0
  bucket = local.athena_bucket_name

  tags = {
    Name        = "itdo-analytics-${var.environment}"
    Environment = var.environment
    Module      = "analytics-observability"
  }
}

resource "aws_s3_bucket_versioning" "athena_results" {
  count  = local.athena_create_bucket ? 1 : 0
  bucket = aws_s3_bucket.athena_results[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "athena_results" {
  count  = local.athena_create_bucket ? 1 : 0
  bucket = aws_s3_bucket.athena_results[0].bucket

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "athena_results" {
  count  = local.athena_create_bucket ? 1 : 0
  bucket = aws_s3_bucket.athena_results[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_object" "athena_results_prefix" {
  count   = local.athena_create_bucket ? 1 : 0
  bucket  = aws_s3_bucket.athena_results[0].id
  key     = "athena-results/"
  content = ""

  depends_on = [
    aws_s3_bucket_public_access_block.athena_results,
    aws_s3_bucket_server_side_encryption_configuration.athena_results,
  ]
}

resource "aws_athena_workgroup" "analytics_workgroup" {
  name = local.athena_workgroup
  configuration {
    result_configuration {
      output_location = var.athena_result_bucket != "" ? var.athena_result_bucket : "s3://${aws_s3_bucket.athena_results[0].bucket}/athena-results/"
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
      },
      {
        type = "metric"
        properties = {
          title   = "Codex Smoke Failure Rate"
          metrics = [["${local.ai_ops_namespace}", "CodexSmokeFailureRate", "Environment", var.environment]]
          period  = 300
          stat    = "Average"
        }
      },
      {
        type = "metric"
        properties = {
          title   = "LangGraph Verify Latency"
          metrics = [["${local.ai_ops_namespace}", "LangGraphVerifyLatency", "Environment", var.environment]]
          period  = 300
          stat    = "Average"
        }
      },
      {
        type = "metric"
        properties = {
          title   = "Auto Handoff Lead Time"
          metrics = [["${local.ai_ops_namespace}", "AutoHandoffLeadTime", "Environment", var.environment]]
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

resource "aws_cloudwatch_metric_alarm" "ai_ops_smoke_failure" {
  alarm_name          = "ai-ops-codex-smoke-failure-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "CodexSmokeFailureRate"
  namespace           = local.ai_ops_namespace
  period              = 300
  statistic           = "Average"
  threshold           = var.ai_ops_failure_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [var.alert_topic_arn]
  ok_actions    = [var.alert_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "ai_ops_latency" {
  alarm_name          = "ai-ops-langgraph-latency-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "LangGraphVerifyLatency"
  namespace           = local.ai_ops_namespace
  period              = 300
  statistic           = "Average"
  threshold           = var.ai_ops_latency_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [var.alert_topic_arn]
  ok_actions    = [var.alert_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "ai_ops_handoff" {
  alarm_name          = "ai-ops-handoff-leadtime-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "AutoHandoffLeadTime"
  namespace           = local.ai_ops_namespace
  period              = 300
  statistic           = "Average"
  threshold           = var.ai_ops_handoff_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    Environment = var.environment
  }

  alarm_actions = [var.alert_topic_arn]
  ok_actions    = [var.alert_topic_arn]
}

resource "aws_quicksight_dashboard" "analytics_dashboard" {
  count          = local.quicksight_template_arn == "" || local.quicksight_dataset_arn == "" ? 0 : 1
  aws_account_id = data.aws_caller_identity.current.account_id
  dashboard_id   = "analytics-${var.environment}"
  name           = "Analytics Overview (${var.environment})"

  source_entity {
    source_template {
      data_set_references = [
        {
          data_set_arn         = local.quicksight_dataset_arn
          data_set_placeholder = "AnalyticsDataset"
        }
      ]
      arn = local.quicksight_template_arn
    }
  }

  permissions {
    principal = "arn:aws:quicksight:${var.aws_region}:${data.aws_caller_identity.current.account_id}:namespace/default"
    actions   = ["quicksight:DescribeDashboard", "quicksight:ListDashboardVersions"]
  }
}
