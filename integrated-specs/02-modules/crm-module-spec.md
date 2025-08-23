# CRMモジュール詳細仕様書
## Customer Relationship Management Module Specification

### 1. モジュール概要

#### 1.1 目的
CRMモジュールは、顧客との関係を体系的に管理し、営業支援、マーケティング活動、カスタマーサービスを統合することで、顧客満足度の向上と売上拡大を実現する。リード管理から商談管理、顧客ポータルまで、顧客ライフサイクル全体をカバーする。

#### 1.2 適用範囲
- **顧客情報管理**（Phase 2必須）
- **営業支援機能**（リード管理・商談管理、Phase 2必須）
- **マーケティング機能**（Phase 2必須）
- **カスタマーポータル**（Phase 2必須）
- カスタマーサポート
- 顧客分析・セグメンテーション
- キャンペーン管理

#### 1.3 対象ユーザー
- 営業担当者
- マーケティング担当者
- カスタマーサポート担当者
- 営業管理者・マーケティング管理者
- 顧客（カスタマーポータル利用）
- 経営層（顧客分析）

---

### 2. 機能要件

#### 2.1 顧客情報管理 ★Phase 2必須

##### 機能ID: CRM-001 - 統合顧客データベース
**優先度**: Must Have (Phase 2)

**機能概要**
顧客情報を一元管理し、360度の顧客ビューを提供する。

**詳細要件**
- 企業情報・個人情報の統合管理
- 階層構造（グループ企業・子会社・部門）
- 重複排除・データクレンジング
- データ品質管理・標準化
- 顧客分類・セグメンテーション
- 顧客ステータス管理（見込・既存・休眠・失注）

**入力項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| 顧客ID | ○ | VARCHAR | 20 | 自動採番 |
| 顧客名 | ○ | VARCHAR | 200 | |
| 顧客種別 | ○ | ENUM | - | 法人/個人 |
| 業界コード | ○ | VARCHAR | 10 | 業界分類 |
| 企業規模 | ○ | ENUM | - | 大企業/中小企業/個人事業 |
| 年間売上 | △ | DECIMAL | 15,0 | 円 |
| 従業員数 | △ | INTEGER | 8 | |
| 設立年 | △ | DATE | - | |
| 上場区分 | △ | ENUM | - | 上場/非上場 |
| 担当営業 | ○ | FK | - | 従業員マスター連携 |
| 顧客ランク | ○ | ENUM | - | A/B/C/D |

##### 機能ID: CRM-002 - 連絡先管理
**優先度**: Must Have (Phase 2)

**機能概要**
顧客企業内の担当者・意思決定者の詳細情報を管理する。

**詳細要件**
- 組織内役職・権限管理
- 複数連絡先（電話・メール・SNS）
- コミュニケーション履歴
- 名刺管理・OCR連携
- 担当者異動履歴

##### 機能ID: CRM-003 - 顧客セグメンテーション
**優先度**: Should Have (Phase 2)

**機能概要**
顧客を様々な軸でセグメント分けし、ターゲット営業・マーケティングを支援する。

**詳細要件**
- 多軸セグメンテーション（業界・規模・売上・行動）
- RFM分析（Recency/Frequency/Monetary）
- 動的セグメント更新
- セグメント別施策管理

#### 2.2 営業支援（リード・商談管理） ★Phase 2必須

##### 機能ID: CRM-004 - リード管理
**優先度**: Must Have (Phase 2)

**機能概要**
見込顧客情報を効率的に管理し、営業機会を最大化する。

**詳細要件**
- リード獲得ソース管理（Web・展示会・紹介・広告）
- リードスコアリング（自動・手動）
- リード育成（ナーチャリング）フロー
- 営業担当者自動割当
- 重複リード統合・品質管理

**入力項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| リードID | ○ | VARCHAR | 20 | 自動採番 |
| 企業名 | ○ | VARCHAR | 200 | |
| 担当者名 | ○ | VARCHAR | 100 | |
| 部署・役職 | △ | VARCHAR | 100 | |
| 電話番号 | △ | VARCHAR | 20 | |
| メールアドレス | ○ | VARCHAR | 100 | |
| 獲得ソース | ○ | ENUM | - | Web/展示会/紹介/広告 |
| 興味分野 | △ | TEXT | 500 | |
| リードスコア | - | INTEGER | 3 | 0-100 |
| ステータス | ○ | ENUM | - | 新規/接触中/見込/失注 |

##### 機能ID: CRM-005 - 商談管理
**優先度**: Must Have (Phase 2)

