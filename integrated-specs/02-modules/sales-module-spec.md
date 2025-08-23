# 販売管理モジュール詳細仕様書
## Sales Management Module Specification

### 1. モジュール概要

#### 1.1 目的
販売管理モジュールは、見積から受注、出荷、請求に至る販売プロセス全体を統合管理し、与信管理、価格管理、在庫との軽量連携を通じて、営業効率の向上と収益最適化を実現する。

#### 1.2 適用範囲
- **見積管理**（Phase 2必須）
- **受注管理**（Phase 2必須）
- **与信管理**（Phase 2必須）
- **価格管理**（Phase 2必須）
- **在庫連携**（軽量、Phase 2必須）
- 売上分析・レポーティング
- 販売戦略支援

#### 1.3 対象ユーザー
- 営業担当者
- 営業管理者
- 販売管理部門
- 与信管理担当者
- 経営層（売上分析）

---

### 2. 機能要件

#### 2.1 見積管理 ★Phase 2必須

##### 機能ID: SA-001 - 見積書作成・管理
**優先度**: Must Have (Phase 2)

**機能概要**
顧客のニーズに応じた正確な見積書を迅速に作成し、見積プロセス全体を管理する。

**詳細要件**
- 見積テンプレート（商品別・業界別・顧客別）
- 複数通貨対応・為替レート自動取得
- 見積有効期限管理・自動失効
- 見積履歴管理・バージョン管理
- 承認ワークフロー（金額閾値別）
- PDF出力・メール送信機能

**入力項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| 見積番号 | ○ | VARCHAR | 20 | 自動採番 |
| 顧客ID | ○ | FK | - | 顧客マスター連携 |
| 見積日 | ○ | DATE | - | |
| 有効期限 | ○ | DATE | - | デフォルト30日 |
| 営業担当者 | ○ | FK | - | 従業員マスター連携 |
| 通貨 | ○ | VARCHAR | 3 | USD/EUR/JPY等 |
| 為替レート | △ | DECIMAL | 10,4 | 自動取得可 |
| 小計金額 | - | DECIMAL | 15,2 | 自動計算 |
| 消費税額 | - | DECIMAL | 15,2 | 自動計算 |
| 合計金額 | - | DECIMAL | 15,2 | 自動計算 |

##### 機能ID: SA-002 - 見積承認ワークフロー
**優先度**: Must Have (Phase 2)

**機能概要**
見積書の承認プロセスを自動化し、権限統制と承認効率を両立する。

**詳細要件**
- 金額閾値別承認ルート（100万円未満→課長、1000万円未満→部長、1000万円以上→役員）
- 期限管理・エスカレーション機能
- 承認理由・差戻理由記録
- 承認状況可視化

#### 2.2 受注管理 ★Phase 2必須

##### 機能ID: SA-003 - 受注処理
**優先度**: Must Have (Phase 2)

**機能概要**
見積から受注への転換を円滑に処理し、受注情報を正確に管理する。

**詳細要件**
- 見積からの受注変換機能
- 受注条件変更管理（数量・価格・納期）
- 分割受注・部分受注対応
- 受注残管理（未出荷・未請求）
- 受注取消・変更履歴管理

**入力項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| 受注番号 | ○ | VARCHAR | 20 | 自動採番 |
| 見積番号 | △ | FK | - | 見積からの変換時 |
| 顧客ID | ○ | FK | - | |
| 受注日 | ○ | DATE | - | |
| 希望納期 | ○ | DATE | - | |
| 出荷予定日 | ○ | DATE | - | |
| 支払条件 | ○ | VARCHAR | 50 | |
| 受注ステータス | ○ | ENUM | - | 受注/出荷中/完了/キャンセル |

##### 機能ID: SA-004 - 納期管理
**優先度**: Must Have (Phase 2)

**機能概要**
受注から出荷まで納期を管理し、遅延リスクを早期に把握する。

**詳細要件**
- 納期予測・アラート機能
- 生産・調達リードタイム連携
- 納期変更承認機能
- 出荷スケジュール管理

#### 2.3 与信管理 ★Phase 2必須

##### 機能ID: SA-005 - 与信限度額管理
**優先度**: Must Have (Phase 2)

**機能概要**
顧客別の与信限度額を設定・監視し、貸倒リスクを最小化する。

**詳細要件**
- 顧客別与信限度額設定
- 与信残高リアルタイム監視
- 与信超過アラート・ブロック機能
- 与信限度額見直し周期管理
- 外部信用調査機関連携

