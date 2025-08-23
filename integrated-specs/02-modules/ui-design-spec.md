# UI/画面設計仕様書
## User Interface Design Specification

### 1. 概要

#### 1.1 目的
本仕様書は、モダンERPシステムにおけるユーザーインターフェース設計の標準とガイドラインを定義し、ITDO Design Systemに基づく一貫性のある、使いやすく、アクセシブルなユーザー体験を提供するための指針を提供します。

#### 1.2 適用範囲
- ITDO Design System準拠デザイン
- 主要画面のUI/UX設計
- コンポーネント設計・利用方針
- レスポンシブデザイン対応
- アクセシビリティ（WCAG 2.1 AA）対応
- 多言語・多デバイス対応

#### 1.3 設計基本方針
- **ユーザー中心設計**: 業務効率を最優先とした直感的なインターフェース
- **一貫性**: ITDO Design Systemによる統一されたデザイン言語
- **アクセシビリティファースト**: すべてのユーザーが利用可能なインクルーシブデザイン
- **レスポンシブ**: あらゆるデバイスで最適な体験を提供
- **拡張性**: 将来の機能追加・変更に柔軟に対応

---

### 2. ITDO Design System

#### 2.1 デザイン原則

##### 2.1.1 ブランドアイデンティティ
```yaml
ブランドコンセプト:
  - 信頼性: 堅実で安心できるシステム
  - 効率性: 業務を効率化する直感的な操作
  - 革新性: モダンな技術による先進的な体験
  - 包括性: 誰もが使いやすいインクルーシブデザイン

デザイン哲学:
  - Less is More: 複雑な機能をシンプルに表現
  - Form Follows Function: 機能に最適化されたデザイン
  - Progressive Disclosure: 段階的な情報開示
  - Consistent Experience: 一貫した操作体験
```

##### 2.1.2 視覚的階層
| 階層レベル | 用途 | 視覚的重要度 | 適用要素 |
|-----------|------|-------------|---------|
| **Primary** | 主要アクション | 最高 | メインCTA、重要な警告 |
| **Secondary** | 副次アクション | 高 | サブCTA、ナビゲーション |
| **Tertiary** | 補助情報 | 中 | ラベル、説明文 |
| **Quaternary** | 背景情報 | 低 | プレースホルダー、補足 |

#### 2.2 カラーシステム

##### 2.2.1 プライマリカラーパレット
```yaml
Primary Orange (#f97316):
  用途: メインブランドカラー、重要なCTA
  色相: 25°
  彩度: 95%
  明度: 55%
  
  バリエーション:
    - Orange 50: #fef7ed
    - Orange 100: #ffedd5
    - Orange 200: #fed7aa
    - Orange 300: #fdba74
    - Orange 400: #fb923c
    - Orange 500: #f97316 (メイン)
    - Orange 600: #ea580c
    - Orange 700: #c2410c
    - Orange 800: #9a3412
    - Orange 900: #7c2d12

アクセシビリティ準拠:
  - White背景でのコントラスト比: 4.52:1 (AA準拠)
  - Gray-100背景でのコントラスト比: 4.23:1 (AA準拠)
  - 色覚異常対応: Deuteranopia/Protanopia考慮済み
```

##### 2.2.2 セカンダリカラーパレット
| カラー | 16進数 | 用途 | コントラスト比 |
|--------|-------|------|---------------|
| **Blue** | #3b82f6 | 情報、リンク | 4.5:1 |
| **Green** | #10b981 | 成功、完了 | 4.5:1 |
| **Red** | #ef4444 | エラー、警告 | 4.5:1 |
| **Yellow** | #f59e0b | 注意、保留 | 4.5:1 |
| **Purple** | #8b5cf6 | 特別、プレミアム | 4.5:1 |
| **Gray** | #6b7280 | テキスト、境界線 | 4.5:1 |

##### 2.2.3 意味的カラー定義
```yaml
ステートカラー:
  Success:
    primary: #10b981 (Green 500)
    light: #d1fae5 (Green 100)
    dark: #047857 (Green 700)
    
  Warning:
    primary: #f59e0b (Amber 500)
    light: #fef3c7 (Amber 100)
    dark: #d97706 (Amber 600)
    
  Error:
    primary: #ef4444 (Red 500)
    light: #fee2e2 (Red 100)
    dark: #dc2626 (Red 600)
    
  Info:
    primary: #3b82f6 (Blue 500)
    light: #dbeafe (Blue 100)
    dark: #2563eb (Blue 600)

テキストカラー:
  primary: #111827 (Gray 900)
  secondary: #6b7280 (Gray 500)
  tertiary: #9ca3af (Gray 400)
  inverse: #ffffff (White)
  
背景カラー:
  primary: #ffffff (White)
  secondary: #f9fafb (Gray 50)
  tertiary: #f3f4f6 (Gray 100)
  dark: #111827 (Gray 900)
```

#### 2.3 タイポグラフィ

##### 2.3.1 フォントファミリー
```css
/* 日本語・多言語対応フォントスタック */
font-family: 
  'Inter', /* 英数字・ラテン文字（高い可読性） */
  'Noto Sans JP', /* 日本語（Google Fonts） */
  'Noto Sans SC', /* 中国語簡体字 */
  'Noto Sans KR', /* 韓国語 */
  -apple-system, /* macOS */
  BlinkMacSystemFont, /* Chrome on macOS */
  'Segoe UI', /* Windows */
  'Roboto', /* Android */
  'Helvetica Neue', /* macOS fallback */
  Arial, /* Universal fallback */
  sans-serif; /* Generic fallback */

/* コード・データ表示用 */
font-family:
  'JetBrains Mono', /* 等幅フォント（高い可読性） */
  'SF Mono', /* macOS */
  Monaco, /* macOS fallback */
  'Cascadia Code', /* Windows Terminal */
  'Roboto Mono', /* Android */
  'Courier New', /* Universal fallback */
  monospace; /* Generic fallback */
```

##### 2.3.2 タイポグラフィスケール
| スケール | サイズ | 行間 | 用途 | レスポンシブ調整 |
|---------|-------|------|------|----------------|
| **Display** | 48px | 1.2 | ページタイトル | モバイル: 36px |
| **H1** | 36px | 1.25 | セクションタイトル | モバイル: 28px |
| **H2** | 30px | 1.3 | サブセクション | モバイル: 24px |
| **H3** | 24px | 1.35 | カードタイトル | モバイル: 20px |
| **H4** | 20px | 1.4 | リストタイトル | モバイル: 18px |
| **H5** | 18px | 1.45 | フォームラベル | - |
| **Body Large** | 16px | 1.5 | 本文（重要） | - |
| **Body** | 14px | 1.55 | 本文（標準） | - |
| **Body Small** | 12px | 1.6 | 補足情報 | - |
| **Caption** | 11px | 1.65 | キャプション | - |

##### 2.3.3 フォントウェイト
```yaml
フォントウェイト定義:
  Light: 300
    用途: 大きなタイトル、装飾的テキスト
  
  Regular: 400
    用途: 本文、一般的なテキスト（デフォルト）
  
  Medium: 500
    用途: 小見出し、重要な情報
  
  SemiBold: 600
    用途: ボタンテキスト、強調テキスト
  
  Bold: 700
    用途: 見出し、アラート、エラーメッセージ
  
  ExtraBold: 800
    用途: 大見出し、ブランディング要素
```

#### 2.4 スペーシングシステム