**機能概要**
商談プロセス全体を管理し、成約率向上を支援する。

**詳細要件**
- 商談ステージ管理（6-8段階）
- 受注確度・予想受注金額管理
- 商談履歴・活動記録
- 次回アクション・フォローアップ管理
- 商談分析・予測

**入力項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| 商談ID | ○ | VARCHAR | 20 | 自動採番 |
| 商談名 | ○ | VARCHAR | 200 | |
| 顧客ID | ○ | FK | - | |
| 担当営業 | ○ | FK | - | |
| 商談ステージ | ○ | ENUM | - | 初回/提案/見積/検討/最終/受注/失注 |
| 受注確度 | ○ | INTEGER | 3 | % |
| 予想受注金額 | ○ | DECIMAL | 15,0 | 円 |
| 予想受注日 | ○ | DATE | - | |
| 競合情報 | △ | TEXT | 1000 | |
| 失注理由 | △ | TEXT | 500 | 失注時必須 |

##### 機能ID: CRM-006 - 営業活動管理
**優先度**: Must Have (Phase 2)

**機能概要**
営業活動を体系的に記録・管理し、営業効率の向上を図る。

**詳細要件**
- 活動種別管理（電話・メール・訪問・展示会・セミナー）
- 活動履歴自動記録
- フォローアップ予定管理
- 活動効果分析
- 営業日報・週報機能

#### 2.3 マーケティング機能 ★Phase 2必須

##### 機能ID: CRM-007 - キャンペーン管理
**優先度**: Must Have (Phase 2)

**機能概要**
マーケティングキャンペーンの企画から実行、効果測定まで一元管理する。

**詳細要件**
- キャンペーン企画・予算管理
- ターゲット設定・セグメント連携
- 多チャネル展開（メール・Web・SNS・DM）
- 効果測定・ROI分析
- A/Bテスト機能

**入力項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| キャンペーンID | ○ | VARCHAR | 20 | 自動採番 |
| キャンペーン名 | ○ | VARCHAR | 200 | |
| 開始日 | ○ | DATE | - | |
| 終了日 | ○ | DATE | - | |
| 予算 | ○ | DECIMAL | 12,0 | 円 |
| チャネル | ○ | ENUM | - | メール/Web/SNS/DM/イベント |
| ターゲット数 | - | INTEGER | 8 | |
| レスポンス率 | - | DECIMAL | 5,2 | % |
| コンバージョン率 | - | DECIMAL | 5,2 | % |
| ROI | - | DECIMAL | 8,2 | % |

##### 機能ID: CRM-008 - メールマーケティング
**優先度**: Must Have (Phase 2)

**機能概要**
効果的なメールマーケティングを実現する。

**詳細要件**
- メールテンプレート管理
- 配信リスト管理・セグメンテーション
- 配信スケジュール設定
- 開封率・クリック率測定
- オプトイン・オプトアウト管理

##### 機能ID: CRM-009 - デジタルマーケティング連携
**優先度**: Should Have (Phase 2)

**機能概要**
デジタルマーケティングツールと連携し、統合的な顧客体験を提供する。

**詳細要件**
- Webサイト行動トラッキング
- ソーシャルメディア連携
- マーケティングオートメーション
- コンテンツ管理・配信

#### 2.4 カスタマーポータル ★Phase 2必須

##### 機能ID: CRM-010 - 顧客専用ポータル
**優先度**: Must Have (Phase 2)

**機能概要**
顧客が自社の情報にアクセス・更新できるセルフサービス機能を提供する。

**詳細要件**
- 顧客情報参照・更新機能
- 注文履歴・請求書照会
- サポートチケット管理
- ドキュメント・資料ダウンロード
- お知らせ・アップデート通知

##### 機能ID: CRM-011 - セルフサービス機能
**優先度**: Must Have (Phase 2)

**機能概要**
顧客の利便性向上とサポート業務効率化を図る。

**詳細要件**
- FAQ・ナレッジベース
- チャットボット対応
- オンライン見積依頼
- サポート依頼・進捗確認

#### 2.5 カスタマーサポート

##### 機能ID: CRM-012 - サポートチケット管理
**優先度**: Should Have (Phase 2)

**機能概要**
顧客からの問い合わせを効率的に管理・解決する。

**詳細要件**
- チケット自動振り分け
- 優先度・緊急度管理
- エスカレーション機能
- SLA管理・監視
- 解決状況トラッキング

