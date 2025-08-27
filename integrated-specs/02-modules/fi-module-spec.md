# 財務管理モジュール（FI）詳細仕様書
## Financial Management Module Specification

### 1. モジュール概要

#### 1.1 目的
企業の財務活動全般を統合管理し、経営意思決定に必要な財務情報をリアルタイムで提供する。特にプロジェクト原価管理、タイムシート管理、インボイス対応請求管理を中核とし、財務透明性の向上と経営効率化を実現する。

#### 1.2 適用範囲
- **タイムシート管理**（MVP必須、締め処理対応）
- **プロジェクト原価計算**（MVP必須、レートカード管理）
- **請求管理**（インボイス完全対応必須）
- **電子帳簿保存法対応**（MVP必須、7年保存）
- **予算管理**（Should Have）
- 資金繰り管理
- 固定資産管理
- 売掛金・買掛金管理
- 会計システム連携（勘定科目マッピング必須）

#### 1.3 対象ユーザー
- 財務部門（財務担当者、経理担当者）
- プロジェクトマネージャー
- プロジェクトメンバー（工数入力）
- 部門管理者
- 経営層・役員

---

### 2. 機能要件

#### 2.1 タイムシート管理 ★MVP必須

##### 機能ID: FI-001 - 工数入力管理
**優先度**: MVP必須

**機能概要**
従業員の作業時間を正確かつ効率的に記録し、プロジェクト原価計算の基礎データを提供する。

**詳細要件**
- 多様な入力方式（日次、週次、タイマー機能）
- モバイル・オフライン対応
- 自動チェック・警告機能（勤怠連携によるダブルチェック）
- テンプレート・コピー機能
- 締め処理機能（週次/月次締め、締め後ロック）
- 一意キー管理（ProjectID + TaskID + 日付 + ユーザID）

**入力項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| 作業日 | ○ | DATE | - | |
| プロジェクト | ○ | FK | - | プロジェクトマスター連携 |
| タスク | ○ | FK | - | WBS連携 |
| 開始時刻 | ○ | TIME | - | 15分単位 |
| 終了時刻 | ○ | TIME | - | 15分単位 |
| 休憩時間 | △ | DECIMAL | 3,2 | 時間 |
| 作業内容 | ○ | TEXT | 500 | |
| 残業区分 | ○ | ENUM | - | 通常/法定内/法定外/深夜 |
| 作業場所 | ○ | ENUM | - | 社内/在宅/客先 |

##### 機能ID: FI-002 - 承認ワークフロー
**優先度**: MVP必須

**機能概要**
タイムシートの承認プロセスを自動化し、データの正確性と統制を確保する。

**詳細要件**
- 2段階承認フロー（上長承認→PM承認）
- 承認期限・エスカレーション機能
- 一括承認・代理承認機能
- 差戻理由記録・履歴管理
- 締め後の再オープン（履歴保持）
- 承認状態遷移（未申請→申請中→承認済/差戻→再申請）

##### 機能ID: FI-003 - 時間単価管理
**優先度**: MVP必須

**機能概要**
従業員・プロジェクト・作業種別ごとの時間単価を管理し、正確な原価計算を実現する。

**詳細要件**
- レートカード管理（標準/時間外/休日/深夜/委託）
- 複数軸での単価設定（従業員×プロジェクト×作業種別）
- 単価種別管理（標準・請求・予算単価）
- 改定履歴管理・有効期間設定
- 残業割増率設定（125%/135%/150%/160%）
- 端数処理規則（15分単位、月末一括調整）

**単価マスター項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| 従業員ID | ○ | VARCHAR | 10 | |
| 適用開始日 | ○ | DATE | - | |
| 適用終了日 | △ | DATE | - | |
| 標準単価 | ○ | DECIMAL | 10,0 | 円/時間 |
| 請求単価 | △ | DECIMAL | 10,0 | 円/時間 |
| 残業割増率 | ○ | DECIMAL | 5,2 | % |
| プロジェクト別単価 | △ | JSON | - | プロジェクト×単価 |