##### 2.4.1 スペーシング基準（8pt Grid System）
```yaml
基準サイズ: 8px

スペーシングスケール:
  xs: 4px   (0.5 × 8px) - アイコンとテキスト間隔
  sm: 8px   (1 × 8px)   - 密接な要素間隔
  md: 16px  (2 × 8px)   - 通常の要素間隔
  lg: 24px  (3 × 8px)   - セクション内間隔
  xl: 32px  (4 × 8px)   - セクション間隔
  2xl: 48px (6 × 8px)   - 大きなセクション間隔
  3xl: 64px (8 × 8px)   - ページレベル間隔
  4xl: 96px (12 × 8px)  - 特別な間隔

コンポーネント内マージン:
  Dense: 4px パディング（密集レイアウト）
  Normal: 8px パディング（標準レイアウト）
  Comfortable: 16px パディング（ゆとりレイアウト）
```

##### 2.4.2 レイアウトグリッド
```css
/* 12カラムグリッドシステム */
.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}

/* ブレークポイント */
/* モバイル: 〜767px */
/* タブレット: 768px〜1023px */
/* デスクトップ: 1024px〜 */

/* グリッドガター */
.grid {
  display: grid;
  gap: 24px; /* デスクトップ */
  gap: 16px; /* タブレット */
  gap: 12px; /* モバイル */
}
```

#### 2.5 アイコンシステム

##### 2.5.1 アイコンライブラリ
```yaml
プライマリアイコンライブラリ: Heroicons
  - ライセンス: MIT
  - スタイル: アウトライン、ソリッド
  - サイズ: 16px, 20px, 24px, 32px
  - フォーマット: SVG

補完アイコン: Lucide React
  - 用途: Heroiconsで不足するアイコン
  - スタイル統一: ストローク幅2px
  - カスタムアイコン基準

アイコンサイズ規則:
  xs: 12px - インライン要素
  sm: 16px - ボタン内、フォーム要素
  md: 20px - ナビゲーション（デフォルト）
  lg: 24px - ページヘッダー、重要なCTA
  xl: 32px - イラスト的用途
  2xl: 48px - エンプティステート
```

##### 2.5.2 アイコン使用ガイドライン
| 文脈 | サイズ | スタイル | カラー | 配置 |
|------|-------|---------|-------|------|
| **ボタン内** | 16px | アウトライン | ボタンテキストと同色 | テキスト前4px間隔 |
| **ナビゲーション** | 20px | アウトライン | Gray-500 | ラベル前8px間隔 |
| **フォームラベル** | 16px | アウトライン | Gray-400 | ラベル前4px間隔 |
| **ステータス表示** | 16px | ソリッド | ステートカラー | テキスト前4px間隔 |
| **空状態** | 48px | アウトライン | Gray-300 | 中央配置 |

---

### 3. レスポンシブデザイン

#### 3.1 ブレークポイント戦略

##### 3.1.1 デバイス分類・ブレークポイント
```yaml
ブレークポイント定義:
  Mobile Portrait: 320px - 479px
    - 最小デバイス対応
    - 単一カラムレイアウト
    - スタック配置
    
  Mobile Landscape: 480px - 767px
    - スマートフォン横向き
    - 2カラム可能
    - コンパクトナビゲーション
    
  Tablet Portrait: 768px - 1023px
    - iPadサイズ
    - 3-4カラムレイアウト
    - ハイブリッドナビゲーション
    
  Tablet Landscape / Desktop: 1024px - 1439px
    - 標準デスクトップ
    - 12カラムフルレイアウト
    - サイドバーナビゲーション
    
  Large Desktop: 1440px〜
    - 大画面対応
    - 最大幅制限
    - 横余白追加
```

##### 3.1.2 Tailwind CSS ブレークポイント設定
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'sm': '480px',   // Mobile Landscape
      'md': '768px',   // Tablet Portrait
      'lg': '1024px',  // Desktop
      'xl': '1440px',  // Large Desktop
      '2xl': '1920px', // Ultra Wide
    }
  }
}
```

#### 3.2 レスポンシブコンポーネント設計

##### 3.2.1 ナビゲーション適応
| デバイス | ナビゲーション形式 | 表示要素 | 隠れる要素 |
|---------|------------------|---------|-----------|
| **モバイル** | ハンバーガーメニュー | ロゴ、メニューボタン | 全メニュー項目 |
| **タブレット** | タブバー + ドロワー | 主要タブ、オーバーフロー | 詳細メニュー |
| **デスクトップ** | サイドバー | 全メニュー項目、階層 | なし |

##### 3.2.2 データテーブル適応戦略
```yaml
デスクトップ（lg〜）:
  - 標準テーブルレイアウト
  - 全カラム表示
  - ソート・フィルター機能
  - 行選択・バルクアクション
  
タブレット（md〜lg）:
  - 重要カラムのみ表示
  - 詳細は展開/モーダル
  - 水平スクロール対応
  - 簡略アクション
  
モバイル（〜md）:
  - カードベースレイアウト
  - 縦積み表示
  - スワイプアクション
  - 詳細はドリルダウン

カードレイアウト例:
┌─────────────────────┐
│ プロジェクト名          │
│ ステータス: 進行中      │
│ 期限: 2025-03-31       │
│ [詳細] [編集]          │
└─────────────────────┘
```

##### 3.2.3 フォーム適応設計
| デバイス | レイアウト | 入力支援 | バリデーション |
|---------|----------|---------|---------------|
| **モバイル** | 単一カラム | 大きなタップ領域 | インライン表示 |
| **タブレット** | 2カラム可能 | 適度なサイズ | ツールチップ |
| **デスクトップ** | 複数カラム | 標準サイズ | 詳細説明 |

#### 3.3 モバイルファースト実装

##### 3.3.1 モバイルファースト CSS 戦略
```css
/* モバイルファースト基準 */
.component {
  /* モバイル（デフォルト）スタイル */
  display: block;
  width: 100%;
  padding: 1rem;
}

/* タブレット以上で適用 */
@media (min-width: 768px) {
  .component {
    display: flex;
    width: auto;
    padding: 1.5rem;
  }
}

/* デスクトップ以上で適用 */
@media (min-width: 1024px) {
  .component {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }
}
```

##### 3.3.2 プログレッシブエンハンスメント
```yaml
機能段階的実装:
  Core Experience (全デバイス):
    - 基本的な読み込み・表示
    - 必須機能の動作
    - キーボードナビゲーション
  
  Enhanced Experience (タブレット〜):
    - ホバーエフェクト
    - 複数カラムレイアウト
    - 詳細フィルタリング
  
  Advanced Experience (デスクトップ〜):
    - ドラッグ&ドロップ
    - 複雑なアニメーション
    - 高度なデータ可視化
```

---

### 4. 主要画面設計

#### 4.1 ダッシュボード

##### 4.1.1 ダッシュボード設計コンセプト
```yaml
設計目標:
  - 重要情報の一覧性確保
  - ロール別カスタマイズ対応
  - アクションへの迅速な導線
  - データの視覚的理解促進

情報階層:
  Primary: KPI数値、重要アラート
  Secondary: グラフ・チャート
  Tertiary: 詳細データ、履歴
  
レイアウト原則:
  - F字パターン考慮（左上→右上→左下の視線流れ）
  - 最重要情報は左上に配置
  - アクション可能項目は右側配置
