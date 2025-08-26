# API設計標準仕様書
## API Design Standard Specification

### 1. 概要

#### 1.1 目的
本仕様書は、ERPシステムにおけるAPI設計の標準とガイドラインを定義し、一貫性のある、保守性の高い、セキュアなAPIを実装するための指針を提供します。

#### 1.2 適用範囲
- REST API設計
- GraphQL API設計
- WebSocket通信
- 内部API・外部API
- 認証・認可
- エラーハンドリング

#### 1.3 設計原則
- **RESTful**: リソース指向、HTTPセマンティクスの活用
- **一貫性**: 統一された命名規則とレスポンス形式
- **バージョニング**: 後方互換性の維持
- **セキュリティファースト**: 認証・認可・暗号化の徹底
- **開発者体験**: 直感的で使いやすいAPI

---

### 2. REST API設計標準

#### 2.1 URL設計

##### 2.1.1 URL構造
```
https://api.itdo-erp.com/v{version}/{module}/{resource}/{id?}/{sub-resource?}
```

##### 2.1.2 命名規則
| 要素 | 規則 | 良い例 | 悪い例 |
|------|------|--------|--------|
| リソース名 | 複数形、小文字、ハイフン区切り | `/projects`, `/time-sheets` | `/Project`, `/timeSheet` |
| パスパラメータ | リソースID | `/projects/123` | `/projects/id=123` |
| クエリパラメータ | キャメルケース | `?startDate=2025-01-01` | `?start_date=2025-01-01` |
| アクション | HTTPメソッドで表現 | `POST /projects/123/archive` | `GET /projects/123/doArchive` |

##### 2.1.3 リソース階層
```yaml
# 基本的なCRUD
GET    /api/v1/projects           # 一覧取得
GET    /api/v1/projects/{id}      # 詳細取得
POST   /api/v1/projects           # 作成
PUT    /api/v1/projects/{id}      # 全体更新
PATCH  /api/v1/projects/{id}      # 部分更新
DELETE /api/v1/projects/{id}      # 削除

# ネストしたリソース
GET    /api/v1/projects/{id}/tasks
GET    /api/v1/projects/{id}/tasks/{taskId}
POST   /api/v1/projects/{id}/tasks

# カスタムアクション（動詞は最後に配置）
POST   /api/v1/projects/{id}/archive
POST   /api/v1/projects/{id}/activate
POST   /api/v1/timesheets/{id}/approve
```

#### 2.2 HTTPメソッド

##### 2.2.1 メソッド使用指針
| メソッド | 用途 | 冪等性 | 安全性 | レスポンスボディ |
|---------|------|--------|--------|----------------|
| GET | リソース取得 | ○ | ○ | あり |
| POST | リソース作成、アクション実行 | × | × | あり |
| PUT | リソース全体更新 | ○ | × | あり |
| PATCH | リソース部分更新 | ○ | × | あり |
| DELETE | リソース削除 | ○ | × | なし（204） |
| HEAD | メタデータ取得 | ○ | ○ | なし |
| OPTIONS | 許可メソッド取得 | ○ | ○ | あり |

##### 2.2.2 ステータスコード
| コード | 意味 | 使用場面 |
|--------|------|----------|
| **200** | OK | 成功（GET, PUT, PATCH） |
| **201** | Created | リソース作成成功（POST） |
| **202** | Accepted | 非同期処理受付 |
| **204** | No Content | 成功、レスポンスなし（DELETE） |
| **304** | Not Modified | キャッシュ有効 |
| **400** | Bad Request | 不正なリクエスト |
| **401** | Unauthorized | 認証エラー |
| **403** | Forbidden | 認可エラー |
| **404** | Not Found | リソース不存在 |
| **409** | Conflict | 競合（重複等） |
| **422** | Unprocessable Entity | バリデーションエラー |
| **429** | Too Many Requests | レート制限 |
| **500** | Internal Server Error | サーバーエラー |
| **503** | Service Unavailable | メンテナンス中 |

#### 2.3 リクエスト/レスポンス形式

