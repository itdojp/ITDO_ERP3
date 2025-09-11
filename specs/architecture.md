# Architecture (Bootstrap)

## 目的 / Purpose
- 対象: 日本のIT系中小企業（従業員100名未満）
- 方針: Project-centric, API-first, Cloud-native, 日本法対応（インボイス/電帳法）
- 目的: 取り込み設計の初期足場を提供し、後続PRで詳細化

## スコープ / Scope
- 標準領域: accounting / sales / procurement / hr-payroll（定石に準拠）
- 独自領域: project / timesheet / project-costing（進行基準含む）

## 設計原則 / Principles
- Project-centric: プロジェクト×工数×原価×進行基準で採算のリアルタイム化
- API-first: OpenAPI駆動、UIはAPI消費者として分離
- Cloud-native: コンテナ/CI/CD/監視を前提、スケールと可用性を標準化
- Compliance by design: インボイス/電帳法のMVP要件を最初から内包
- Modularity: 疎結合・イベント駆動、境界づけられたコンテキストを明確化

## C4 L1（システムコンテキスト: テキスト）
- ユーザー（経営/管理/担当）→ Webアプリ（Next.js）/API（ERP API）
- ERP API（認証OIDC/RBAC）→ データストア（PostgreSQL, オブジェクトストレージ）
- 外部SaaS: 会計（仕訳取込/出力）、IDP、通知、OCR
- 主要フロー: 受注→プロジェクト起票→工数→原価→進行基準計上→請求/会計連携

## 疎結合方針
- REST API + 非同期イベント（Outbox）でモジュール間依存を最小化
- 境界越え読み取りは専用Readモデル/キャッシュを介す（強結合回避）

## SLO / 可用性
- API p95 < 300ms（MVP対象）、可用性 99.9%
- DBマルチAZ、バックアップ/復旧演習、監査/トレーシング（OpenTelemetry）