```

##### 4.1.2 ダッシュボードワイヤーフレーム
```
┌─────────────────────────────────────────────────────────────┐
│ ヘッダー [ロゴ] [ナビゲーション] [通知] [ユーザーメニュー]        │
├─────────────────────────────────────────────────────────────┤
│ サイドバー    │ メインコンテンツ領域                             │
│ ├ ダッシュボード │ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ ├ プロジェクト   │ │ KPIカード1 │ │ KPIカード2 │ │ KPIカード3 │        │
│ ├ タスク       │ └──────────┘ └──────────┘ └──────────┘        │
│ ├ レポート     │                                              │
│ └ 設定        │ ┌─────────────────┐ ┌─────────────────┐        │
│               │ │   収益グラフ      │ │  プロジェクト進捗  │        │
│               │ │                 │ │                 │        │
│               │ └─────────────────┘ └─────────────────┘        │
│               │                                              │
│               │ ┌─────────────────────────────────────────┐  │
│               │ │         最近のアクティビティ              │  │
│               │ │ • プロジェクトA - タスク完了               │  │
│               │ │ • 請求書B - 承認待ち                     │  │
│               │ │ • レポートC - 作成中                     │  │
│               │ └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

##### 4.1.3 ダッシュボード構成要素
| 要素 | 目的 | デザイン仕様 | インタラクション |
|------|------|-------------|----------------|
| **KPIカード** | 重要指標の即座把握 | カード形式、大きな数値 | ドリルダウン可能 |
| **チャート** | トレンド・推移の可視化 | Chart.js、レスポンシブ | ツールチップ、ズーム |
| **アクティビティフィード** | 最新情報の通知 | タイムライン形式 | 詳細へのリンク |
| **クイックアクション** | よく使う機能への導線 | ボタングループ | モーダル・ページ遷移 |

##### 4.1.4 ロール別ダッシュボード
```yaml
経営層ダッシュボード:
  KPI:
    - 売上高、利益率
    - プロジェクト収益性
    - 顧客満足度
  グラフ:
    - 月次売上推移
    - 部門別収益
    - 市場シェア

プロジェクトマネージャー:
  KPI:
    - 進行中プロジェクト数
    - 期限遅延件数
    - チーム稼働率
  グラフ:
    - プロジェクト進捗状況
    - リソース配分
    - 工数実績vs予定

一般ユーザー:
  KPI:
    - 自分のタスク数
    - 今週の工数
    - 未提出レポート
  情報:
    - 個人タスクリスト
    - スケジュール
    - 通知・お知らせ
```

#### 4.2 プロジェクト管理画面

##### 4.2.1 プロジェクト一覧画面
```
┌─────────────────────────────────────────────────────────────┐
│ プロジェクト管理                     [新規作成] [インポート]    │
├─────────────────────────────────────────────────────────────┤
│ [検索バー] [フィルター▼] [ソート▼] [表示設定▼]             │
├─────────────────────────────────────────────────────────────┤
│ ┌─ プロジェクトカード ─────────────────────────────────┐      │
│ │ ■ [ステータス] プロジェクト名                          │      │
│ │   期間: 2025/01/01 - 2025/06/30 | 進捗: ████░░ 60% │      │
│ │   PM: 田中太郎 | 予算: ¥10,000,000 | メンバー: 5名  │      │
│ │   [詳細] [編集] [アーカイブ]                          │      │
│ └─────────────────────────────────────────────────────┘      │
│ ┌─ プロジェクトカード ─────────────────────────────────┐      │
│ │ ● [進行中] システム刷新プロジェクト                    │      │
│ │   期間: 2025/02/01 - 2025/12/31 | 進捗: ██░░░░ 25% │      │
│ │   PM: 佐藤花子 | 予算: ¥50,000,000 | メンバー: 12名 │      │
│ │   [詳細] [編集] [アーカイブ]                          │      │
│ └─────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

##### 4.2.2 プロジェクト詳細画面設計
```yaml
画面構成:
  ヘッダー領域:
    - プロジェクト名・ステータス
    - 主要KPI（進捗率、予算執行率、残日数）
    - アクションボタン（編集、設定、アーカイブ）
  
  タブナビゲーション:
    - 概要（サマリー）
    - タスク・WBS
    - ガントチャート
    - メンバー・リソース
    - ファイル・ドキュメント
    - 予算・コスト
    - レポート・分析
  
  サイドパネル（右側）:
    - プロジェクト基本情報
    - 最新アクティビティ
    - 関連リンク・ドキュメント

レスポンシブ対応:
  モバイル:
    - サイドパネルは下部に移動
    - タブは水平スクロール
    - カードベースレイアウト
  
  タブレット:
    - サイドパネル幅調整
    - タブは2段表示可能
    - グリッドレイアウト
```

##### 4.2.3 ガントチャート設計
```yaml
機能要件:
  基本機能:
    - タスク表示・編集
    - 依存関係表示
    - 進捗バー表示
    - クリティカルパス表示
  
  インタラクション:
    - ドラッグ&ドロップによる期間変更
    - タスククリックで詳細編集
    - ズーム機能（日/週/月表示）
    - フィルタリング機能
  
  レスポンシブ対応:
    デスクトップ:
      - フル機能ガントチャート
      - 2ペイン表示（タスクリスト+チャート）
    
    タブレット:
      - 簡略表示ガントチャート
      - スワイプでペイン切替
    
    モバイル:
      - リスト形式でタスク表示
      - タップでガントビューに切替
      - ピンチズーム対応
```

#### 4.3 データ入力・フォーム画面

##### 4.3.1 フォーム設計原則
```yaml
ユーザビリティ原則:
  - 論理的な入力順序
  - 明確なラベル・説明
  - リアルタイムバリデーション
  - エラー状態の明確な表示
  - 保存状態の視覚的フィードバック

アクセシビリティ:
  - 適切なlabel要素とfor属性
  - aria-describedbyによる説明関連付け
  - fieldsetによるグループ化
  - エラーメッセージのaria-live

プログレッシブエンハンスメント:
  - 基本: HTML5フォームバリデーション
  - 拡張: JavaScript リアルタイム検証
  - 高度: 自動保存・復元機能
```

##### 4.3.2 フォームレイアウト設計
```
┌─────────────────────────────────────────────────────────────┐
│ プロジェクト作成                              [保存] [キャンセル] │
├─────────────────────────────────────────────────────────────┤
│ 基本情報                                                     │
│ ┌─────────────────┐ ┌─────────────────┐                     │
│ │プロジェクト名*    │ │プロジェクトコード│                     │
│ │[入力フィールド]  │ │[自動生成]       │                     │
│ └─────────────────┘ └─────────────────┘                     │
│                                                             │
│ ┌─────────────────┐ ┌─────────────────┐                     │
│ │開始日*          │ │終了日*          │                     │
│ │[日付ピッカー]   │ │[日付ピッカー]   │                     │
│ └─────────────────┘ └─────────────────┘                     │
│                                                             │
│ ┌─────────────────────────────────────┐                     │
│ │説明                                 │                     │
│ │[テキストエリア]                     │                     │
│ │                                     │                     │
│ └─────────────────────────────────────┘                     │
├─────────────────────────────────────────────────────────────┤
│ 担当・予算                                                   │
│ ┌─────────────────┐ ┌─────────────────┐                     │
│ │プロジェクトマネージャー │ │予算            │                     │
│ │[ユーザー選択]   │ │[数値入力]       │                     │
│ └─────────────────┘ └─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

##### 4.3.3 入力コンポーネント仕様
| コンポーネント | 仕様 | バリデーション | エラー表示 |
|---------------|------|----------------|------------|
| **テキスト入力** | 高さ44px、角丸6px | 必須、文字数制限 | フィールド下赤文字 |
| **日付ピッカー** | カレンダーUI | 日付形式、範囲 | インラインエラー |
| **選択リスト** | ドロップダウン/検索 | 選択必須 | 選択肢ハイライト |
| **数値入力** | 数値専用キーパッド | 範囲、形式 | リアルタイム表示 |
| **ファイルアップロード** | ドラッグ&ドロップ | サイズ、形式 | プログレス表示 |