##### 2.3.1 リクエストヘッダー
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer {jwt_token}
X-Request-ID: {uuid}
X-Client-Version: 1.0.0
Accept-Language: ja-JP
```

##### 2.3.2 レスポンス形式（成功時）
```json
{
  "data": {
    "id": "proj-123",
    "type": "project",
    "attributes": {
      "name": "新システム開発",
      "startDate": "2025-01-01",
      "endDate": "2025-12-31",
      "status": "active",
      "budget": 10000000
    },
    "relationships": {
      "manager": {
        "data": { "type": "employee", "id": "emp-456" }
      },
      "tasks": {
        "data": [
          { "type": "task", "id": "task-789" }
        ]
      }
    }
  },
  "meta": {
    "timestamp": "2025-08-23T12:34:56Z",
    "version": "1.0"
  }
}
```

##### 2.3.3 レスポンス形式（エラー時）
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力値が不正です",
    "details": [
      {
        "field": "startDate",
        "code": "INVALID_FORMAT",
        "message": "日付形式が正しくありません"
      }
    ],
    "traceId": "abc123-def456-ghi789",
    "timestamp": "2025-08-23T12:34:56Z"
  }
}
```

##### 2.3.4 ページネーション
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 100,
    "totalPages": 5
  },
  "links": {
    "self": "/api/v1/projects?page=1",
    "first": "/api/v1/projects?page=1",
    "prev": null,
    "next": "/api/v1/projects?page=2",
    "last": "/api/v1/projects?page=5"
  }
}
```

#### 2.4 フィルタリング・ソート・検索

##### 2.4.1 フィルタリング
```http
# 単一条件
GET /api/v1/projects?status=active

# 複数条件（AND）
GET /api/v1/projects?status=active&budget[gte]=1000000

# 複数値（OR）
GET /api/v1/projects?status=active,pending

# 範囲指定
GET /api/v1/projects?createdAt[gte]=2025-01-01&createdAt[lte]=2025-12-31

# ネストしたフィールド
GET /api/v1/projects?manager.department=engineering
```

##### 2.4.2 ソート
```http
# 昇順
GET /api/v1/projects?sort=name

# 降順
GET /api/v1/projects?sort=-createdAt

# 複数キー
GET /api/v1/projects?sort=-priority,name
```

##### 2.4.3 フィールド選択
```http
# 必要なフィールドのみ取得（Sparse Fieldsets）
GET /api/v1/projects?fields=id,name,status

# 関連リソースを含める
GET /api/v1/projects?include=manager,tasks
```

#### 2.5 冪等性（Idempotency）

##### 2.5.1 Idempotency-Key ヘッダー（POST/非同期アクション）
```http
Idempotency-Key: {uuid-v4}
```

- 目的: 二重送信による重複作成や重複課金の防止。
- 対象: POST 作成系エンドポイント、長時間実行の非同期アクション。
- 仕様:
  - 同一 `Idempotency-Key` + 同一認可主体 + 同一リクエストボディ の組み合わせは、一定期間（標準24時間）同一レスポンスを返却する。
  - サーバはキーとレスポンス内容のハッシュを保存し、競合は 409(CONFLICT) を返す。
  - 非同期受付時は 202(ACCEPTED) とジョブIDを返し、再送も同一ジョブIDを返却する。

##### 2.5.2 冪等性の実装指針
- 作成系: 事前生成ID方式（クライアント側で生成したリソースIDを使用）または Idempotency-Key テーブルでの重複制御。
- 更新系: PUT/PATCH はバージョン番号（`If-Match`/ETag）による楽観ロックと組み合わせる。
- 副作用のあるアクション: 冪等トークンを必須化し、実行履歴で重複抑止。

---

### 3. GraphQL API設計

#### 3.1 スキーマ設計

##### 3.1.1 基本構造
```graphql
schema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}

type Query {
  # 単一リソース取得
  project(id: ID!): Project
  
  # リスト取得（ページネーション付き）
  projects(
    filter: ProjectFilter
    sort: ProjectSort
    page: Int = 1
    perPage: Int = 20
  ): ProjectConnection!
}

