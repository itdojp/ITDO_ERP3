# プロジェクト管理モジュール（PM）詳細仕様書
## Project Management Module Specification

### 1. モジュール概要

#### 1.1 目的
プロジェクトのライフサイクル全体を統合管理し、リソースの最適化、進捗の可視化、品質の確保を実現する。ウォーターフォール開発手法とアジャイル開発手法の両方に対応し、組織のプロジェクト管理成熟度向上を支援する。

#### 1.2 適用範囲
- システム開発プロジェクト
- 業務改善プロジェクト  
- 新製品開発プロジェクト
- インフラ構築プロジェクト
- コンサルティングプロジェクト

#### 1.3 対象ユーザー
- プロジェクトマネージャー（PM）
- プロジェクトメンバー
- プロジェクトオーナー
- PMO（Project Management Office）
- 経営層・部門長

---

### 2. 機能要件

#### 2.1 プロジェクト基本管理

##### 機能ID: PM-001 - プロジェクト登録・設定
**優先度**: MVP必須

**機能概要**
プロジェクトの基本情報を登録・管理し、プロジェクトの全体像を把握する。

**詳細要件**
- プロジェクト基本情報（名称、期間、予算、目的、種別）
- プロジェクト階層構造（親子関係、最大5階層）
- ステータス管理（計画中/実行中/保留/完了/中止）
- テンプレート機能（業種別・規模別標準テンプレート）

**入力項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| プロジェクトコード | ○ | VARCHAR | 20 | 自動生成可 |
| プロジェクト名 | ○ | VARCHAR | 100 | |
| 説明 | △ | TEXT | 1000 | |
| 開始日 | ○ | DATE | - | |
| 終了日 | ○ | DATE | - | |
| プロジェクトマネージャー | ○ | FK | - | 従業員マスター連携 |
| 予算 | ○ | DECIMAL | 15,2 | 円 |
| 優先度 | ○ | ENUM | - | 高/中/低/緊急 |
| プロジェクト種別 | ○ | VARCHAR | 20 | 開発/保守/改善/その他 |

##### 機能ID: PM-002 - プロジェクトチーム管理
**優先度**: MVP必須

**機能概要**
プロジェクトチームのメンバー構成、役割、権限を管理する。

**詳細要件**
- チームメンバーの登録と役割設定
- スキルベースアサイン
- 外部リソース（協力会社、派遣）管理
- アクセス権限設定（プロジェクト単位）

#### 2.2 WBS（Work Breakdown Structure）管理

##### 機能ID: PM-003 - WBS作成・管理
**優先度**: MVP必須

**機能概要**
プロジェクトの作業を階層的に分解し、管理可能な単位に細分化する。

**詳細要件**
- 最大10階層のタスク構造
- タスク詳細情報（名称、説明、成果物、完了条件）
- 作業量見積（工数・期間・コスト）
- タスク依存関係（FS/SS/FF/SF）
- マイルストーン設定

**入力項目**
| 項目名 | 必須 | データ型 | 桁数 | 備考 |
|--------|------|----------|------|------|
| タスクID | ○ | VARCHAR | 20 | 自動生成 |
| タスク名 | ○ | VARCHAR | 200 | |
| 説明 | △ | TEXT | 1000 | |
| 見積工数 | ○ | DECIMAL | 10,2 | 人日 |
| 担当者 | ○ | FK | - | 複数選択可 |
| 開始日 | ○ | DATE | - | |
| 終了日 | ○ | DATE | - | |
| 進捗率 | - | INTEGER | 3 | 0-100% |
| 成果物 | △ | VARCHAR | 500 | |

##### 機能ID: PM-004 - タスク依存関係設定
**優先度**: MVP必須

**機能概要**
タスク間の依存関係を定義し、スケジュールの制約を明確化する。

**詳細要件**
- 4種類の依存関係（FS/SS/FF/SF）
- リードタイム・ラグタイムの設定
- 循環依存の検出・警告
- クリティカルパス自動計算

#### 2.3 スケジュール管理

##### 機能ID: PM-005 - ガントチャート
**優先度**: MVP必須

**機能概要**
プロジェクトスケジュールを視覚的に表示・編集する。

**詳細要件**
- インタラクティブなガントチャート表示
- ドラッグ&ドロップによる日程変更
- 時間軸調整（日/週/月表示）
- 進捗率の視覚的表示
- 今日線・基準線表示
- 印刷・エクスポート機能

##### 機能ID: PM-006 - クリティカルパス分析
**優先度**: Should Have

**機能概要**
プロジェクトの最長経路を特定し、スケジュール管理の重点を明確化する。

**詳細要件**
- CPM（Critical Path Method）自動計算
- クリティカルタスクの強調表示
- フロート（余裕時間）計算
- What-if分析機能

#### 2.4 リソース管理

##### 機能ID: PM-007 - リソース管理
**優先度**: MVP必須

**機能概要**
プロジェクトで使用するリソースを管理し、効率的な配分を実現する。

