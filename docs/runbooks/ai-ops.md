# AI Ops Runbook

## 目的
- Codex Smoke / LangGraph Verify / AI Ops 自動ハンドオフの結果を継続監視し、AI エージェントの変更が安全に本番へ到達することを保証する。
- Slack `#ai-ops-alerts` と PagerDuty `AI Ops Triage` を中心に、Phase3 の自動化ワークフローを支える。

## 事前準備
- [ ] `AI Ops LangGraph Verify` / `AI Ops Auto Handoff` / `AI Ops Insights Publisher` ワークフローの `workflow_dispatch` 実行権限を確認
- [ ] GitHub Actions Insights の `AI Ops` ダッシュボードへアクセス可能であること
- [ ] Codex Smoke 成果物（`reports/codex-template-smoke/latest.json`）と LangGraph Verify レポートを閲覧できること
- [ ] PagerDuty サービス `AI Ops Triage` の On-Call スケジュールを確認

## 運用手順
1. **日次チェック（09:30 JST まで）**
   - GitHub Actions Insights の `AI Ops` ビューを開き、前日の `AI Ops LangGraph Verify` 成功率・レイテンシを確認
   - `docs/ai/ops-dashboard.md` を更新し、主要 KPI（Codex Smoke Failure Rate, LangGraph Verify Latency, Auto Handoff SLA）を記録
   - `AI Ops Insights Publisher` の出力（`reports/ai-ops-insights.md`）を Slack `#ai-ops-alerts` に転送し、異常が無いか確認
2. **自動化ハンドオフの開始**
   - `workflow_dispatch` で `AI Ops Auto Handoff` を実行し、テンプレート生成 → PR レビュー → デプロイ承認の一連フローをキック
   - 実行後に Slack へ `[AI Ops] Auto Handoff Started` メッセージが投稿されることを確認
   - 失敗時は `docs/ai/ops-playbooks.md` の対象プレイブックに従い、Rollback あるいは手動介入を判断
3. **異常検知時の初動**
   - `AI Ops LangGraph Verify` が失敗した場合、失敗したシナリオと Codex Smoke 結果を突き合わせ、同一 PR への影響範囲を整理
   - PagerDuty インシデントが発報された際は 10 分以内に Slack で状況を共有し、必要に応じて `AI Ops Auto Handoff` を停止
   - Insights レポートに記録されたメトリクスを添えて、PeopleOps / SRE チームへエスカレーション

## 監視メトリクス
| メトリクス | しきい値 | アクション |
|------------|----------|------------|
| CodexSmokeFailureRate | > 5% (ローリング 7 件) | `AI Ops LangGraph Verify` を再実行し、テンプレート修正を検討 |
| LangGraphVerifyLatency | > 600 秒 | LangGraph Verify ジョブを再実行し、遅延要因（API 制限など）を確認 |
| AutoHandoffLeadTime | > 45 分 | ハンドオフの各フェーズログを確認し、手動承認が滞留していないか確認 |

## エスカレーション
- Slack `#ai-ops-alerts` で 15 分以内にステータスを共有
- PagerDuty `AI Ops Triage` → SRE (セカンダリ) → プラットフォーム PM の順に連絡
- 重大障害（テンプレート生成と LangGraph Verify の同時失敗など）は Product / Security チームにも即時報告

## 監査ログとレポーティング
- `AI Ops Auto Handoff` は毎回 `reports/ai-ops-handoff.json` に実行履歴を追記する。隔週レビューで監査チームと共有すること
- 自動ハンドオフの承認判断は GitHub pull request のコメント（`@ai-ops` ラベル）に残し、Slack メッセージと紐付ける
- 月次で KPI サマリを `docs/ai/ops-dashboard.md` に追記し、Issue #305 / #159 にリンクを残す

## 品質基準とハンドオフ
- 生成コンテンツは Codex Smoke を通過したテンプレートのみを対象とし、最低でも 2 件の自動テスト（lint + unit）成功を確認する。
- LangGraph Verify の結果 (`reports/ai-ops-verify.md`) を PR に添付し、AI Ops チームが `LG-Verified ✅` ラベルを付与したものだけを自動ハンドオフへ進める。
- 自動ハンドオフ完了時は PR に `@ai-ops` コメントで承認メモを残し、リリース責任者が 30 分以内にフォローアップを行う。

## 権限・Secrets 管理
- GitHub Actions の `AI Ops` 系ワークフローはデフォルト `GITHUB_TOKEN` (actions:write) を利用。追加で PAT を使用する場合は `AI_OPS_PAT` Secrets に格納し、Scope は `workflow` のみに限定。
- LangGraph / Codex 関連の API Keys は AWS Secrets Manager `ai/ops/langgraph` / `ai/ops/codex` に保存し、ワークフローからは OIDC ロール経由で取得する。
- Secrets の更新や権限変更を行った場合は 24 時間以内に本 Runbook と `docs/ai/ops-playbooks.md` に履歴を追記する。

---
最終更新: 2025-10-16 / Maintainer: AI Ops Team