type Mutation {
  # リソース作成
  createProject(input: CreateProjectInput!): CreateProjectPayload!
  
  # リソース更新
  updateProject(id: ID!, input: UpdateProjectInput!): UpdateProjectPayload!
  
  # リソース削除
  deleteProject(id: ID!): DeleteProjectPayload!
}

type Subscription {
  # リアルタイム更新
  projectUpdated(id: ID!): Project!
}
```

##### 3.1.2 型定義
```graphql
type Project {
  id: ID!
  name: String!
  description: String
  startDate: Date!
  endDate: Date!
  status: ProjectStatus!
  budget: Float
  manager: Employee!
  tasks(first: Int, after: String): TaskConnection!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum ProjectStatus {
  PLANNING
  ACTIVE
  ON_HOLD
  COMPLETED
  CANCELLED
}

input CreateProjectInput {
  name: String!
  description: String
  startDate: Date!
  endDate: Date!
  managerId: ID!
  budget: Float
}

type CreateProjectPayload {
  project: Project
  errors: [Error!]
}

type Error {
  field: String
  message: String!
}
```

#### 3.2 クエリ最適化

##### 3.2.1 DataLoader実装
```javascript
// N+1問題の解決
const projectLoader = new DataLoader(async (ids) => {
  const projects = await Project.findByIds(ids);
  return ids.map(id => projects.find(p => p.id === id));
});
```

##### 3.2.2 クエリ深度制限
```yaml
最大深度: 5
最大複雑度: 1000
タイムアウト: 30秒
```

---

### 4. 認証・認可

#### 4.1 認証方式

##### 4.1.1 JWT (JSON Web Token)
```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "key-id-123"
  },
  "payload": {
    "sub": "user-123",
    "name": "山田太郎",
    "email": "yamada@example.com",
    "roles": ["employee", "manager"],
    "permissions": ["project:read", "project:write"],
    "iat": 1692784256,
    "exp": 1692787856,
    "iss": "https://auth.itdo-erp.com",
    "aud": "https://api.itdo-erp.com"
  }
}
```

##### 4.1.2 OAuth 2.0フロー
```yaml
Authorization Code Flow:
  1. 認可リクエスト: GET /oauth/authorize
  2. ユーザー認証・認可
  3. 認可コード発行: redirect_uri?code=xxx
  4. トークン交換: POST /oauth/token
  5. アクセストークン取得
  6. API呼び出し: Authorization: Bearer {token}

Client Credentials Flow:
  - システム間連携用
  - POST /oauth/token with client_id & client_secret
```

#### 4.2 認可制御

##### 4.2.1 スコープベース認可
```yaml
スコープ定義:
  - project:read    # プロジェクト参照
  - project:write   # プロジェクト作成・更新
  - project:delete  # プロジェクト削除
  - timesheet:write # タイムシート入力
  - invoice:create  # 請求書作成
  - admin:all      # 管理者権限