##### 機能ID: CRM-013 - ナレッジ管理
**優先度**: Should Have (Phase 2)

**機能概要**
サポート品質向上と効率化のためのナレッジを蓄積・活用する。

**詳細要件**
- FAQ管理・検索機能
- 解決事例データベース
- ナレッジ評価・フィードバック
- 自動提案機能

#### 2.6 顧客分析・レポーティング

##### 機能ID: CRM-014 - 顧客分析
**優先度**: Should Have (Phase 2)

**機能概要**
顧客データを分析し、ビジネス戦略の意思決定を支援する。

**詳細要件**
- 顧客ライフタイムバリュー（CLV）分析
- 顧客離反予測・防止策提案
- クロスセル・アップセル機会分析
- 顧客満足度分析

##### 機能ID: CRM-015 - CRMレポート
**優先度**: Should Have (Phase 2)

**機能概要**
CRM活動の成果を可視化し、改善点を特定する。

**詳細要件**
- 営業活動レポート
- マーケティング効果レポート
- 顧客分析レポート
- KPIダッシュボード

---

### 3. データモデル

#### 3.1 主要エンティティ

```sql
-- 顧客マスター
CREATE TABLE crm_customers (
    customer_id VARCHAR(20) PRIMARY KEY,
    customer_name VARCHAR(200) NOT NULL,
    customer_type ENUM('法人','個人') NOT NULL,
    industry_code VARCHAR(10) NOT NULL,
    company_size ENUM('大企業','中小企業','個人事業') NOT NULL,
    annual_revenue DECIMAL(15,0),
    employee_count INTEGER,
    established_date DATE,
    listing_status ENUM('上場','非上場'),
    sales_rep_id VARCHAR(20) NOT NULL,
    customer_rank ENUM('A','B','C','D') NOT NULL,
    status ENUM('見込','既存','休眠','失注') DEFAULT '見込',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sales_rep_id) REFERENCES employees(employee_id)
);

-- 連絡先マスター
CREATE TABLE crm_contacts (
    contact_id VARCHAR(20) PRIMARY KEY,
    customer_id VARCHAR(20) NOT NULL,
    contact_name VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    position VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    is_primary BOOLEAN DEFAULT FALSE,
    is_decision_maker BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES crm_customers(customer_id)
);

-- リードマスター
CREATE TABLE crm_leads (
    lead_id VARCHAR(20) PRIMARY KEY,
    company_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    position VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100) NOT NULL,
    lead_source ENUM('Web','展示会','紹介','広告') NOT NULL,
    interest_area TEXT,
    lead_score INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
    status ENUM('新規','接触中','見込','失注') DEFAULT '新規',
    assigned_to VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES employees(employee_id)
);

-- 商談マスター
CREATE TABLE crm_opportunities (
    opportunity_id VARCHAR(20) PRIMARY KEY,
    opportunity_name VARCHAR(200) NOT NULL,
    customer_id VARCHAR(20) NOT NULL,
    sales_rep_id VARCHAR(20) NOT NULL,
    stage ENUM('初回','提案','見積','検討','最終','受注','失注') NOT NULL,
    probability INTEGER CHECK (probability BETWEEN 0 AND 100),
    expected_amount DECIMAL(15,0) NOT NULL,
    expected_close_date DATE NOT NULL,
    competitor_info TEXT,
    loss_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES crm_customers(customer_id),
    FOREIGN KEY (sales_rep_id) REFERENCES employees(employee_id)
);

-- 活動履歴
CREATE TABLE crm_activities (
    activity_id VARCHAR(20) PRIMARY KEY,
    customer_id VARCHAR(20),
    opportunity_id VARCHAR(20),
    activity_type ENUM('電話','メール','訪問','展示会','セミナー') NOT NULL,
    subject VARCHAR(200) NOT NULL,
    description TEXT,
    activity_date TIMESTAMP NOT NULL,
    duration_minutes INTEGER,
    created_by VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES crm_customers(customer_id),
    FOREIGN KEY (opportunity_id) REFERENCES crm_opportunities(opportunity_id),
    FOREIGN KEY (created_by) REFERENCES employees(employee_id)
);

-- キャンペーンマスター
CREATE TABLE crm_campaigns (
    campaign_id VARCHAR(20) PRIMARY KEY,
    campaign_name VARCHAR(200) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    budget DECIMAL(12,0) NOT NULL,
    channel ENUM('メール','Web','SNS','DM','イベント') NOT NULL,
    target_count INTEGER DEFAULT 0,
    response_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    response_rate DECIMAL(5,2) AS (response_count / target_count * 100),
    conversion_rate DECIMAL(5,2) AS (conversion_count / response_count * 100),
    roi DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3.2 データ関係図
- 顧客（1）対（多）連絡先
- 顧客（1）対（多）商談
- 商談（1）対（多）活動履歴
- リード（1）対（0-1）顧客（変換後）
- キャンペーン（多）対（多）リード
- キャンペーン（多）対（多）顧客

---

### 4. 画面・UI要件

#### 4.1 主要画面一覧
| 画面ID | 画面名 | 説明 | 対象ユーザー |
|--------|--------|------|-------------|
| CRM-S001 | CRMダッシュボード | 営業・マーケティング状況俯瞰 | 全ユーザー |
| CRM-S002 | 顧客情報画面 | 顧客詳細・360度ビュー | 営業担当者 |
| CRM-S003 | リード管理画面 | リード一覧・詳細管理 | 営業担当者 |
| CRM-S004 | 商談管理画面 | 商談進捗・予測管理 | 営業担当者 |
| CRM-S005 | キャンペーン管理画面 | キャンペーン企画・実行・分析 | マーケティング担当者 |
| CRM-S006 | カスタマーポータル | 顧客セルフサービス | 顧客 |
| CRM-S007 | 分析・レポート画面 | CRM分析・レポーティング | 管理者 |

#### 4.2 ダッシュボード要件
- **営業指標**: 商談件数、受注予測、売上パイプライン、成約率
- **マーケティング指標**: リード獲得数、コンバージョン率、キャンペーンROI
- **顧客指標**: 新規顧客数、既存顧客売上、顧客満足度、離反率
- **活動指標**: 営業活動件数、フォローアップ予定、未対応リード数

---

### 5. API仕様

#### 5.1 主要APIエンドポイント

```yaml
Customer API:
  GET /api/v1/crm/customers:
    description: 顧客一覧取得
    parameters:
      - customer_type: string (optional)
      - industry: string (optional)
      - status: string (optional)
      - sales_rep_id: string (optional)
    response: Customer[]

  GET /api/v1/crm/customers/{id}:
    description: 顧客詳細取得（360度ビュー）
    response: CustomerDetail

  POST /api/v1/crm/customers:
    description: 顧客作成
    body: CustomerCreateRequest
    response: Customer