#### 2.2 プロジェクト原価管理 ★MVP必須

##### 機能ID: FI-004 - プロジェクト予算設定
**優先度**: MVP必須

**機能概要**
プロジェクトの予算を詳細に設定・管理し、実績との比較分析を行う。

**詳細要件**
- 予算項目別管理（人件費・外注費・経費・機器費）
- 予算階層（プロジェクト全体→フェーズ→タスク）
- 期間配賦（月次・四半期）
- 予算改定履歴管理

**予算マスター項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| プロジェクトID | ○ | VARCHAR | 20 | |
| 予算項目コード | ○ | VARCHAR | 10 | 勘定科目連携 |
| 予算金額 | ○ | DECIMAL | 15,0 | 円 |
| 予算期間開始 | ○ | DATE | - | |
| 予算期間終了 | ○ | DATE | - | |
| 配賦方法 | ○ | ENUM | - | 期間按分/進捗按分/手動 |
| 版数 | - | INTEGER | 3 | 改定版数 |

##### 機能ID: FI-005 - 実績原価追跡
**優先度**: MVP必須

**機能概要**
プロジェクトで発生した全ての原価を追跡し、リアルタイムで可視化する。

**詳細要件**
- 原価項目別集計（直接労務費・直接材料費・直接経費・間接費）
- 自動原価集計（タイムシート・購買・経費精算連携）
- 間接費配賦（工数按分・売上按分・カスタムルール）
- 原価トレンド分析・ドリルダウン

##### 機能ID: FI-006 - 原価差異分析
**優先度**: Should Have

**機能概要**
予算と実績の差異を多角的に分析し、原因究明と改善策検討を支援する。

**詳細要件**
- 差異分析種別（価格差異・数量差異・時期差異・構成差異）
- 多軸分析（時系列・プロジェクト比較・部門別・顧客別）
- 差異要因分析（内部・外部・計画要因）
- 改善アクション追跡

##### 機能ID: FI-007 - 収益性分析
**優先度**: Should Have

**機能概要**
プロジェクトの収益性を多面的に分析し、収益改善のための意思決定を支援する。

**詳細要件**
- 収益性指標（売上総利益率・営業利益率・ROI・EVA）
- 分析軸（プロジェクト別・顧客別・サービス別・期間別）
- 収益性ランキング・改善シミュレーション

#### 2.3 請求管理（インボイス対応） ★MVP必須

##### 機能ID: FI-008 - インボイス請求書発行
**優先度**: MVP必須

**機能概要**
インボイス制度に完全対応した請求書を発行し、売上・売掛金を正確に管理する。

**詳細要件**
- インボイス制度完全対応：
  - 適格請求書発行事業者登録番号（T+13桁）
  - 税率ごとの区分記載（8%/10%）
  - 税率ごとの消費税額表示
  - 端数処理規則（インボイス1枚につき税率ごと1回）
  - 取引年月日、取引内容、相手先名称の必須記載
- 請求書テンプレート（業界別・顧客別）
- 複数通貨対応・為替レート管理
- 電子インボイス（Peppol対応）［Phase 2想定／MVP除外］
- 請求書再発行・訂正処理（修正履歴保持）

###### ガード条件（与信・予算）
- project→orderの紐付けが存在する請求については、以下が満たされるまで請求生成を保留する。
  - 与信承認（sales.credit.approved または sales.credit.override.approved）
  - 予算割当完了（fi.budget.allocated 発火済み）
- 与信取り消し（sales.credit.revoked）後は、当該order関連の新規請求をブロックする。

###### 例外フローの取り扱い
- 与信保留（sales.credit.onhold）時は、請求準備を停止し、オペレーションへエスカレーション。
- 与信再申請（sales.credit.requested）を契機に状態を再評価。
- プロジェクト取消（pm.project.cancelled）時は、order↔projectの紐付けを解除し、未請求分は停止。