```

##### 4.2.2 リソースレベル認可
```javascript
// 認可チェック例
async function canAccessProject(userId, projectId, action) {
  const user = await User.findById(userId);
  const project = await Project.findById(projectId);
  
  // オーナーチェック
  if (project.managerId === userId) return true;
  
  // チームメンバーチェック
  if (project.members.includes(userId) && action === 'read') return true;
  
  // ロールベースチェック
  if (user.roles.includes('admin')) return true;
  
  return false;
}
```

---

### 5. エラーハンドリング

#### 5.1 エラーコード体系

##### 5.1.1 エラーコード形式
```
{MODULE}_{CATEGORY}_{SPECIFIC}
```

##### 5.1.2 エラーコード例
| コード | 説明 | HTTPステータス |
|--------|------|---------------|
| AUTH_TOKEN_EXPIRED | トークン期限切れ | 401 |
| AUTH_INVALID_CREDENTIALS | 認証情報不正 | 401 |
| AUTHZ_PERMISSION_DENIED | 権限不足 | 403 |
| VALIDATION_REQUIRED_FIELD | 必須項目未入力 | 422 |
| VALIDATION_INVALID_FORMAT | 形式不正 | 422 |
| RESOURCE_NOT_FOUND | リソース不存在 | 404 |
| RESOURCE_ALREADY_EXISTS | リソース重複 | 409 |
| RATE_LIMIT_EXCEEDED | レート制限超過 | 429 |
| SYSTEM_INTERNAL_ERROR | 内部エラー | 500 |

#### 5.2 エラーレスポンス詳細

##### 5.2.1 標準エラーレスポンス
```json
{
  "error": {
    "code": "VALIDATION_INVALID_FORMAT",
    "message": "入力値の形式が正しくありません",
    "details": {
      "field": "email",
      "value": "invalid-email",
      "constraint": "email_format",
      "hint": "有効なメールアドレスを入力してください"
    },
    "metadata": {
      "traceId": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2025-08-23T12:34:56.789Z",
      "path": "/api/v1/users",
      "method": "POST"
    },
    "links": {
      "documentation": "https://docs.itdo-erp.com/errors/VALIDATION_INVALID_FORMAT",
      "support": "https://support.itdo-erp.com"
    }
  }
}
```

---

### 6. バージョニング

#### 6.1 バージョニング戦略

##### 6.1.1 URLパスバージョニング（推奨）
```http
GET /api/v1/projects
GET /api/v2/projects  # 新バージョン
```

##### 6.1.2 バージョニングポリシー
```yaml
メジャーバージョン（v1 → v2）:
  - 破壊的変更あり
  - 旧バージョンは最低1年間維持
  - 移行ガイド提供

マイナー変更:
  - 後方互換性維持
  - 新フィールド追加
  - 新エンドポイント追加
  - deprecation warning付与
```

#### 6.2 廃止予定（Deprecation）

##### 6.2.1 廃止通知
```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: 2026-12-31T23:59:59Z
Link: <https://docs.itdo-erp.com/migrations/v2>; rel="successor-version"
```

---

### 7. セキュリティ

#### 7.1 API セキュリティチェックリスト

##### 7.1.1 認証・認可
- ✅ すべてのエンドポイントで認証必須
- ✅ 最小権限の原則
- ✅ トークン有効期限設定（1時間）
- ✅ リフレッシュトークン実装

##### 7.1.2 通信セキュリティ
- ✅ HTTPS必須（TLS 1.3）
- ✅ HSTS有効化
- ✅ CORS適切設定

##### 7.1.3 入力検証
- ✅ すべての入力値検証
- ✅ SQLインジェクション対策
- ✅ XSS対策
- ✅ ファイルアップロード制限

##### 7.1.4 レート制限
```yaml
デフォルト制限:
  - 認証前: 10 req/min
  - 認証後: 100 req/min
  - バースト: 200 req/min

エンドポイント別:
  - GET: 1000 req/hour
  - POST/PUT/PATCH: 100 req/hour
  - DELETE: 50 req/hour
```

#### 7.2 監査ログ

##### 7.2.1 ログ記録項目
```json
{
  "timestamp": "2025-08-23T12:34:56.789Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-123",
  "method": "POST",
  "path": "/api/v1/projects",
  "statusCode": 201,
  "responseTime": 145,
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "body": "[FILTERED]"  // 機密情報はマスク
}
```

---

### 8. パフォーマンス最適化

#### 8.1 キャッシング

##### 8.1.1 キャッシュヘッダー
```http
# 静的リソース
Cache-Control: public, max-age=31536000, immutable

# 動的リソース（プライベート）
Cache-Control: private, max-age=0, must-revalidate
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"

# 条件付きリクエスト
If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"
```

##### 8.1.2 CDN設定
```yaml
CloudFront設定:
  - APIエンドポイント: キャッシュなし
  - 静的アセット: 1年キャッシュ
  - 地理的分散: 東京、大阪、福岡
```

#### 8.2 圧縮

```http
# リクエスト
Accept-Encoding: gzip, deflate, br

# レスポンス
Content-Encoding: gzip
```

---

### 9. API ドキュメント

#### 9.1 OpenAPI仕様

##### 9.1.1 基本構造
```yaml
openapi: 3.0.3
info:
  title: ITDO ERP API
  version: 1.0.0
  description: Enterprise Resource Planning System API
  contact:
    email: api-support@itdo.jp
  license:
    name: Proprietary