**与信管理項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| 顧客ID | ○ | FK | - | |
| 与信限度額 | ○ | DECIMAL | 15,0 | 円 |
| 現在与信残高 | - | DECIMAL | 15,0 | 自動計算 |
| 与信利用率 | - | DECIMAL | 5,2 | % |
| 最終見直し日 | ○ | DATE | - | |
| 次回見直し日 | ○ | DATE | - | |
| 信用格付 | ○ | ENUM | - | AAA/AA/A/BBB/BB/B/C |

##### 機能ID: SA-006 - 与信審査
**優先度**: Must Have (Phase 2)

**機能概要**
新規顧客・既存顧客の与信審査を体系的に実施する。

**詳細要件**
- 信用情報収集・分析
- 財務分析（安全性・収益性・成長性）
- 取引実績評価
- 業界リスク分析
- 与信判定自動化（スコアリングモデル）

#### 2.4 価格管理 ★Phase 2必須

##### 機能ID: SA-007 - 価格表管理
**優先度**: Must Have (Phase 2)

**機能概要**
商品・サービスの価格を体系的に管理し、価格戦略を効果的に実行する。

**詳細要件**
- 標準価格・特別価格管理
- 顧客別価格設定
- 数量割引・期間限定価格
- 価格改定履歴管理
- 競合価格比較

**価格マスター項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| 商品コード | ○ | VARCHAR | 20 | |
| 価格種別 | ○ | ENUM | - | 標準/特別/顧客別 |
| 適用開始日 | ○ | DATE | - | |
| 適用終了日 | △ | DATE | - | |
| 単価 | ○ | DECIMAL | 12,2 | |
| 通貨 | ○ | VARCHAR | 3 | |
| 最小販売単位 | ○ | INTEGER | 8 | |

##### 機能ID: SA-008 - 価格承認管理
**優先度**: Must Have (Phase 2)

**機能概要**
標準価格からの逸脱について承認統制を実施する。

**詳細要件**
- 値引き承認ワークフロー
- 値引き率制限設定
- 値引き理由コード管理
- 価格承認履歴追跡

#### 2.5 在庫連携（軽量） ★Phase 2必須

##### 機能ID: SA-009 - 在庫照会連携
**優先度**: Must Have (Phase 2)

**機能概要**
在庫システムと軽量連携し、販売に必要な在庫情報を取得する。

**詳細要件**
- リアルタイム在庫照会
- 引当可能在庫確認
- 在庫不足アラート
- 代替品提案
- 入荷予定照会

##### 機能ID: SA-010 - 販売引当処理
**優先度**: Must Have (Phase 2)

**機能概要**
受注時に在庫引当を実行し、在庫の二重販売を防止する。

**詳細要件**
- 自動引当・手動引当切り替え
- 引当優先順位設定
- 引当解除処理
- 引当状況可視化

#### 2.6 売上分析・レポーティング

##### 機能ID: SA-011 - 売上分析
**優先度**: Should Have (Phase 2)

**機能概要**
多角的な売上分析により営業戦略の意思決定を支援する。

**詳細要件**
- 売上推移分析（時系列・比較）
- 顧客別・商品別・担当者別分析
- 地域別・業界別分析
- 予実対比分析
- 売上予測

##### 機能ID: SA-012 - 販売レポート
**優先度**: Should Have (Phase 2)

**機能概要**
定型・定期レポートを自動生成し、営業活動の効率化を図る。

**詳細要件**
- 日次・週次・月次売上レポート
- 受注残レポート
- 与信状況レポート
- 営業担当者別績効レポート
- ダッシュボード表示

---

### 3. データモデル

#### 3.1 主要エンティティ