**請求書項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| 請求書番号 | ○ | VARCHAR | 20 | 自動採番 |
| 請求日 | ○ | DATE | - | |
| 支払期日 | ○ | DATE | - | |
| 顧客ID | ○ | VARCHAR | 20 | |
| 適格請求書発行事業者番号 | ○ | VARCHAR | 14 | T+13桁 |
| 小計（8%対象） | - | DECIMAL | 15,0 | 税抜金額 |
| 小計（10%対象） | - | DECIMAL | 15,0 | 税抜金額 |
| 消費税額（8%） | - | DECIMAL | 15,0 | 端数処理済 |
| 消費税額（10%） | - | DECIMAL | 15,0 | 端数処理済 |
| 合計金額 | - | DECIMAL | 15,0 | 税込金額 |

##### 機能ID: FI-009 - 売掛金管理
**優先度**: MVP必須

**機能概要**
売掛金の発生から回収まで一連の管理を行い、債権管理を効率化する。

**詳細要件**
- 売掛金自動計上（請求書発行連携）
- 入金消込処理（銀行API連携）
- 回収遅延管理・催促処理
- 債権年齢分析・貸倒引当金計算

##### 機能ID: FI-010 - 請求データ連携
**優先度**: MVP必須

**機能概要**
プロジェクト管理モジュールと連携し、プロジェクト実績に基づく請求を自動化する。

**詳細要件**
- 工数ベース請求（タイムシート連携）
- マイルストーンベース請求（進捗連携）
- 委託費・経費の転嫁請求
- 請求承認ワークフロー

#### 2.6 APIエンドポイント例（FI）
```yaml
# 受注状態（与信・予算・プロジェクト紐付）
GET /api/v1/fi/orders/{orderId}/status
  response: { orderId, credit: 'approved'|'rejected'|'onhold'|'revoked'|'unknown', projectId?: string, amount?: number, budgetAllocated: boolean }

# 請求生成（ガードはサーバ側で評価）
POST /api/v1/fi/invoices
  body: { timesheetId: string, projectId: string }
  guard: credit approved AND budget allocated when project→order mapping exists
```

#### 2.7 サンプルイベント（FI）
```json
{ "type": "fi.budget.allocated", "orderId": "SO-1001", "projectId": "PRJ-SO-1001", "amount": 500000 }
{ "type": "fi.invoice.generated", "invoiceId": "INV-2025-0001", "timesheetId": "TS-001", "projectId": "PRJ-SO-1001", "customerId": "C-001", "amount": 80000, "currency": "JPY" }
```

#### 2.4 予算管理 ★Should Have

##### 機能ID: FI-011 - 予算編成管理
**優先度**: Should Have

**機能概要**
予算編成の全プロセスを体系的に管理し、効率的な予算策定を実現する。

**詳細要件**
- 予算編成サイクル管理（年次・中期・四半期）
- トップダウン・ボトムアップ予算
- 部門別予算作成・調整・統合
- 予算承認ワークフロー

##### 機能ID: FI-012 - ローリング予算
**優先度**: Should Have

**機能概要**
定期的な予算見直しにより、環境変化に対応した柔軟な予算管理を実現する。

**詳細要件**
- ローリング周期設定（月次・四半期）
- 実績データ自動取込
- トレンド分析による予測
- シナリオ管理・変更履歴

##### 機能ID: FI-013 - 予実管理
**優先度**: Should Have

**機能概要**
予算と実績をリアルタイムで比較し、差異の早期発見と対策実施を支援する。

**詳細要件**
- 予実比較（時系列・部門別・プロジェクト別・科目別）
- 差異分析（金額差異・率差異・累計差異）
- 差異アラート機能・ドリルダウン分析
- 改善アクション管理

#### 2.5 電子帳簿保存法対応 ★MVP必須