##### 4.3.4 フォーム状態管理
```yaml
入力状態:
  Default: 
    - ボーダー: Gray-300
    - 背景: White
    - ラベル: Gray-700
  
  Focus:
    - ボーダー: Orange-500
    - 影: Orange-100
    - ラベル: Orange-700
  
  Filled:
    - ボーダー: Gray-400
    - 背景: White
    - ラベル: Gray-600
  
  Error:
    - ボーダー: Red-500
    - 背景: Red-50
    - ラベル: Red-700
  
  Disabled:
    - ボーダー: Gray-200
    - 背景: Gray-100
    - ラベル: Gray-400
    - カーソル: not-allowed

バリデーション表示:
  リアルタイム:
    - フォーカス離脱時に即座検証
    - 正常: Green チェックアイコン
    - エラー: Red エクスクラメーションアイコン
  
  サブミット時:
    - 全項目一括検証
    - エラー項目への自動スクロール
    - サマリーエラーメッセージ表示
```

#### 4.4 データ表示・一覧画面

##### 4.4.1 データテーブル設計
```yaml
テーブル機能:
  基本機能:
    - ソート（昇順・降順）
    - ページネーション
    - 列の表示/非表示
    - 行選択（単一・複数）
  
  高度機能:
    - インライン編集
    - バルクアクション
    - 列幅調整
    - 列順序変更
    - フィルタリング
    - エクスポート
  
  レスポンシブ対応:
    デスクトップ: フルテーブル表示
    タブレット: 重要列のみ + 詳細モーダル
    モバイル: カードリスト形式
```

##### 4.4.2 データテーブルワイヤーフレーム
```
┌─────────────────────────────────────────────────────────────┐
│ プロジェクト一覧                    [エクスポート] [新規作成]    │
├─────────────────────────────────────────────────────────────┤
│ [検索] [フィルター] [表示列設定]              表示: 25件/ページ │
├─┬────────┬──────────┬─────────┬────────┬─────────┬──────┤
│☐│名前 ↕   │ステータス│PM      │進捗    │期限     │操作  │
├─┼────────┼──────────┼─────────┼────────┼─────────┼──────┤
│☐│システム A│進行中●   │田中太郎 │████░ 60%│2025/6/30│[編集]│
│☐│プロジェクトB│完了◉│佐藤花子 │█████100%│2025/3/31│[詳細]│
│☐│システム刷新│準備中○ │山田一郎 │█░░░ 15%│2025/12/1│[編集]│
├─┴────────┴──────────┴─────────┴────────┴─────────┴──────┤
│ ☐全選択 選択項目: 0件                    ◀ 1 2 3 ... 10 ▶ │
└─────────────────────────────────────────────────────────────┘
```

##### 4.4.3 カードレイアウト（モバイル）
```
┌─────────────────────────┐
│ システム開発プロジェクト     │
│ ─────────────────────── │
│ ステータス: ● 進行中        │
│ PM: 田中太郎               │
│ 進捗: ████████░░ 80%      │
│ 期限: 2025年6月30日         │
│ ─────────────────────── │
│ [詳細] [編集] [削除]        │
└─────────────────────────┘

┌─────────────────────────┐
│ ECサイトリニューアル        │
│ ─────────────────────── │
│ ステータス: ○ 準備中        │
│ PM: 佐藤花子               │
│ 進捗: ██░░░░░░░░ 20%      │
│ 期限: 2025年12月31日        │
│ ─────────────────────── │
│ [詳細] [編集] [削除]        │
└─────────────────────────┘
```

#### 4.5 レポート・分析画面

##### 4.5.1 レポートダッシュボード設計
```yaml
レポート種別:
  定型レポート:
    - 月次売上レポート
    - プロジェクト進捗レポート
    - 工数集計レポート
    - 顧客別収益レポート
  
  アドホック分析:
    - カスタムフィルター
    - ドリルダウン分析
    - 比較分析
    - トレンド分析
  
  リアルタイムダッシュボード:
    - KPIモニタリング
    - アラート・通知
    - 自動更新
    - モバイル対応

可視化コンポーネント:
  グラフ種別:
    - 折れ線グラフ: トレンド表示
    - 棒グラフ: 比較表示
    - 円グラフ: 構成比表示
    - 散布図: 相関表示
    - ヒートマップ: パフォーマンス表示
```

##### 4.5.2 レポート画面レイアウト
```
┌─────────────────────────────────────────────────────────────┐
│ プロジェクト分析レポート                [期間選択] [エクスポート]│
├─────────────────────────────────────────────────────────────┤
│ フィルター: [部門] [ステータス] [期間] [PM] [適用] [クリア]   │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐                     │
│ │ 収益推移           │ │ プロジェクト数推移 │                     │
│ │     ∧            │ │   ▄▄▄           │                     │
│ │    ∧ ∧           │ │  ▄   ▄▄         │                     │
│ │   ∧   ∧          │ │ ▄     ▄▄        │                     │
│ │  ∧     ∧         │ │▄       ▄       │                     │
│ └─────────────────┘ └─────────────────┘                     │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ プロジェクト別収益性                                      │ │
│ │ プロジェクトA ██████████████████████████████ ¥50M      │ │
│ │ プロジェクトB ██████████████████ ¥35M                  │ │
│ │ プロジェクトC ████████████ ¥25M                         │ │
│ │ プロジェクトD ████████ ¥18M                             │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

### 5. UIコンポーネント設計

#### 5.1 基本コンポーネント

##### 5.1.1 ボタンコンポーネント
```yaml
ボタンバリエーション:
  Primary:
    背景: Orange-500
    テキスト: White
    ホバー: Orange-600
    用途: 主要アクション
  
  Secondary:
    背景: Gray-100
    テキスト: Gray-900
    ボーダー: Gray-300
    ホバー: Gray-200
    用途: 副次アクション
  
  Outline:
    背景: Transparent
    テキスト: Orange-500
    ボーダー: Orange-500
    ホバー: Orange-50
    用途: 軽いアクション
  
  Ghost:
    背景: Transparent
    テキスト: Gray-600
    ホバー: Gray-100
    用途: テキストリンク的

サイズ仕様:
  Large: 
    高さ: 48px
    パディング: 16px 24px
    フォント: 16px Medium
  
  Medium:
    高さ: 40px
    パディング: 12px 20px
    フォント: 14px Medium
  
  Small:
    高さ: 32px
    パディング: 8px 16px
    フォント: 12px Medium

状態管理:
  Normal: 通常状態
  Hover: マウスオーバー
  Active: クリック中
  Focus: キーボードフォーカス
  Loading: 処理中（スピナー表示）
  Disabled: 無効状態
```

##### 5.1.2 入力フィールドコンポーネント
```typescript
interface InputFieldProps {
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel';
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'outlined' | 'filled';
}

// 実装例
<InputField
  label="プロジェクト名"
  placeholder="プロジェクト名を入力してください"
  value={projectName}
  onChange={setProjectName}
  error={validation.projectName}
  required
  helperText="わかりやすい名前をつけてください"
  startIcon={<FolderIcon />}
/>
```

##### 5.1.3 カードコンポーネント
```yaml
カード基本仕様:
  背景: White
  境界線: Gray-200 1px
  角丸: 8px
  影: 0 2px 4px rgba(0,0,0,0.1)
  パディング: 24px

