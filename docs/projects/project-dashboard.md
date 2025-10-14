# プロジェクトダッシュボード（AI ハイライト）

## 概要
`/projects` 画面に AI ハイライトと EVM/リスク指標を統合したダッシュボードを追加しました。ChatSummarizer が算出した要約・EVM 指標・バーンダウン・リスクを 1 画面で確認でき、アクション判断を素早く行えます。

## 表示内容
- **日次ハイライト**: ChatSummarizer の要約と EVM 指標から自動生成される bullet。CPI/SPI・スケジュール遅延・高リスク情報を優先度付きで提示します。
- **EVM スナップショット**: Planned/Earned/Actual Cost、CPI・SPI による効率判断、Cost/Schedule Variance を表示。
- **バーンダウン進捗**: 計画値と実績値を比較し、「前倒し／遅れ／オン・トラック」を判定。
- **今後の主要タスク**: タイムラインの先頭 5 件をステータス別に表示。
- **リスクサマリ**: 発生確率 × 影響度を基に上位 5 件を表示。

## データソースとフォールバック
1. GraphQL `projectTimeline` / `projectMetrics`
2. REST `/api/v1/projects/:id/timeline` / `/api/v1/projects/:id/metrics`
3. モックデータ（PoC 用）

パネル右上に「API / REST / MOCK」のステータスを表示し、取得元を明示します。更新ボタンで再取得が可能です。

## 推奨運用
- 毎朝スタンドアップ／週次レビュー時に「日次ハイライト」を読み上げ、重大リスクがあれば即エスカレーション。
- CPI/SPI・Variance をもとに、稼働計画／コスト見直しを判断。
- リスク情報を `contracts/invoice-pipeline.md` の対応手順と合わせてトリアージ。

## テスト
- Playwright `tests/e2e/projects.spec.ts` でハイライト表示を検証（GraphQL 失敗時のモックフォールバックもカバー）。
- `./scripts/generate-api-docs.sh` 実行で GraphQL スキーマに変更がないか確認。

## 今後の拡張例
- チャット検索結果（Issue #280）を同パネルに統合し、キーワードフィードバックを可視化。
- KPI のトレンド表示（7日移動平均）や Slack 通知との連携を検討。