##### 機能ID: FI-014 - 電子帳簿保存要件
**優先度**: MVP必須

**機能概要**
電子帳簿保存法の要件を完全に満たし、7年間（欠損金がある場合10年間）の適正な帳簿保存を実現する。

**詳細要件**
- **検索要件の充足**：
  - 取引年月日での検索
  - 金額範囲での検索
  - 取引先名での検索
  - 複合検索（日付×金額×取引先）
  - 検索結果のダウンロード機能

- **真実性の確保**：
  - タイムスタンプ付与（NTPサーバー同期）
  - 改ざん防止（ハッシュ値管理、KMS暗号化）
  - 訂正・削除履歴の完全保持
  - 電子署名対応

- **可視性の確保**：
  - ディスプレイ表示（明瞭な状態）
  - 印刷出力（整然とした形式）
  - PDF/CSV出力機能

- **保存期間管理**：
  - 法定保存期間（7年/10年）自動管理
  - 保存期限アラート
  - 削除防止ロック機能
  - アーカイブ機能（S3 Glacier連携）

**保存対象書類**
| 書類種別 | 保存期間 | 保存形式 | 備考 |
|----------|----------|----------|------|
| 請求書 | 7年 | PDF/XML | インボイス対応 |
| 見積書 | 7年 | PDF | |
| 契約書 | 7年 | PDF | 電子署名付き |
| 領収書 | 7年 | PDF/画像 | OCR処理 |
| タイムシート | 7年 | DB/PDF | 監査証跡 |
| 総勘定元帳 | 10年 | DB/PDF | 欠損金がある場合 |

#### 2.6 資金管理

##### 機能ID: FI-015 - 資金繰り管理
**優先度**: Could Have

**機能概要**
企業の資金フローを予測・管理し、資金不足の回避と資金効率の最適化を図る。

**詳細要件**
- 資金繰り表作成（日次・週次・月次）
- 収支項目管理（売掛金回収・買掛金支払・給与・税金）
- 資金予測・シミュレーション
- 資金ショート予防アラート

#### 2.7 固定資産管理

##### 機能ID: FI-016 - 資産台帳管理
**優先度**: Could Have

**機能概要**
固定資産を一元管理し、取得から除却までのライフサイクルを追跡する。

**詳細要件**
- 資産情報管理（資産コード・分類・取得価額・耐用年数）
- 資産移動管理（部門間移動・場所変更・使用者変更）
- 減価償却計算（定額法・定率法・税務対応）
- 資産棚卸・差異処理

---

### 3. データモデル

#### 3.1 主要エンティティ

```sql
-- タイムシートマスター
CREATE TABLE timesheets (
    timesheet_id VARCHAR(20) PRIMARY KEY,
    employee_id VARCHAR(10) NOT NULL,
    work_date DATE NOT NULL,
    project_id VARCHAR(20) NOT NULL,
    task_id VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_time DECIMAL(3,2) DEFAULT 0,
    work_content TEXT NOT NULL,
    overtime_type ENUM('通常','法定内','法定外','深夜') NOT NULL,
    work_location ENUM('社内','在宅','客先') NOT NULL,
    approval_status ENUM('未申請','申請中','承認済','差戻') DEFAULT '未申請',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id),
    FOREIGN KEY (task_id) REFERENCES tasks(task_id)
);

-- 時間単価マスター
CREATE TABLE hourly_rates (
    rate_id VARCHAR(20) PRIMARY KEY,
    employee_id VARCHAR(10) NOT NULL,
    project_id VARCHAR(20),
    effective_date DATE NOT NULL,
    expiry_date DATE,
    standard_rate DECIMAL(10,0) NOT NULL,
    billing_rate DECIMAL(10,0),
    overtime_multiplier DECIMAL(5,2) DEFAULT 1.25,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- プロジェクト予算マスター
CREATE TABLE project_budgets (
    budget_id VARCHAR(20) PRIMARY KEY,
    project_id VARCHAR(20) NOT NULL,
    budget_item_code VARCHAR(10) NOT NULL,
    budget_amount DECIMAL(15,0) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    allocation_method ENUM('期間按分','進捗按分','手動') NOT NULL,
    version_no INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

-- 請求書マスター
CREATE TABLE invoices (
    invoice_id VARCHAR(20) PRIMARY KEY,
    invoice_no VARCHAR(20) UNIQUE NOT NULL,
    customer_id VARCHAR(20) NOT NULL,
    project_id VARCHAR(20),
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    qualified_invoice_no VARCHAR(13) NOT NULL,
    subtotal DECIMAL(15,0) NOT NULL,
    tax_amount DECIMAL(15,0) NOT NULL,
    total_amount DECIMAL(15,0) NOT NULL,
    status ENUM('下書き','発行済','入金済','取消') DEFAULT '下書き',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);
```