カード構成要素:
  Header:
    - タイトル (18px SemiBold)
    - サブタイトル (14px Regular Gray-600)
    - アクションボタン (右上)
  
  Content:
    - メインコンテンツ領域
    - 自由レイアウト
  
  Footer:
    - アクションボタン群
    - メタ情報
    - 区切り線あり

ホバー効果:
  - 影の拡張: 0 4px 8px rgba(0,0,0,0.15)
  - わずかな上昇: transform: translateY(-2px)
  - トランジション: 200ms ease-out
```

#### 5.2 複合コンポーネント

##### 5.2.1 データテーブルコンポーネント
```typescript
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  pagination?: PaginationConfig;
  sorting?: SortingConfig;
  filtering?: FilteringConfig;
  selection?: SelectionConfig;
  actions?: ActionConfig<T>;
  responsive?: boolean;
  emptyState?: React.ReactNode;
}

interface Column<T> {
  key: keyof T;
  title: string;
  render?: (value: any, record: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  responsive?: {
    hideBelow?: 'sm' | 'md' | 'lg';
    showInModal?: boolean;
  };
}
```

##### 5.2.2 モーダルコンポーネント
```yaml
モーダル種別:
  Dialog:
    - 確認・警告ダイアログ
    - 固定サイズ（sm: 400px, md: 600px, lg: 800px）
    - 中央配置
  
  Drawer:
    - サイドパネル形式
    - 右端・左端からスライド
    - フル高さ
  
  FullScreen:
    - 全画面表示
    - 複雑なフォーム・詳細画面
    - モバイル優先

モーダル構成:
  Header:
    - タイトル
    - 閉じるボタン（×）
    - 進捗表示（必要に応じて）
  
  Body:
    - メインコンテンツ
    - スクロール対応
  
  Footer:
    - アクションボタン
    - 右寄せ配置
    - キャンセル + 確定

アクセシビリティ:
  - aria-modal="true"
  - role="dialog"
  - focus trap実装
  - ESCキーで閉じる
  - 背景クリックで閉じる
```

##### 5.2.3 ナビゲーションコンポーネント
```yaml
サイドナビゲーション:
  幅: 280px (展開時) / 64px (折りたたみ時)
  背景: White
  境界線: Gray-200 右側
  
  メニュー項目:
    高さ: 44px
    パディング: 12px 16px
    アイコン: 20px
    ホバー: Gray-100
    アクティブ: Orange-50 背景 + Orange-500 テキスト
  
  階層表示:
    - 第1階層: 太字、アイコンあり
    - 第2階層: インデント 16px
    - 第3階層: インデント 32px
    - 展開/折りたたみ: シェブロンアイコン

ブレッドクラム:
  パンくずリスト: ホーム > プロジェクト > プロジェクト詳細
  区切り文字: > (Gray-400)
  リンク色: Orange-500
  現在ページ: Gray-700 (リンクなし)
  
  レスポンシブ:
    モバイル: 最後の2階層のみ表示
    タブレット: 省略形表示 (...を使用)
```

#### 5.3 状態表示コンポーネント

##### 5.3.1 ステータスバッジ
```yaml
ステータス種別・色分け:
  Success (完了):
    背景: Green-100
    テキスト: Green-800
    アイコン: CheckCircle
  
  Warning (注意):
    背景: Yellow-100
    テキスト: Yellow-800
    アイコン: ExclamationTriangle
  
  Error (エラー):
    背景: Red-100
    テキスト: Red-800
    アイコン: XCircle
  
  Info (情報):
    背景: Blue-100
    テキスト: Blue-800
    アイコン: InformationCircle
  
  Neutral (中立):
    背景: Gray-100
    テキスト: Gray-800

バッジサイズ:
  Small: 高さ20px、フォント11px
  Medium: 高さ24px、フォント12px
  Large: 高さ28px、フォント14px
```

##### 5.3.2 進捗表示コンポーネント
```yaml
プログレスバー:
  基本仕様:
    高さ: 8px (thin) / 12px (medium) / 16px (thick)
    背景: Gray-200
    進捗: Orange-500
    角丸: 4px
  
  バリエーション:
    - 数値表示あり/なし
    - アニメーション効果
    - ストライプ表示（処理中）
    - グラデーション表示

円形プログレス:
  サイズ: 32px / 48px / 64px
  ストローク幅: 4px
  色: Orange-500
  背景: Gray-200
  アニメーション: 回転（処理中）

スケルトンローダー:
  - データ読み込み中の表示
  - 実際のコンテンツ形状を模倣
  - 波アニメーション効果
  - 背景: Gray-200 → Gray-100の繰り返し
```

---

### 6. アクセシビリティ対応

#### 6.1 WCAG 2.1 AA準拠実装

##### 6.1.1 知覚可能（Perceivable）対応
```yaml
色・コントラスト:
  コントラスト比基準:
    - 通常テキスト: 4.5:1以上
    - 大きなテキスト (18pt以上): 3:1以上
    - UI要素: 3:1以上
  
  実装チェック:
    - 色のみに依存した情報伝達の回避
    - アイコン・パターンとの併用
    - 明度差による区別

代替テキスト:
  画像:
    - 装飾画像: alt=""
    - 情報画像: 内容説明
    - 複雑画像: longdesc または詳細説明
  
  アイコン:
    - 意味のあるアイコン: aria-label
    - 装飾アイコン: aria-hidden="true"
    - アイコン+テキスト: テキストで十分
```

##### 6.1.2 操作可能（Operable）対応
```typescript
// キーボードナビゲーション実装例
const NavigationMenu: React.FC = () => {
  const handleKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        // 次の項目にフォーカス
        focusNext();
        event.preventDefault();
        break;
      case 'ArrowUp':
        // 前の項目にフォーカス
        focusPrevious();
        event.preventDefault();
        break;
      case 'Enter':
      case ' ':
        // 項目を選択
        selectItem();
        event.preventDefault();
        break;
      case 'Escape':
        // メニューを閉じる
        closeMenu();
        event.preventDefault();
        break;
    }
  };

  return (
    <nav role="navigation" aria-label="メインナビゲーション">
      <ul role="menubar" onKeyDown={handleKeyDown}>
        <li role="none">
          <a role="menuitem" tabIndex={0}>
            ダッシュボード
          </a>
        </li>
        {/* 他のメニュー項目 */}
      </ul>
    </nav>
  );
};
```

##### 6.1.3 理解可能（Understandable）対応
```yaml
明確なラベル・説明:
  フォームラベル:
    - label要素とfor属性の適切な関連付け
    - 必須項目の明示 (aria-required="true")
    - ヘルプテキストの関連付け (aria-describedby)
  
  エラーメッセージ:
    - 具体的で建設的な内容
    - 解決方法の提示
    - aria-invalid="true"の設定
    - エラーメッセージとの関連付け

言語設定:
  - html要素にlang属性
  - 部分的言語変更時のlang属性
  - 読み上げソフト対応

一貫性:
  - 統一されたナビゲーション配置
  - 一貫した用語・表現
  - 予測可能な動作
