# HR/BI Codex Smoke モニタリング

Issue #304 の残タスクである「Codex Smoke で HR/BI モジュールのテンプレート生成＋lint を継続監視」をカバーするための運用メモ。

## 目的
- `Codex Template Smoke` ワークフローで HR / BI モジュールのテンプレート生成と ESLint の状態を定期チェックする
- 生成結果を JSON / Markdown で保存し、ジョブサマリーおよびアーティファクトから参照可能にする

## ワークフロー
- 対象: `.github/workflows/codex-template-smoke.yml`
- 生成スクリプト: `scripts/ci/run-codex-template-smoke.sh`
  - `cli-domain-hr`, `cli-domain-bi`, `eslint-hr`, `eslint-bi` などのエントリが `reports/codex-template-smoke/latest.json` に出力される
  - GitHub Step Summary に Markdown テーブルが追記される
- 実行トリガー
  - `main` ブランチへの push（テンプレート変更時）
  - `workflow_dispatch`

## 成果物
| ファイル | 説明 |
|----------|------|
| `reports/codex-template-smoke/latest.json` | 直近のスモーク実行結果。`generatedAt` と `items` を保持 |
| `reports/codex-template-smoke/latest.md` | 同上の Markdown 版。Step Summary と同じ内容 |
| GitHub アーティファクト `codex-template-smoke-report` | 上記 2 ファイルをまとめてダウンロード可能 |

## アラート・対応
1. ワークフロー失敗 / アイテムが `skip` または `error` の場合は `cli-domain-hr` / `cli-domain-bi` / `eslint-hr` / `eslint-bi` を重点確認
2. `latest.json` を参照し、該当モジュールのテンプレート生成が失敗していないかを確認
3. 必要に応じて `services/project-api/src/hr` / `src/bi` の ESLint 実行 (`npm run lint -- src/<module>`) をローカルで再現
4. 復旧後は再度 `workflow_dispatch` でスモークを走らせ、`latest.json` が `ok` ステータスに戻ったことを確認

## 参考リンク
- ワークフロー: `.github/workflows/codex-template-smoke.yml`
- レポートスクリプト: `scripts/ci/run-codex-template-smoke.sh`
- Issue: #304