**詳細要件**
- リソースプール管理（人的・設備・消耗品）
- スキルマトリックス管理
- 稼働率可視化
- リソース競合検出・解決
- 負荷平準化

**データ項目**
| 項目名 | データ型 | 桁数 | 備考 |
|--------|----------|------|------|
| リソースID | VARCHAR | 20 | |
| リソース名 | VARCHAR | 100 | |
| リソース種別 | ENUM | - | 人的/設備/消耗品 |
| 時間単価 | DECIMAL | 8,0 | 円/時間 |
| 可用性 | INTEGER | 3 | % |
| スキル | JSON | - | スキル配列 |

#### 2.5 アジャイル対応

##### 機能ID: PM-008 - スクラム管理
**優先度**: Should Have

**機能概要**
スクラム手法に基づくタスク管理をサポートする。

**詳細要件**
- スクラムボード（バックログ/To Do/進行中/完了）
- スプリント管理（計画・実行・振り返り）
- ベロシティ追跡
- バーンダウンチャート

##### 機能ID: PM-009 - カンバン管理
**優先度**: Should Have

**機能概要**
カンバン手法による継続的な改善を支援する。

**詳細要件**
- カンバンボード
- WIP制限設定・監視
- サイクルタイム測定
- 累積フロー図

#### 2.6 進捗・実績管理

##### 機能ID: PM-010 - 進捗管理
**優先度**: MVP必須

**機能概要**
プロジェクトの進捗状況をリアルタイムで追跡・管理する。

**詳細要件**
- 進捗率入力（タスク単位）
- 工数実績入力
- 成果物登録・管理
- 進捗レビュー機能
- 遅延アラート

##### 機能ID: PM-011 - EVM分析
**優先度**: Should Have

**機能概要**
獲得価値法によりプロジェクトの進捗とコストを統合管理する。

**詳細要件**
- PV/EV/AC自動計算
- SPI/CPI効率指数算出
- ETC/EAC完了予測
- EVMグラフ表示

#### 2.7 リスク・課題管理

##### 機能ID: PM-012 - リスク管理
**優先度**: Should Have

**機能概要**
プロジェクトリスクを識別・評価・対応する。

**詳細要件**
- リスク登録・分類
- 影響度×発生確率マトリックス評価
- 対応策策定（回避/軽減/転嫁/受容）
- リスクモニタリング

##### 機能ID: PM-013 - 課題管理
**優先度**: MVP必須

**機能概要**
プロジェクト課題を管理し、解決を促進する。

**詳細要件**
- 課題登録・分類
- 担当者割当・期限設定
- エスカレーションルール
- 解決状況追跡

---

### 3. データモデル

#### 3.1 主要エンティティ

```sql
-- プロジェクトマスター
CREATE TABLE projects (
    project_id VARCHAR(20) PRIMARY KEY,
    project_name VARCHAR(100) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    project_manager_id VARCHAR(20) NOT NULL,
    budget DECIMAL(15,2),
    priority ENUM('高','中','低','緊急') NOT NULL,
    status ENUM('計画中','実行中','保留','完了','中止') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- タスクマスター
CREATE TABLE tasks (
    task_id VARCHAR(20) PRIMARY KEY,
    project_id VARCHAR(20) NOT NULL,
    parent_task_id VARCHAR(20),
    task_name VARCHAR(200) NOT NULL,
    description TEXT,
    estimated_hours DECIMAL(10,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    progress_rate INTEGER DEFAULT 0 CHECK (progress_rate BETWEEN 0 AND 100),
    deliverable VARCHAR(500),
    FOREIGN KEY (project_id) REFERENCES projects(project_id),
    FOREIGN KEY (parent_task_id) REFERENCES tasks(task_id)
);

-- タスク依存関係
CREATE TABLE task_dependencies (
    dependency_id VARCHAR(20) PRIMARY KEY,
    predecessor_task_id VARCHAR(20) NOT NULL,
    successor_task_id VARCHAR(20) NOT NULL,
    dependency_type ENUM('FS','SS','FF','SF') NOT NULL,
    lag_days INTEGER DEFAULT 0,
    FOREIGN KEY (predecessor_task_id) REFERENCES tasks(task_id),
    FOREIGN KEY (successor_task_id) REFERENCES tasks(task_id)
);
```

#### 3.2 データ関係図
- プロジェクト（1）対（多）タスク
- タスク（多）対（多）タスク（依存関係）
- プロジェクト（多）対（多）リソース（アサイン）
- タスク（多）対（多）リソース（アサイン）

---

### 4. 画面・UI要件

#### 4.1 主要画面一覧
| 画面ID | 画面名 | 説明 | 対象ユーザー |
|--------|--------|------|-------------|
| PM-S001 | プロジェクトダッシュボード | 全体状況俯瞰 | 全ユーザー |
| PM-S002 | ガントチャート | スケジュール管理 | PM、リーダー |
| PM-S003 | リソースビュー | リソース管理 | PM、PMO |
| PM-S004 | カンバンボード | アジャイル管理 | 開発チーム |
| PM-S005 | 進捗入力画面 | 実績報告 | メンバー |