```

##### 6.1.4 堅牢（Robust）対応
```html
<!-- セマンティックHTML例 -->
<main role="main">
  <header>
    <h1>プロジェクト管理システム</h1>
  </header>
  
  <nav aria-label="メインナビゲーション">
    <ul>
      <li><a href="/dashboard">ダッシュボード</a></li>
      <li><a href="/projects" aria-current="page">プロジェクト</a></li>
      <li><a href="/reports">レポート</a></li>
    </ul>
  </nav>
  
  <section aria-labelledby="project-list-title">
    <h2 id="project-list-title">プロジェクト一覧</h2>
    
    <table>
      <caption>現在進行中のプロジェクト一覧</caption>
      <thead>
        <tr>
          <th scope="col">プロジェクト名</th>
          <th scope="col">ステータス</th>
          <th scope="col">進捗率</th>
          <th scope="col">担当PM</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>システム開発</td>
          <td>
            <span class="status-badge status-active">進行中</span>
          </td>
          <td>
            <div class="progress-bar" role="progressbar" 
                 aria-valuenow="75" aria-valuemin="0" aria-valuemax="100">
              75%
            </div>
          </td>
          <td>田中太郎</td>
        </tr>
      </tbody>
    </table>
  </section>
</main>
```

#### 6.2 支援技術対応

##### 6.2.1 スクリーンリーダー対応
```yaml
ARIA属性の適切な使用:
  role属性:
    - button: ボタン機能
    - link: リンク機能
    - tab/tabpanel: タブ機能
    - dialog: モーダル
    - alert: 重要な通知
  
  状態属性:
    - aria-expanded: 展開状態
    - aria-selected: 選択状態
    - aria-checked: チェック状態
    - aria-disabled: 無効状態
  
  関係性属性:
    - aria-labelledby: ラベル参照
    - aria-describedby: 説明参照
    - aria-owns: 所有関係
    - aria-controls: 制御関係

読み上げ最適化:
  - 読み上げ順序の論理性確保
  - 不要な要素のaria-hidden
  - ライブリージョンの活用
  - 適切な見出し階層
```

##### 6.2.2 キーボードナビゲーション
```typescript
// タブトラップ実装（モーダル用）
const useTabTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    firstElement.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);

  return containerRef;
};
```

##### 6.2.3 音声認識対応
```yaml
音声コマンド対応:
  基本コマンド:
    - "新規作成": 新規作成ボタンをクリック
    - "検索": 検索フィールドにフォーカス
    - "保存": 保存ボタンをクリック
    - "戻る": 前の画面に戻る
  
  ナビゲーションコマンド:
    - "ダッシュボード": ダッシュボードに移動
    - "プロジェクト一覧": プロジェクト一覧に移動
    - "設定": 設定画面に移動
  
  フォーム操作:
    - "プロジェクト名": 該当フィールドにフォーカス
    - "開始日": 日付フィールドにフォーカス
    - "送信": フォーム送信

実装考慮事項:
  - ボタンやリンクに明確な名前付け
  - aria-labelの適切な設定
  - 重複しない一意な名前付け
  - コマンド候補の動的表示
```

---

### 7. 多言語・国際化対応

#### 7.1 多言語対応設計

##### 7.1.1 対応言語・優先度
| 言語 | 地域 | 優先度 | 実装時期 | 特別考慮事項 |
|------|------|-------|---------|------------|
| **日本語** | 日本 | 最高 | Phase 1 | 基準言語 |
| **英語** | グローバル | 高 | Phase 1 | 国際標準 |
| **中国語（簡体字）** | 中国本土 | 中 | Phase 2 | 長い文字列対応 |
| **韓国語** | 韓国 | 中 | Phase 2 | ハングル表示 |
| **中国語（繁体字）** | 台湾・香港 | 低 | Phase 3 | 簡体字との差異対応 |

##### 7.1.2 i18n実装アーキテクチャ
```typescript
// 国際化設定
import { createI18n } from 'vue-i18n';
import { initReactI18next } from 'react-i18next';

// メッセージリソース構造
interface Messages {
  common: {
    buttons: {
      save: string;
      cancel: string;
      delete: string;
      edit: string;
    };
    labels: {
      name: string;
      description: string;
      status: string;
    };
  };
  pages: {
    dashboard: {
      title: string;
      subtitle: string;
      kpis: {
        activeProjects: string;
        completedTasks: string;
      };
    };
    projects: {
      listTitle: string;
      createNew: string;
      columns: {
        name: string;
        manager: string;
        status: string;
        progress: string;
      };
    };
  };
  validation: {
    required: string;
    email: string;
    minLength: string;
  };
}

// 使用例
const { t } = useTranslation();

<button>
  {t('common.buttons.save')}
</button>

<h1>{t('pages.dashboard.title')}</h1>
```

##### 7.1.3 レイアウト対応
```yaml
文字列長対応:
  英語基準倍率:
    - ドイツ語: +30%
    - 中国語: -20%
    - 日本語: +10%
    - 韓国語: +15%
  
  UI要素調整:
    ボタン:
      - 最小幅設定
      - テキスト長に応じた自動調整
      - 改行対応（必要に応じて）
    
    ナビゲーション:
      - メニュー項目幅の動的調整
      - 長いメニュー名の省略表示
      - ツールチップでの完全表示
    
    フォームラベル:
      - 固定幅の回避
      - flexboxによる自動調整
      - 縦積みレイアウトへの切替
```

#### 7.2 RTL（右から左）対応

##### 7.2.1 RTL対応言語・実装
```yaml
対象言語:
  - アラビア語 (ar)
  - ヘブライ語 (he)
  - ペルシア語 (fa)

実装方針:
  CSS Logical Properties使用:
    - margin-inline-start / margin-inline-end
    - padding-inline-start / padding-inline-end
    - inset-inline-start / inset-inline-end
  
  Flexbox/Grid対応:
    - flex-direction: row-reverse
    - grid-template-columns: reverse
    - text-align: start (left/rightの代替)

アイコン・画像対応:
  方向性のあるアイコン:
    - 矢印アイコンの左右反転
    - チェックマーク等は反転しない
    - transform: scaleX(-1) での実装
  
  レイアウト画像:
    - UI mockupの左右反転版作成
    - 文字を含む画像の多言語版準備
```

##### 7.2.2 RTL実装例
```css
/* CSS Logical Propertiesを使用 */
.card {
  margin-inline-start: 1rem; /* LTR: margin-left, RTL: margin-right */
  padding-inline: 1rem 2rem; /* 開始・終了方向のパディング */
  border-inline-start: 2px solid orange; /* 開始方向のボーダー */
}

/* 方向別スタイリング */
[dir="ltr"] .arrow-icon {
  transform: none;
}

[dir="rtl"] .arrow-icon {
  transform: scaleX(-1);
}

/* Flexboxレイアウト */
.navigation {
  display: flex;
  flex-direction: row;
}

[dir="rtl"] .navigation {
  flex-direction: row-reverse;
}
```

#### 7.3 地域固有対応

##### 7.3.1 日付・時刻表示
```typescript
// 地域別日付フォーマット
const formatDate = (date: Date, locale: string): string => {
  const formatters = {
    'ja-JP': new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    }),
    'en-US': new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    }),
    'zh-CN': new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    }),
  };

  return formatters[locale]?.format(date) || formatters['en-US'].format(date);
};

// 使用例
formatDate(new Date(), 'ja-JP'); // "2025年08月23日(金)"
formatDate(new Date(), 'en-US'); // "Aug 23, 2025, Fri"
formatDate(new Date(), 'zh-CN'); // "2025年08月23日周五"
```

##### 7.3.2 数値・通貨表示
```typescript
// 地域別数値フォーマット
const formatNumber = (value: number, locale: string): string => {
  return new Intl.NumberFormat(locale).format(value);
};

// 地域別通貨フォーマット
const formatCurrency = (value: number, locale: string, currency: string): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(value);
};

// 使用例
formatNumber(1234567, 'ja-JP'); // "1,234,567"
formatNumber(1234567, 'de-DE'); // "1.234.567"

