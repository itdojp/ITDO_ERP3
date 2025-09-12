# スコープ整合（System Overview とのギャップ補完）

参照: integrated-specs/00-overview/system-overview.md の Must/Should に対する現在仕様の対応と補完項目。

## Must（MVP）対応状況
- プロジェクト管理
  - [追加] WBS依存関係: POST /api/v1/tasks/{id}/dependencies（ドラフト）
  - [追加] EVM指標: GET /api/v1/projects/{id}/evm（ドラフト）
  - [追加] ガント: GET /api/v1/projects/{id}/gantt（ドラフト）
  - [追加] ベースライン: POST /api/v1/projects/{id}/baseline（ドラフト）
  - [追加] リソースキャパ: GET/POST /api/v1/resources/capacity（ドラフト）
- 財務管理
  - タイムシート/原価計算/請求/電子帳簿保存 → 実装済（詳細はOpenAPI参照）
  - [補足] 丸め/税の選択肢（LinkingOptions、ERD/DDL方針）
- 勤怠管理（最小）
  - [追加] POST /api/v1/hr/timeclock, POST /api/v1/hr/attendance/close, GET /api/v1/hr/36-check
- 契約管理
  - [追加] 契約CRUD・請求条件・更新アラート・電子署名アクション（/contracts, /contracts/{id}/renewal-alert, /esign）
- システム基盤
  - 認証・認可・監査 → 既存
  - [補強] 会計連携（勘定科目マッピング/仕訳エクスポート）→ /api/v1/accounting/*

## Should（Phase2）スコープ（雛形）
- 販売管理（見積/与信）
  - [提案] 見積: /api/v1/sales/quotes（Phase2で追加）
  - [提案] 与信: /api/v1/sales/credit-check（Phase2で追加）
- 人事/CRM/BI は別途モジュール化（将来）

## 非機能/運用補強
- 監査: x-sensitive（ip/user_agent/file_uri/hash）をOpenAPIにマーキング
- 安定ソート: Compliance検索の二次キー（-id）
- 冪等: 連携APIで Idempotency-Key 推奨