#### 4.2 ダッシュボード要件
- プロジェクト進捗サマリー（全体進捗率、遅延タスク数）
- コスト状況（予算消化率、EVM指標）
- リソース稼働状況（稼働率、空き状況）
- リスク・課題サマリー（高リスク件数、未解決課題数）
- マイルストーンスケジュール

---

### 5. API仕様

#### 5.1 REST API設計原則
- RESTful設計に準拠
- JSON形式でのデータ交換
- HTTP標準ステータスコード使用
- OAuth 2.0 + JWT認証

#### 5.2 主要APIエンドポイント

```yaml
Projects API:
  GET /api/v1/projects:
    description: プロジェクト一覧取得
    parameters:
      - status: string (optional)
      - manager_id: string (optional)
    response: Project[]

  POST /api/v1/projects:
    description: プロジェクト作成
    body: ProjectCreateRequest
    response: Project

  GET /api/v1/projects/{project_id}:
    description: プロジェクト詳細取得
    response: ProjectDetail

Tasks API:
  GET /api/v1/projects/{project_id}/tasks:
    description: タスク一覧取得
    response: Task[]

  POST /api/v1/projects/{project_id}/tasks:
    description: タスク作成
    body: TaskCreateRequest
    response: Task

  PUT /api/v1/tasks/{task_id}/progress:
    description: 進捗更新
    body: ProgressUpdateRequest
    response: Task
```

---

### 6. 他モジュール連携

#### 6.1 連携モジュール
| 連携先 | 連携内容 | 連携方式 | 頻度 |
|--------|----------|----------|------|
| 財務管理（FI） | プロジェクト予算・実績 | API | リアルタイム |
| 人事管理（HR） | リソース情報・スキル | API | 日次 |
| 販売管理（Sales） | 受注プロジェクト情報 | API | リアルタイム |
| 契約管理（Contract） | 契約情報・条件 | API | リアルタイム |

#### 6.2 外部システム連携
| システム | 連携内容 | プロトコル |
|----------|----------|------------|
| Microsoft Project | プロジェクトファイル | File Import/Export |
| JIRA | アジャイルタスク | REST API |
| Slack/Teams | 通知・コラボレーション | Webhook/API |

---

### 7. 実装優先度

#### 7.1 MVP（Phase 1: 0-6ヶ月）
- **Must Have**
  - PM-001: プロジェクト登録・設定
  - PM-002: プロジェクトチーム管理  
  - PM-003: WBS作成・管理
  - PM-004: タスク依存関係設定
  - PM-005: ガントチャート
  - PM-007: リソース管理
  - PM-010: 進捗管理
  - PM-013: 課題管理

#### 7.2 Phase 2（7-12ヶ月）
- **Should Have**
  - PM-006: クリティカルパス分析
  - PM-008: スクラム管理
  - PM-009: カンバン管理
  - PM-011: EVM分析
  - PM-012: リスク管理

#### 7.3 Phase 3（13-18ヶ月）
- **Could Have**
  - 高度な分析機能
  - AI/MLによる予測機能
  - 外部システム高度連携

---

### 8. 非機能要件

#### 8.1 パフォーマンス要件
- ガントチャート表示：1000タスクを3秒以内
- プロジェクト検索：10万件から1秒以内  
- ダッシュボード更新：5秒以内
- 同時編集ユーザー：50人/プロジェクト

#### 8.2 可用性要件
- システム稼働率：99.9%
- 計画停止：月1回4時間以内
- バックアップ：日次増分、週次フル

#### 8.3 セキュリティ要件
- プロジェクト単位のアクセス制御
- タスクレベルの権限設定
- 変更履歴の完全記録
- 機密プロジェクトの暗号化

#### 8.4 ユーザビリティ要件
- 直感的な操作性
- マルチデバイス対応
- 多言語対応（日本語・英語）
- アクセシビリティ対応

---

### 9. 移行要件

#### 9.1 データ移行
- 既存Project-Openのプロジェクトデータ
- 進行中プロジェクトの完全移行
- 過去プロジェクトの参照データ移行
- ドキュメント・成果物の移行

#### 9.2 並行稼働
- 新規プロジェクトから段階適用
- 3ヶ月間の並行稼働期間
- データ同期バッチの実行

---

### 10. 用語定義

| 用語 | 定義 |
|------|------|
| WBS | Work Breakdown Structure - 作業分解構造 |
| EVM | Earned Value Management - アーンドバリュー管理 |
| PV | Planned Value - 計画価値 |
| EV | Earned Value - 獲得価値 |
| AC | Actual Cost - 実績コスト |
| SPI | Schedule Performance Index - スケジュール効率指数 |
| CPI | Cost Performance Index - コスト効率指数 |
| クリティカルパス | プロジェクト全体の期間を決定する一連のタスク |
| マイルストーン | プロジェクトの重要な節目 |

---

*本仕様書は、プロジェクト管理モジュールの詳細要求仕様書です。実装時は関連するモジュール仕様書との整合性を確保してください。*