# 自然言語クエリ PoC (LangGraph)

Phase2 BI モジュールで計画している LangGraph ベースの自然言語クエリを再現する PoC。Issue #298 / #159。

## 構成
1. Intent Resolver: ユーザー入力から KPI / 指標を推定
2. Query Planner: Athena 用 SQL を生成
3. Executor: ダミーデータに対してクエリを実行（将来的には Athena に接続）
4. Summarizer: 結果を日本語で返却

`flow.ts` では疑似的なノード実装を記載しています。LangGraph 実装時は `@langchain/langgraph` を導入し、各ノードをエージェント化してください。

## 使い方
```bash
pnpm add @langchain/langgraph langchain openai # 実装時
node flow.ts <<<'案件の受注率を教えて'
```

現時点ではダミーデータを返す実装ですが、Phase2 Sprint8 で Athena 連携を追加予定です。