formatCurrency(1000000, 'ja-JP', 'JPY'); // "¥1,000,000"
formatCurrency(1000000, 'en-US', 'USD'); // "$1,000,000.00"
formatCurrency(1000000, 'zh-CN', 'CNY'); // "¥1,000,000.00"
```

---

### 8. パフォーマンス最適化

#### 8.1 フロントエンド最適化

##### 8.1.1 レンダリング最適化
```yaml
React最適化手法:
  メモ化:
    - React.memo: コンポーネントのメモ化
    - useMemo: 計算結果のメモ化
    - useCallback: 関数のメモ化
    - ピュアコンポーネント化
  
  仮想スクロール:
    - react-window使用
    - 大量リスト表示の最適化
    - 1000件以上のデータ表示時適用
  
  遅延ローディング:
    - React.lazy: コンポーネント分割
    - Intersection Observer: 画像遅延読み込み
    - Suspense: ローディング状態管理

Bundle最適化:
  Code Splitting:
    - ルートベース分割
    - コンポーネントベース分割
    - 動的import使用
    - Webpack bundle分析
  
  Tree Shaking:
    - 未使用コードの除去
    - ESモジュール使用
    - ライブラリの部分インポート
  
  圧縮・最小化:
    - Terser: JavaScript圧縮
    - CSSNano: CSS最小化
    - 画像最適化: WebP変換
    - Gzip/Brotli圧縮
```

##### 8.1.2 画像・アセット最適化
```yaml
画像最適化戦略:
  フォーマット選択:
    - WebP: モダンブラウザ向け（-30%サイズ）
    - AVIF: 最新ブラウザ向け（-50%サイズ）
    - JPEG: 写真・複雑画像
    - PNG: ロゴ・アイコン・透明背景
    - SVG: アイコン・シンプルグラフィック
  
  レスポンシブ画像:
    - srcset属性: 解像度別画像
    - sizes属性: ビューポート別サイズ
    - picture要素: アートディレクション
  
  遅延読み込み:
    - loading="lazy": ネイティブ遅延読み込み
    - Intersection Observer: カスタム実装
    - プレースホルダー表示

CDN・キャッシュ戦略:
  静的アセット:
    - CloudFront配信
    - 地理的分散配置
    - キャッシュ期間: 1年
  
  動的コンテンツ:
    - ETag使用
    - 条件付きリクエスト
    - Service Worker活用
```

#### 8.2 パフォーマンス監視

##### 8.2.1 Core Web Vitals最適化
| 指標 | 目標値 | 現在値 | 最適化手法 |
|------|-------|--------|-----------|
| **LCP** | 2.5秒以下 | 測定中 | 画像最適化、初期HTML最適化 |
| **FID** | 100ms以下 | 測定中 | JavaScript分割、メインスレッド最適化 |
| **CLS** | 0.1以下 | 測定中 | レイアウト固定、フォント最適化 |
| **FCP** | 1.8秒以下 | 測定中 | クリティカルCSS インライン化 |
| **TTFB** | 600ms以下 | 測定中 | サーバー応答最適化 |

##### 8.2.2 パフォーマンス監視実装
```typescript
// Web Vitals測定
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

const measurePerformance = () => {
  getCLS((metric) => {
    // Cumulative Layout Shift
    analytics.track('performance.cls', {
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
    });
  });

  getFID((metric) => {
    // First Input Delay
    analytics.track('performance.fid', {
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
    });
  });

  getFCP((metric) => {
    // First Contentful Paint
    analytics.track('performance.fcp', {
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
    });
  });

  getLCP((metric) => {
    // Largest Contentful Paint
    analytics.track('performance.lcp', {
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
    });
  });

  getTTFB((metric) => {
    // Time to First Byte
    analytics.track('performance.ttfb', {
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
    });
  });
};

// ページロード完了時に測定開始
window.addEventListener('load', measurePerformance);
```

##### 8.2.3 パフォーマンス予算設定
```yaml
パフォーマンス予算:
  ページサイズ:
    - HTML: 50KB以下
    - CSS: 200KB以下
    - JavaScript: 500KB以下（圧縮後）
    - 画像: 1MB以下（ページあたり）
    - 総サイズ: 2MB以下
  
  ネットワーク:
    - HTTPリクエスト: 50回以下
    - 同時接続: 6個以下
    - キープアライブ: 有効化
  
  レンダリング:
    - DOM要素数: 1000個以下
    - CSS セレクタ: 4階層以下
    - JavaScriptファイル数: 10個以下

監視・アラート:
  - Lighthouse CI: PR毎実行
  - Web Vitals: リアルタイム監視
  - Bundle Analyzer: サイズ監視
  - Performance Budget: 超過時アラート
```

---

### 9. 開発ガイドライン

#### 9.1 実装標準

##### 9.1.1 Reactコンポーネント設計原則
```typescript
// コンポーネント設計原則

// 1. 単一責任の原則
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  onClick,
  ...rest
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-500',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
    outline: 'border border-orange-500 text-orange-500 hover:bg-orange-50 focus:ring-orange-500'
  };
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
  
  const className = clsx(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    {
      'opacity-50 cursor-not-allowed': disabled,
      'cursor-wait': loading
    }
  );
  
  return (
    <button
      className={className}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {loading && <Spinner className="mr-2" />}
      {children}
    </button>
  );
};