Lead API:
  GET /api/v1/crm/leads:
    description: リード一覧取得
    parameters:
      - status: string (optional)
      - lead_source: string (optional)
      - assigned_to: string (optional)
    response: Lead[]

  POST /api/v1/crm/leads:
    description: リード作成
    body: LeadCreateRequest
    response: Lead

  PUT /api/v1/crm/leads/{id}/convert:
    description: リードを顧客に変換
    response: Customer

Opportunity API:
  GET /api/v1/crm/opportunities:
    description: 商談一覧取得
    parameters:
      - stage: string (optional)
      - sales_rep_id: string (optional)
      - expected_close_date_from: date (optional)
      - expected_close_date_to: date (optional)
    response: Opportunity[]

  POST /api/v1/crm/opportunities:
    description: 商談作成
    body: OpportunityCreateRequest
    response: Opportunity

  PUT /api/v1/crm/opportunities/{id}/stage:
    description: 商談ステージ更新
    body: StageUpdateRequest
    response: Opportunity

Activity API:
  GET /api/v1/crm/activities:
    description: 活動履歴取得
    parameters:
      - customer_id: string (optional)
      - opportunity_id: string (optional)
      - activity_type: string (optional)
      - date_from: date (optional)
      - date_to: date (optional)
    response: Activity[]

  POST /api/v1/crm/activities:
    description: 活動記録作成
    body: ActivityCreateRequest
    response: Activity

Campaign API:
  GET /api/v1/crm/campaigns:
    description: キャンペーン一覧取得
    response: Campaign[]

  POST /api/v1/crm/campaigns:
    description: キャンペーン作成
    body: CampaignCreateRequest
    response: Campaign

  GET /api/v1/crm/campaigns/{id}/analytics:
    description: キャンペーン分析データ取得
    response: CampaignAnalytics

Portal API:
  GET /api/v1/crm/portal/customer-info:
    description: 顧客ポータル情報取得（認証済み顧客）
    response: CustomerPortalInfo

  PUT /api/v1/crm/portal/customer-info:
    description: 顧客情報更新（顧客自身）
    body: CustomerUpdateRequest
    response: CustomerPortalInfo