```sql
-- 見積マスター
CREATE TABLE quotations (
    quotation_id VARCHAR(20) PRIMARY KEY,
    quotation_no VARCHAR(20) UNIQUE NOT NULL,
    customer_id VARCHAR(20) NOT NULL,
    quotation_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    sales_rep_id VARCHAR(20) NOT NULL,
    currency VARCHAR(3) DEFAULT 'JPY',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    subtotal DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    status ENUM('下書き','承認待ち','承認済','失効','受注済') DEFAULT '下書き',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (sales_rep_id) REFERENCES employees(employee_id)
);

-- 受注マスター
CREATE TABLE sales_orders (
    order_id VARCHAR(20) PRIMARY KEY,
    order_no VARCHAR(20) UNIQUE NOT NULL,
    quotation_id VARCHAR(20),
    customer_id VARCHAR(20) NOT NULL,
    order_date DATE NOT NULL,
    requested_delivery_date DATE NOT NULL,
    planned_shipping_date DATE NOT NULL,
    payment_terms VARCHAR(50) NOT NULL,
    subtotal DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    status ENUM('受注','出荷中','完了','キャンセル') DEFAULT '受注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- 与信管理マスター
CREATE TABLE credit_limits (
    customer_id VARCHAR(20) PRIMARY KEY,
    credit_limit DECIMAL(15,0) NOT NULL,
    current_balance DECIMAL(15,0) DEFAULT 0,
    credit_utilization DECIMAL(5,2) AS (current_balance / credit_limit * 100),
    last_review_date DATE NOT NULL,
    next_review_date DATE NOT NULL,
    credit_rating ENUM('AAA','AA','A','BBB','BB','B','C') NOT NULL,
    auto_approval_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- 価格マスター
CREATE TABLE pricing (
    pricing_id VARCHAR(20) PRIMARY KEY,
    product_code VARCHAR(20) NOT NULL,
    customer_id VARCHAR(20),
    price_type ENUM('標準','特別','顧客別') NOT NULL,
    effective_date DATE NOT NULL,
    expiry_date DATE,
    unit_price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'JPY',
    min_order_qty INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- 在庫引当テーブル
CREATE TABLE inventory_allocations (
    allocation_id VARCHAR(20) PRIMARY KEY,
    order_id VARCHAR(20) NOT NULL,
    product_code VARCHAR(20) NOT NULL,
    allocated_qty INTEGER NOT NULL,
    allocation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('引当','出荷','解除') DEFAULT '引当',
    FOREIGN KEY (order_id) REFERENCES sales_orders(order_id)
);
```

#### 3.2 データ関係図
- 見積（1）対（多）見積明細
- 見積（1）対（0-1）受注
- 受注（1）対（多）受注明細
- 顧客（1）対（1）与信限度額
- 商品（多）対（多）価格設定
- 受注（多）対（多）在庫引当

---

### 4. 画面・UI要件

#### 4.1 主要画面一覧
| 画面ID | 画面名 | 説明 | 対象ユーザー |
|--------|--------|------|-------------|
| SA-S001 | 販売ダッシュボード | 売上・受注・与信状況俯瞰 | 営業管理者、経営層 |
| SA-S002 | 見積作成画面 | 見積書作成・編集 | 営業担当者 |
| SA-S003 | 受注管理画面 | 受注処理・進捗管理 | 営業担当者 |
| SA-S004 | 与信管理画面 | 与信限度額・残高管理 | 与信管理者 |
| SA-S005 | 価格管理画面 | 価格設定・承認 | 販売管理者 |
| SA-S006 | 在庫照会画面 | 在庫状況・引当確認 | 営業担当者 |

#### 4.2 ダッシュボード要件
- **売上指標**: 月次売上、前年同期比、売上目標達成率
- **受注状況**: 受注件数、受注残高、納期遅延件数
- **与信状況**: 与信超過件数、与信利用率、延滞債権額
- **商談進捗**: 見積件数、受注転換率、平均商談期間
- **在庫状況**: 在庫不足商品数、引当残数量

---

### 5. API仕様

#### 5.1 主要APIエンドポイント

```yaml
Quotation API:
  GET /api/v1/sales/quotations:
    description: 見積一覧取得
    parameters:
      - customer_id: string (optional)
      - status: string (optional)
      - date_from: date (optional)
      - date_to: date (optional)
    response: Quotation[]

  POST /api/v1/sales/quotations:
    description: 見積作成
    body: QuotationCreateRequest
    response: Quotation

  PUT /api/v1/sales/quotations/{id}/approve:
    description: 見積承認
    body: ApprovalRequest
    response: Quotation

Sales Order API:
  GET /api/v1/sales/orders:
    description: 受注一覧取得
    parameters:
      - customer_id: string (optional)
      - status: string (optional)
    response: SalesOrder[]

  POST /api/v1/sales/orders:
    description: 受注作成
    body: OrderCreateRequest
    response: SalesOrder

  PUT /api/v1/sales/orders/{id}/status:
    description: 受注ステータス更新
    body: StatusUpdateRequest
    response: SalesOrder

Credit Management API:
  GET /api/v1/sales/credit/{customer_id}:
    description: 与信情報取得
    response: CreditInfo

  PUT /api/v1/sales/credit/{customer_id}:
    description: 与信限度額更新
    body: CreditUpdateRequest
    response: CreditInfo

  GET /api/v1/sales/credit/check:
    description: 与信チェック
    parameters:
      - customer_id: string
      - amount: number
    response: CreditCheckResult

Pricing API:
  GET /api/v1/sales/pricing:
    description: 価格情報取得
    parameters:
      - product_code: string
      - customer_id: string (optional)
      - effective_date: date (optional)
    response: PricingInfo[]

Inventory API:
  GET /api/v1/sales/inventory/{product_code}:
    description: 在庫照会
    response: InventoryInfo

  POST /api/v1/sales/inventory/allocate:
    description: 在庫引当
    body: AllocationRequest
    response: AllocationResult
```