servers:
  - url: https://api.itdo-erp.com/v1
    description: Production
  - url: https://api-staging.itdo-erp.com/v1
    description: Staging
security:
  - bearerAuth: []
paths:
  /projects:
    get:
      summary: プロジェクト一覧取得
      operationId: listProjects
      tags:
        - Projects
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [active, completed, on_hold]
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProjectList'
```

#### 9.2 開発者ポータル

##### 9.2.1 提供コンテンツ
- APIリファレンス（Swagger UI）
- 認証ガイド
- クイックスタート
- SDKダウンロード
- サンプルコード
- 変更履歴
- ステータスページ

---

### 10. テスト

#### 10.1 APIテスト戦略

##### 10.1.1 テストレベル
```yaml
単体テスト:
  - 各エンドポイントの個別テスト
  - モック使用
  - カバレッジ80%以上

統合テスト:
  - エンドツーエンドフロー
  - 実データベース使用
  - 認証フロー含む

契約テスト:
  - Consumer-Driven Contract
  - Pact使用

負荷テスト:
  - JMeter/K6使用
  - 目標: 1000 req/sec
```

##### 10.1.2 テストデータ
```json
{
  "testUsers": [
    {
      "id": "test-admin",
      "roles": ["admin"],
      "token": "eyJ..."
    },
    {
      "id": "test-user",
      "roles": ["employee"],
      "token": "eyJ..."
    }
  ]
}
```

---

### 11. SDK/クライアントライブラリ

#### 11.1 提供言語

##### 11.1.1 公式SDK
- JavaScript/TypeScript (npm)
- Python (pip)
- Java (Maven)
- Go (go modules)

##### 11.1.2 SDK実装例（TypeScript）
```typescript
import { ITDOERPClient } from '@itdo/erp-sdk';

const client = new ITDOERPClient({
  apiKey: process.env.ITDO_API_KEY,
  baseURL: 'https://api.itdo-erp.com/v1'
});

// プロジェクト一覧取得
const projects = await client.projects.list({
  status: 'active',
  page: 1,
  perPage: 20
});

// プロジェクト作成
const newProject = await client.projects.create({
  name: '新規プロジェクト',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  managerId: 'emp-123'
});

// エラーハンドリング
try {
  await client.projects.delete('proj-999');
} catch (error) {
  if (error.code === 'RESOURCE_NOT_FOUND') {
    console.error('プロジェクトが見つかりません');
  }
}
```

---

### 12. WebSocket API

#### 12.1 リアルタイム通信

##### 12.1.1 接続確立
```javascript
const ws = new WebSocket('wss://ws.itdo-erp.com/v1/stream');

ws.on('open', () => {
  // 認証
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'Bearer eyJ...'
  }));
  
  // サブスクリプション
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['projects.123', 'notifications']
  }));
});
```

##### 12.1.2 メッセージ形式
```json
{
  "type": "event",
  "channel": "projects.123",
  "event": "updated",
  "data": {
    "id": "proj-123",
    "status": "completed",
    "updatedAt": "2025-08-23T12:34:56Z"
  }
}
```

---

### 13. 実装チェックリスト

#### 13.1 開発時確認事項

- [ ] OpenAPI仕様書作成
- [ ] 認証・認可実装
- [ ] 入力値バリデーション
- [ ] エラーハンドリング
- [ ] レート制限実装
- [ ] ログ記録
- [ ] ユニットテスト作成
- [ ] 統合テスト作成
- [ ] パフォーマンステスト
- [ ] セキュリティテスト
- [ ] ドキュメント作成
- [ ] SDK生成・公開

---

### 改訂履歴

| 版数 | 日付 | 変更内容 | 承認者 |
|------|------|---------|--------|
| 1.0 | 2025-08-23 | 初版作成 | - |

---

*本仕様書は、API設計の標準ガイドラインです。実装時は最新のセキュリティ要件と技術動向を確認してください。*