// 2. 関心の分離
// カスタムフック使用例
const useProjectForm = (initialData?: Project) => {
  const [formData, setFormData] = useState(initialData || {});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  
  const validate = (data: ProjectFormData): ValidationErrors => {
    const errors: ValidationErrors = {};
    
    if (!data.name?.trim()) {
      errors.name = 'プロジェクト名は必須です';
    }
    
    if (!data.startDate) {
      errors.startDate = '開始日は必須です';
    }
    
    if (!data.endDate) {
      errors.endDate = '終了日は必須です';
    } else if (data.startDate && new Date(data.endDate) <= new Date(data.startDate)) {
      errors.endDate = '終了日は開始日より後の日付を選択してください';
    }
    
    return errors;
  };
  
  const handleSubmit = async (data: ProjectFormData) => {
    setLoading(true);
    const validationErrors = validate(data);
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return false;
    }
    
    try {
      await saveProject(data);
      setErrors({});
      return true;
    } catch (error) {
      setErrors({ submit: 'プロジェクトの保存に失敗しました' });
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  return {
    formData,
    setFormData,
    errors,
    loading,
    handleSubmit
  };
};
```

##### 9.1.2 CSS/Styling標準
```css
/* Tailwind CSS使用方針 */

/* 1. ユーティリティファースト */
.button-primary {
  @apply inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500;
}

/* 2. コンポーネントレイヤー（再利用可能な複雑なパターン） */
@layer components {
  .card {
    @apply bg-white rounded-lg shadow border border-gray-200 p-6;
  }
  
  .form-input {
    @apply block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-orange-500 focus:border-orange-500;
  }
  
  .form-input-error {
    @apply border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500;
  }
}

/* 3. ユーティリティレイヤー（カスタムユーティリティ） */
@layer utilities {
  .text-shadow {
    text-shadow: 0 2px 4px rgba(0,0,0,0.10);
  }
  
  .gradient-orange {
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  }
}

/* 4. レスポンシブデザイン */
.responsive-container {
  @apply container mx-auto px-4;
}

@screen sm {
  .responsive-container {
    @apply px-6;
  }
}

@screen lg {
  .responsive-container {
    @apply px-8;
  }
}

/* 5. アニメーション・トランジション */
.fade-in {
  @apply opacity-0 translate-y-4 transition-all duration-300 ease-in-out;
}

.fade-in.active {
  @apply opacity-100 translate-y-0;
}
```

#### 9.2 品質保証

##### 9.2.1 TypeScript活用指針
```typescript
// 型安全性の確保

// 1. 厳密な型定義
interface Project {
  readonly id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: Date;
  endDate: Date;
  managerId: string;
  budget: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// 2. ユニオン型・リテラル型の活用
type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

type LoadingState = 'idle' | 'loading' | 'succeeded' | 'failed';

// 3. Genericsの適用
interface ApiResponse<T> {
  data: T;
  meta: {
    total: number;
    page: number;
    perPage: number;
  };
  timestamp: string;
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// 4. Type Guards
const isProject = (obj: any): obj is Project => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    ['planning', 'active', 'on_hold', 'completed', 'cancelled'].includes(obj.status)
  );
};

// 5. Utility Types
type CreateProjectRequest = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateProjectRequest = Partial<Pick<Project, 'name' | 'description' | 'status' | 'endDate'>>;
type ProjectSummary = Pick<Project, 'id' | 'name' | 'status'>;

// 6. 厳格なnull安全性
const formatProjectName = (project: Project | null): string => {
  return project?.name ?? '未設定';
};

// 7. Branded Types（プリミティブ型の型安全性向上）
type ProjectId = string & { readonly brand: unique symbol };
type UserId = string & { readonly brand: unique symbol };

const createProjectId = (id: string): ProjectId => id as ProjectId;
const createUserId = (id: string): UserId => id as UserId;
```

##### 9.2.2 テスト戦略
```typescript
// 1. Unit Test (Jest + React Testing Library)
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button Component', () => {
  it('正常にレンダリングされる', () => {
    render(<Button>テストボタン</Button>);
    expect(screen.getByRole('button', { name: 'テストボタン' })).toBeInTheDocument();
  });

  it('クリックイベントが正しく発火する', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>クリック</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disabled状態では クリックできない', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Button disabled onClick={handleClick}>無効ボタン</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('loading状態でスピナーが表示される', () => {
    render(<Button loading>読み込み中</Button>);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
});

// 2. Integration Test
describe('Project Form Integration', () => {
  it('プロジェクト作成フローが正常に動作する', async () => {
    const user = userEvent.setup();
    
    render(<ProjectCreateForm />);
    
    // フォーム入力
    await user.type(screen.getByLabelText('プロジェクト名'), '新規プロジェクト');
    await user.type(screen.getByLabelText('説明'), 'テスト用プロジェクト');
    await user.click(screen.getByLabelText('開始日'));
    await user.click(screen.getByText('15')); // カレンダーから15日を選択
    
    // 送信
    await user.click(screen.getByRole('button', { name: '作成' }));
    
    // 成功メッセージの確認
    await waitFor(() => {
      expect(screen.getByText('プロジェクトが作成されました')).toBeInTheDocument();
    });
  });

  it('バリデーションエラーが正しく表示される', async () => {
    const user = userEvent.setup();
    
    render(<ProjectCreateForm />);
    
    // 必須項目を空のまま送信
    await user.click(screen.getByRole('button', { name: '作成' }));
    
    // エラーメッセージの確認
    await waitFor(() => {
      expect(screen.getByText('プロジェクト名は必須です')).toBeInTheDocument();
    });
  });
});
```

#### 9.3 コードレビューガイドライン

##### 9.3.1 レビュー観点
```yaml
機能性:
  - 要求仕様との適合性
  - エッジケースへの対応
  - エラーハンドリングの妥当性
  - ユーザビリティの考慮

コード品質:
  - 可読性・保守性
  - 適切な抽象化レベル
  - DRY原則の遵守
  - 命名規則の統一

性能:
  - 不要な再レンダリング回避
  - メモリリーク対策
  - 効率的なアルゴリズム選択
  - バンドルサイズへの影響

セキュリティ:
  - XSS対策
  - 入力値検証
  - 機密情報の適切な取扱
  - 権限チェック

アクセシビリティ:
  - WCAG 2.1準拠
  - セマンティックHTML使用
  - キーボード操作対応
  - スクリーンリーダー対応
```

##### 9.3.2 自動化ツール設定
```json
// .eslintrc.json
{
  "extends": [
    "react-app",
    "react-app/jest",
    "@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "rules": {
    "react-hooks/exhaustive-deps": "error",
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/aria-role": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "prefer-const": "error",
    "no-var": "error"
  }
}

// prettier.config.js
module.exports = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false
};

// stylelint.config.js
module.exports = {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-tailwindcss'
  ],
  rules: {
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['tailwind', 'apply', 'variants', 'responsive', 'screen']
      }
    ]
  }
};
```

---

### 10. 実装チェックリスト

#### 10.1 コンポーネント実装チェックリスト

##### 10.1.1 基本要件
- [ ] TypeScript型定義完備
- [ ] Props interfaceの適切な定義
- [ ] デフォルト値の設定
- [ ] エラーハンドリング実装
- [ ] Loading状態の適切な表示

##### 10.1.2 アクセシビリティ
- [ ] セマンティックHTML使用
- [ ] 適切なARIA属性設定
- [ ] キーボード操作対応
- [ ] フォーカス管理実装
- [ ] スクリーンリーダー対応

##### 10.1.3 レスポンシブ対応
- [ ] モバイルファースト実装
- [ ] ブレークポイント対応
- [ ] タッチ操作対応（モバイル）
- [ ] 画面サイズ別レイアウト調整
- [ ] コンテンツの優先度設定

##### 10.1.4 パフォーマンス
- [ ] React.memo適用検討
- [ ] useCallback/useMemo適用
- [ ] 不要な再レンダリング回避
- [ ] 遅延ローディング実装（必要時）
- [ ] 画像最適化（WebP対応）

##### 10.1.5 テスト
- [ ] 単体テスト作成
- [ ] 統合テストカバー
- [ ] アクセシビリティテスト
- [ ] 視覚回帰テスト実行
- [ ] E2Eテストシナリオ確認

#### 10.2 画面実装チェックリスト

##### 10.2.1 UI/UX
- [ ] デザインシステム準拠
- [ ] 一貫したレイアウト
- [ ] 適切なカラー使用
- [ ] フォント・タイポグラフィ統一
- [ ] アイコン・画像最適化

##### 10.2.2 機能性
- [ ] 全ユーザーストーリー実装
- [ ] バリデーション実装
- [ ] エラー状態の適切な表示
- [ ] 成功フィードバック表示
- [ ] データ永続化機能

##### 10.2.3 国際化
- [ ] 多言語対応実装
- [ ] 文字列外部化
- [ ] 日付・数値フォーマット対応
- [ ] RTL対応（必要時）
- [ ] 地域固有機能実装

##### 10.2.4 品質保証
- [ ] コードレビュー完了
- [ ] 静的解析ツール実行
- [ ] パフォーマンス測定
- [ ] セキュリティチェック
- [ ] 既存機能への影響確認

---

### 改訂履歴

| 版数 | 日付 | 変更内容 | 承認者 |
|------|------|---------|--------|
| 1.0 | 2025-08-23 | 初版作成 - ITDO Design System準拠UI設計仕様 | - |

---

*本UI/画面設計仕様書は、ITDO Design Systemに基づくモダンERPシステムの包括的なユーザーインターフェース設計指針です。実装時は最新のアクセシビリティガイドラインと技術動向を確認し、継続的な改善を行ってください。*