---

### 6. 他モジュール連携

#### 6.1 連携モジュール
| 連携先 | 連携内容 | 連携方式 | 頻度 |
|--------|----------|----------|------|
| CRM | 顧客情報・商談情報 | API | リアルタイム |
| 財務管理（FI） | 売掛金・請求情報 | API | リアルタイム |
| プロジェクト管理（PM） | 受注プロジェクト連携 | API | リアルタイム |
| 在庫管理 | 在庫照会・引当・出荷 | API | リアルタイム |

#### 6.2 外部システム連携
| システム | 連携内容 | プロトコル | 認証方式 |
|----------|----------|------------|----------|
| 基幹システム | 商品マスター・顧客マスター | REST API | OAuth2.0 |
| 信用調査機関 | 与信情報・企業情報 | REST API | API Key |
| 為替レート取得 | リアルタイム為替情報 | REST API | API Key |
| EDI | 受発注データ交換 | EDI/XML | 電子証明書 |

---

### 7. 実装優先度

#### 7.1 Phase 2（7-12ヶ月）
- **Must Have**
  - SA-001: 見積書作成・管理
  - SA-002: 見積承認ワークフロー
  - SA-003: 受注処理
  - SA-004: 納期管理
  - SA-005: 与信限度額管理
  - SA-006: 与信審査
  - SA-007: 価格表管理
  - SA-008: 価格承認管理
  - SA-009: 在庫照会連携
  - SA-010: 販売引当処理

#### 7.2 Phase 3（13-18ヶ月）
- **Should Have**
  - SA-011: 売上分析
  - SA-012: 販売レポート
  - 高度な価格最適化
  - AI活用の需要予測

---

### 8. 非機能要件

#### 8.1 パフォーマンス要件
- 見積作成処理：3秒以内
- 受注処理：5秒以内（在庫チェック含む）
- 与信チェック：1秒以内
- 在庫照会：1秒以内
- 売上レポート生成：10秒以内（年間データ）

#### 8.2 可用性要件
- システム稼働率：99.9%
- 計画停止：月1回2時間以内
- バックアップ：日次フル、時間増分

#### 8.3 セキュリティ要件
- 顧客情報暗号化（AES-256）
- 価格情報アクセス制御
- 操作ログ完全記録
- 与信情報機密性確保

#### 8.4 コンプライアンス要件
- 下請法対応（支払条件管理）
- 独占禁止法対応（価格カルテル防止）
- 輸出管理令対応（輸出入管理）

---

### 9. 移行要件

#### 9.1 データ移行
- 既存見積データ（過去1年分）
- 受注・売上データ（過去3年分）
- 顧客別価格設定データ
- 与信限度額・取引実績データ
- 商品マスター・価格マスター

#### 9.2 システム移行
- 段階的移行（新規取引→既存取引）
- 3ヶ月並行稼働期間
- データ整合性検証
- ユーザートレーニング

---

### 10. テスト要件

#### 10.1 機能テスト
- 見積・受注処理フロー
- 与信チェック精度
- 価格計算ロジック
- 在庫連携データ整合性

#### 10.2 性能テスト
- 大量データ処理（月1万件受注）
- 同時接続テスト（100ユーザー）
- レスポンス時間測定

#### 10.3 セキュリティテスト
- アクセス権限制御
- データ暗号化
- 不正アクセス検知

---

### 11. 用語定義

| 用語 | 定義 |
|------|------|
| 与信限度額 | 顧客に対する信用販売の上限額 |
| 与信残高 | 現在の売掛金残高 |
| 引当 | 在庫の予約・確保処理 |
| 見切り価格 | 在庫処分のための特別価格 |
| EDI | Electronic Data Interchange - 電子データ交換 |
| 下請法 | 下請代金支払遅延等防止法 |

---

*本仕様書は、販売管理モジュールの詳細要求仕様書です。Phase 2実装を前提とし、他モジュールとの整合性を確保した仕様となっています。*