#### 3.2 データ関係図
- タイムシート（多）対（1）プロジェクト
- タイムシート（多）対（1）タスク
- 時間単価（多）対（1）従業員
- プロジェクト予算（多）対（1）プロジェクト
- 請求書（多）対（1）プロジェクト

---

### 4. 画面・UI要件

#### 4.1 主要画面一覧
| 画面ID | 画面名 | 説明 | 対象ユーザー |
|--------|--------|------|-------------|
| FI-S001 | 財務ダッシュボード | 財務KPI・資金状況俯瞰 | 経営層、財務部門 |
| FI-S002 | タイムシート入力画面 | 工数・作業時間入力 | 全従業員 |
| FI-S003 | 原価分析画面 | プロジェクト原価分析 | PM、管理会計担当 |
| FI-S004 | 請求書作成画面 | インボイス請求書作成 | 経理担当 |
| FI-S005 | 予実管理画面 | 予算実績比較分析 | 予算管理者 |
| FI-S006 | 承認画面 | タイムシート・請求承認 | 管理者 |

#### 4.2 ダッシュボード要件
- **財務指標**：売上高、営業利益、経常利益
- **プロジェクト原価**：予算消化率、原価差異、収益性
- **タイムシート状況**：承認待ち件数、入力率
- **請求状況**：請求済金額、入金待ち金額、回収遅延
- **予算執行状況**：部門別消化率、超過予算アラート

---

### 5. API仕様

#### 5.1 主要APIエンドポイント

```yaml
Timesheet API:
  GET /api/v1/timesheets:
    description: タイムシート一覧取得
    parameters:
      - employee_id: string
      - date_from: date
      - date_to: date
    response: Timesheet[]

  POST /api/v1/timesheets:
    description: タイムシート登録
    body: TimesheetCreateRequest
    response: Timesheet

  PUT /api/v1/timesheets/{id}/approve:
    description: タイムシート承認
    response: Timesheet

Project Cost API:
  GET /api/v1/projects/{project_id}/costs:
    description: プロジェクト原価取得
    response: ProjectCost

  GET /api/v1/projects/{project_id}/budget-actual:
    description: 予実比較データ取得
    response: BudgetActualComparison

Invoice API:
  GET /api/v1/invoices:
    description: 請求書一覧取得
    parameters:
      - customer_id: string (optional)
      - status: string (optional)
    response: Invoice[]

  POST /api/v1/invoices:
    description: 請求書作成
    body: InvoiceCreateRequest
    response: Invoice

  GET /api/v1/invoices/{id}/pdf:
    description: 請求書PDF取得
    response: Binary (PDF)
```

---

### 6. 他モジュール連携

#### 6.1 連携モジュール
| 連携先 | 連携内容 | 連携方式 | 頻度 |
|--------|----------|----------|------|
| プロジェクト管理（PM） | プロジェクト情報・WBS・進捗 | API | リアルタイム |
| 人事管理（HR） | 従業員情報・組織・給与 | API | 日次 |
| 販売管理（Sales） | 受注・顧客・契約情報 | API | リアルタイム |
| 購買管理（Procurement） | 発注・仕入・支払情報 | API | リアルタイム |

