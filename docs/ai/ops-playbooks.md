# AI Ops Playbooks

AI Ops ワークフローで発生しうる代表的なインシデントと対応手順をまとめます。Runbook と併用し、PagerDuty インシデントにリンクしてください。

## 1. Codex Smoke Failure Rate > 5%
1. `AI Ops LangGraph Verify` を再実行し、失敗したテンプレート ID を特定。
2. 該当テンプレートの最新コミットを確認し、`feature/*` ブランチの変更点をレビュー。
3. 影響範囲に応じて自動ハンドオフを一時停止し、テンプレート修正の Issue を作成。

## 2. LangGraph Verify Latency > 600 秒
1. LangGraph Verify ジョブログを確認し、リトライ回数・モデルレスポンス時間を抽出。
2. OpenAI / LangGraph のステータスページを確認し、外部要因の有無を判断。
3. 再実行後も遅延する場合は AI Ops Auto Handoff を停止し、SRE へエスカレーション。

## 3. Auto Handoff で承認滞留
1. GitHub pull request の `@ai-ops` コメントを確認し、未対応の承認者を特定。
2. Slack `#ai-ops-alerts` でリマインドし、必要に応じてプラットフォーム PM にエスカレーション。
3. 45 分以内にハンドオフが完了しない場合は手動でハンドオフを中断し、Insights に理由を記録。

---
最終更新: 2025-10-16 / Maintainer: AI Ops Team