```

---

### 6. 他モジュール連携

#### 6.1 連携モジュール
| 連携先 | 連携内容 | 連携方式 | 頻度 |
|--------|----------|----------|------|
| 販売管理（Sales） | 顧客情報・商談・見積・受注 | API | リアルタイム |
| 財務管理（FI） | 売上・請求・入金情報 | API | 日次 |
| プロジェクト管理（PM） | 受注プロジェクト・顧客満足度 | API | リアルタイム |
| 人事管理（HR） | 営業担当者情報 | API | 日次 |

#### 6.2 外部システム連携
| システム | 連携内容 | プロトコル | 認証方式 |
|----------|----------|------------|----------|
| メール配信システム | メールマーケティング | REST API | API Key |
| SFA/MA | 営業・マーケティング活動 | REST API | OAuth2.0 |
| SNS | ソーシャルメディア連携 | API | OAuth |
| Web解析ツール | Webサイト行動データ | JavaScript | API Key |
| 名刺管理システム | 名刺情報・OCR | REST API | API Key |

---

### 7. 実装優先度

#### 7.1 Phase 2（7-12ヶ月）
- **Must Have**
  - CRM-001: 統合顧客データベース
  - CRM-002: 連絡先管理
  - CRM-004: リード管理
  - CRM-005: 商談管理
  - CRM-006: 営業活動管理
  - CRM-007: キャンペーン管理
  - CRM-008: メールマーケティング
  - CRM-010: 顧客専用ポータル
  - CRM-011: セルフサービス機能

#### 7.2 Phase 3（13-18ヶ月）
- **Should Have**
  - CRM-003: 顧客セグメンテーション
  - CRM-009: デジタルマーケティング連携
  - CRM-012: サポートチケット管理
  - CRM-013: ナレッジ管理
  - CRM-014: 顧客分析
  - CRM-015: CRMレポート
  - AI活用の顧客行動予測
  - 高度なマーケティングオートメーション

---

### 8. 非機能要件

#### 8.1 パフォーマンス要件
- 顧客検索：10万件から1秒以内
- 360度顧客ビュー表示：3秒以内
- 商談リスト表示：2秒以内
- キャンペーン配信：10万件を30分以内
- レポート生成：大量データで10秒以内

#### 8.2 可用性要件
- システム稼働率：99.9%
- 計画停止：月1回2時間以内
- バックアップ：日次フル、リアルタイム同期

#### 8.3 セキュリティ要件
- 顧客情報暗号化（AES-256）
- アクセス制御（営業担当者は自分の顧客のみ）
- API アクセス制御・レート制限
- 操作ログ完全記録

#### 8.4 ユーザビリティ要件
- 直感的なUI/UX設計
- モバイル対応（営業外出先からの利用）
- 多言語対応（日本語・英語）
- アクセシビリティ対応

---

### 9. 移行要件

#### 9.1 データ移行
- 既存顧客データ（顧客情報・連絡先）
- 営業履歴データ（過去2年分）
- 商談データ（進行中・完了分）
- キャンペーン実績データ
- 顧客分類・セグメント設定

#### 9.2 システム移行
- 段階的移行（部門別・営業担当者別）
- データ品質向上・クレンジング
- ユーザートレーニング・サポート
- 3ヶ月並行稼働期間

---

### 10. テスト要件

#### 10.1 機能テスト
- 顧客情報管理フロー
- リード変換・商談進捗
- キャンペーン配信・効果測定
- ポータル機能・セキュリティ

#### 10.2 性能テスト
- 大量データ処理（顧客10万件、活動1000万件）
- 同時接続テスト（200ユーザー）
- メール配信性能テスト

#### 10.3 セキュリティテスト
- 個人情報保護対応
- 不正アクセス検知
- データ暗号化検証

---

### 11. 用語定義

| 用語 | 定義 |
|------|------|
| リード | 見込み顧客・潜在的な営業機会 |
| 商談 | 具体的な営業案件・取引機会 |
| コンバージョン | リードから顧客への変換、目標達成 |
| セグメンテーション | 顧客をグループ分けし、特性別に管理 |
| CLV | Customer Lifetime Value - 顧客生涯価値 |
| RFM分析 | Recency/Frequency/Monetary による顧客分析 |
| SLA | Service Level Agreement - サービス品質保証 |
| チャーン | 顧客離反率 |

---

*本仕様書は、CRMモジュールの詳細要求仕様書です。Phase 2実装を前提とし、販売管理モジュールとの連携を重視した仕様となっています。*