#### 6.2 外部システム連携
| システム | 連携内容 | プロトコル | 認証方式 |
|----------|----------|------------|----------|
| 会計システム | 仕訳データ・財務諸表 | REST API | OAuth2.0 |
| 銀行API | 入出金明細・残高照会 | API/SFTP | 電子証明書 |
| 税務システム | インボイス・申告データ | XML | デジタル証明書 |
| 給与システム | 給与・賞与データ | REST API | JWT |

---

### 7. 実装優先度

#### 7.1 MVP（Phase 1: 0-6ヶ月）
- **Must Have**
  - FI-001: 工数入力管理
  - FI-002: 承認ワークフロー
  - FI-003: 時間単価管理
  - FI-004: プロジェクト予算設定
  - FI-005: 実績原価追跡
  - FI-008: インボイス請求書発行
  - FI-009: 売掛金管理
  - FI-010: 請求データ連携

#### 7.2 Phase 2（7-12ヶ月）
- **Should Have**
  - FI-006: 原価差異分析
  - FI-007: 収益性分析
  - FI-011: 予算編成管理
  - FI-012: ローリング予算
  - FI-013: 予実管理

#### 7.3 Phase 3（13-18ヶ月）
- **Could Have**
  - FI-014: 資金繰り管理
  - FI-015: 資産台帳管理
  - ABC原価計算
  - 高度な財務分析

---

### 8. 非機能要件

#### 8.1 パフォーマンス要件
- タイムシート一覧表示：3秒以内
- 原価集計処理：大規模プロジェクト（10万時間）5分以内
- 請求書PDF生成：1秒以内
- 月次決算処理：4時間以内

#### 8.2 可用性要件
- システム稼働率：99.9%
- 計画停止：月1回2時間以内
- バックアップ：日次フル、時間増分

#### 8.3 セキュリティ要件
- 財務データ暗号化（AES-256）
- 職務分離による内部統制
- 操作ログ完全記録
- プロジェクト単位アクセス制御

#### 8.4 コンプライアンス要件
- インボイス制度完全対応
- 電子帳簿保存法対応
- J-SOX内部統制対応
- 個人情報保護法対応

---

### 9. 移行要件

#### 9.1 データ移行
- 既存タイムシートデータ（過去3年分）
- プロジェクト予算・実績データ
- 請求・売掛金データ
- 時間単価マスターデータ
- 会計科目マッピング

#### 9.2 システム移行
- 段階的移行（新規プロジェクト→既存プロジェクト）
- 3ヶ月並行稼働期間
- データ整合性検証
- ユーザートレーニング

---

### 10. テスト要件

#### 10.1 機能テスト
- タイムシート入力・承認フロー
- 原価計算精度（誤差1%以内）
- インボイス請求書要件適合性
- システム間連携データ整合性

#### 10.2 性能テスト
- 大量データ処理（月10万件タイムシート）
- 同時接続テスト（200ユーザー）
- 月次処理性能（4時間以内）

#### 10.3 セキュリティテスト
- アクセス権限制御
- データ暗号化
- 監査ログ出力
- 脆弱性診断

---

### 11. 用語定義

| 用語 | 定義 |
|------|------|
| タイムシート | 従業員の作業時間記録システム |
| インボイス | 適格請求書発行事業者が発行する請求書 |
| 工数 | プロジェクトに投入された作業時間 |
| 原価差異 | 予算原価と実績原価の差額 |
| EVM | Earned Value Management - 出来高管理 |
| ROI | Return on Investment - 投資収益率 |
| J-SOX | 日本版サーベンス・オクスリー法 |

---

*本仕様書は、財務管理モジュールの詳細要求仕様書です。特にタイムシート管理、プロジェクト原価管理、インボイス対応請求管理を重視した実装可能な仕様として策定されています。*
