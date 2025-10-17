# CKMチャット基礎設計 / 実装計画（Issue #318）

## 1. 背景と目的
- Issue #316 でまとめた CKM（Collaboration & Knowledge Module）チャット仕様は要求レベルに留まっており、実装計画・設計が欠落している。
- 現行コードベース（`services/project-api`）にはプロジェクトチャット要約 PoC のみが存在し、CKM モジュールとしての会話データ構造・権限制御・検索・外部連携が未整備。
- 本ドキュメントは `PlanS/ckm_module_spec.md` を源泉に、実装タスクへ落とし込める具体設計（データモデル、API、ACL、パイプライン、移行、運用）を提示する。

## 2. 現状整理とギャップ分析

### 2.1 仕様要求の要点（`PlanS/ckm_module_spec.md` 抜粋）
- チャット種別：1対1・グループ・チャンネル・一時的ルーム／スレッド。
- メッセージ機能：テキスト、添付、引用、返信、転送、メンション、緊急通知、編集／削除履歴。
- 通知：リアルタイム、メール／プッシュ、重要度、ユーザーごとの通知設定。
- 連携：タスク化、ファイル共有、ビデオ会議、外部チャット（Chatwork/Teams）接続。
- 検索：全文／メタデータ／ファセット／Embedding 類似検索／履歴保存。
- 運用：アクセス権限、監査ログ、移行、SLA（通知1秒以内、チャットログ2年保管）。

### 2.2 現行実装サマリ（2024-XX 時点）
- NestJS `services/project-api` にプロジェクト用チャットサマリ・検索 API が存在するが、CKM 用データテーブルや GraphQL Schema は未定義。
- Prisma は SQLite を使用、`ChatThread`・`ChatMessage` はプロジェクトスコープに限定され CKM 仕様の大半をカバーできない。
- ACL はモジュール単位の抽象設計のみで、チャット専用のロール／ポリシーは未実装。
- Embedding 処理は `shared/ai/chat-summary.ts` のプロジェクト要約向けロジックに留まり、メッセージ単位の更新フローがない。

### 2.3 ギャップ一覧

| 観点 | 仕様要求 | 現行状態 | ギャップ/対応方針 |
|------|----------|----------|--------------------|
| データモデル | ルーム／メッセージ／スレッド／添付／反応／ACL／ログ | Project 用スレッドのみ | CKM 専用スキーマを追加、マルチワークスペース・履歴管理を設計 |
| API/GraphQL | ルーム/スレッド CRUD、投稿、検索、連携 API | REST/GraphQL ともに未提供 | GraphQL + REST の合同 API セットを定義し NestJS モジュール化 |
| 権限/ACL | ユーザー/チーム/ロール別アクセス、継承、招待 | 実装なし | ワークスペース／ルーム単位のロール管理とガードを追加 |
| 検索/Embedding | ベクトル DB、インデックス更新、pgvector | Chat サマリ用のみ | メッセージ毎の埋め込み生成・再計算パイプラインを新設 |
| タスク連携 | メッセージ→タスク化・相互リンク | 連携なし | Project/CRM タスク API との結合 DTO／イベントを設計 |
| 通知/リアルタイム | WebSocket/SSE、外部通知、優先度制御 | 機能なし | WS ゲートウェイと通知ワーカーを実装、設定モデルを追加 |
| 外部移行 | Chatwork/ClickUp 移行、整合性チェック | 仕組みなし | ETL パイプラインと検証手順を定義、Dry-run CLI を準備 |
| メトリクス | 投稿数・応答時間・通知 SLA 等 | Datadog メトリクス一部のみ | CKM 専用メトリクスとダッシュボードを設計 |

## 3. アーキテクチャ方針
- **アプリ層**: 既存 `services/project-api` に `ckm` モジュールを追加し GraphQL/REST を提供。将来的なスケールアウトに備えてモジュール境界（service/repository/event 層）を明確化。
- **リアルタイム層**: NestJS Gateway（WebSocket/SSE）を `services/project-api/src/ckm/realtime` に配置。Redis Pub/Sub をバックプレーンに採用し多ノード対応。
- **データ層**: CKM スキーマは PostgreSQL + pgvector を前提。現行 SQLite はチャット高負荷に不適なため、`DATABASE_URL` を CKM 用に分離（`DATABASE_CKM_URL`）し Prisma を複数データソース構成にする。
- **ジョブ／パイプライン**: BullMQ（Redis）ベースのワーカー `ckm-message-pipeline` を追加し、メッセージ保存イベントから埋め込み生成・通知送出・外部連携を非同期化。
- **統合**: タスク連携は REST 経由で `projects` / `crm` モジュールへ連絡。イベントバス（例: NATS JetStream or Redis Streams）で疎結合化し、双方向リンクを維持。
- **監査／ログ**: すべての重要操作（作成・編集・削除・転送）を監査テーブルに記録し、Datadog へ structured log を送出。

## 4. データモデル設計

### 4.1 エンティティ概要

| モデル | 主キー | 役割 / 主な属性 |
|--------|--------|------------------|
| `CkmWorkspace` | `id` | 部門/プロジェクト単位のコラボ空間。`code`, `type`, `defaultRole`, `archivedAt` |
| `CkmWorkspaceMembership` | `id` | ユーザー/チームの参加情報。`memberType`, `memberId`, `role`, `invitedBy`, `status`, `notificationLevel` |
| `CkmChatRoom` | `id` | チャットルーム。`workspaceId`, `roomType (direct/group/topic/broadcast)`, `title`, `topic`, `isPrivate`, `ownerId`, `pinnedMessageId` |
| `CkmRoomMember` | `id` | ルーム別権限。`roomRole`, `mutedUntil`, `lastReadMessageId` |
| `CkmChatThread` | `id` | スレッド/会話。`roomId`, `rootMessageId`, `title`, `status`, `linkedTaskId`, `summary`, `summaryEmbedding` |
| `CkmChatMessage` | `id` | メッセージ本体。`threadId`, `roomId`, `authorId`, `body`, `bodyRich`, `messageType`, `mentionsJson`, `priority`, `postedAt`, `editedAt`, `deletedAt` |
| `CkmMessageVersion` | `id` | 編集履歴。`messageId`, `version`, `body`, `diff` |
| `CkmMessageAttachment` | `id` | 添付メタ情報。`messageId`, `objectStorageKey`, `fileName`, `fileSize`, `mimeType` |
| `CkmMessageReaction` | `id` | リアクション。`messageId`, `emoji`, `actorId` |
| `CkmMessageTaskLink` | `id` | タスク連携。`messageId`, `taskSystem (pm/crm/hr)`, `taskId`, `direction` |
| `CkmMessageEmbedding` | `messageId` | pgvector。`embedding`, `provider`, `lastReindexedAt`, `semanticVersion` |
| `CkmNotificationSetting` | `id` | ユーザー別通知設定。`channel (app/email/push)`, `level`, `quietHours`, `digest` |
| `CkmAuditLog` | `id` | 操作履歴。`actorId`, `action`, `resourceType`, `resourceId`, `payload`, `occurredAt` |

### 4.2 Prisma スキーマ案

```prisma
// datasource db { provider = "postgresql" url = env("DATABASE_CKM_URL") }

enum CkmWorkspaceRole {
  OWNER
  ADMIN
  MAINTAINER
  MEMBER
  GUEST
  EXTERNAL
}

enum CkmRoomType {
  DIRECT
  GROUP
  TOPIC
  BROADCAST
}

enum CkmRoomRole {
  OWNER
  MODERATOR
  PARTICIPANT
  VIEWER
}

enum CkmMessageType {
  TEXT
  SYSTEM
  FILE
  TASK
  ANNOUNCEMENT
}

model CkmWorkspace {
  id           String                   @id @default(cuid())
  code         String                   @unique
  name         String
  type         String                   @default("team")
  description  String?
  defaultRole  CkmWorkspaceRole         @default(MEMBER)
  isPrivate    Boolean                  @default(false)
  archivedAt   DateTime?
  createdAt    DateTime                 @default(now())
  updatedAt    DateTime                 @updatedAt

  rooms        CkmChatRoom[]
  memberships  CkmWorkspaceMembership[]
}

model CkmWorkspaceMembership {
  id                String             @id @default(cuid())
  workspaceId       String
  memberType        String             // user / group / external_account
  memberId          String
  role              CkmWorkspaceRole
  status            String             @default("active") // invited / pending / suspended
  invitedBy         String?
  notificationLevel String             @default("all")
  lastSeenAt        DateTime?
  createdAt         DateTime           @default(now())

  workspace         CkmWorkspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  roomMemberships   CkmRoomMember[]

  @@unique([workspaceId, memberType, memberId])
}

model CkmChatRoom {
  id              String          @id @default(cuid())
  workspaceId     String
  roomType        CkmRoomType
  title           String
  topic           String?
  ownerMembership String
  isPrivate       Boolean         @default(false)
  pinnedMessageId String?
  archivedAt      DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  workspace       CkmWorkspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  members         CkmRoomMember[]
  threads         CkmChatThread[]
  messages        CkmChatMessage[]
}

model CkmRoomMember {
  id              String            @id @default(cuid())
  roomId          String
  workspaceMember String
  roomRole        CkmRoomRole       @default(PARTICIPANT)
  lastReadMessage String?
  mutedUntil      DateTime?
  notificationLevel String         @default("inherit")
  createdAt       DateTime          @default(now())

  room            CkmChatRoom       @relation(fields: [roomId], references: [id], onDelete: Cascade)
  membership      CkmWorkspaceMembership @relation(fields: [workspaceMember], references: [id], onDelete: Cascade)

  @@unique([roomId, workspaceMember])
}

model CkmChatThread {
  id               String            @id @default(cuid())
  roomId           String
  rootMessageId    String?
  title            String?
  status           String            @default("open") // open / resolved / archived
  linkedTaskSystem String?
  linkedTaskId     String?
  summary          String?
  summaryEmbedding Unsupported("vector(1536)")?
  summaryUpdatedAt DateTime?

  room             CkmChatRoom       @relation(fields: [roomId], references: [id], onDelete: Cascade)
  messages         CkmChatMessage[]
}

model CkmChatMessage {
  id              String            @id @default(cuid())
  roomId          String
  threadId        String?
  parentMessageId String?
  authorId        String
  messageType     CkmMessageType    @default(TEXT)
  priority        Int               @default(0) // 0=normal, 1=high
  body            String
  bodyRich        Json?
  mentionsJson    Json?
  metadataJson    Json?
  postedAt        DateTime          @default(now())
  editedAt        DateTime?
  deletedAt       DateTime?
  version         Int               @default(1)

  room            CkmChatRoom       @relation(fields: [roomId], references: [id], onDelete: Cascade)
  thread          CkmChatThread?    @relation(fields: [threadId], references: [id], onDelete: SetNull)
  parentMessage   CkmChatMessage?   @relation("MessageThread", fields: [parentMessageId], references: [id], onDelete: SetNull)
  replies         CkmChatMessage[]  @relation("MessageThread")
  versions        CkmMessageVersion[]
  attachments     CkmMessageAttachment[]
  reactions       CkmMessageReaction[]
  taskLinks       CkmMessageTaskLink[]
  embedding       CkmMessageEmbedding?
}

model CkmMessageVersion {
  id         String   @id @default(cuid())
  messageId  String
  version    Int
  body       String
  diff       Json?
  editedBy   String
  editedAt   DateTime @default(now())

  message    CkmChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@unique([messageId, version])
}

model CkmMessageAttachment {
  id               String   @id @default(cuid())
  messageId        String
  objectStorageKey String
  fileName         String
  fileSize         Int
  mimeType         String
  checksum         String?
  uploadedBy       String
  createdAt        DateTime @default(now())

  message          CkmChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
}

model CkmMessageReaction {
  id         String   @id @default(cuid())
  messageId  String
  actorId    String
  emoji      String
  createdAt  DateTime @default(now())

  message    CkmChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@unique([messageId, actorId, emoji])
}

model CkmMessageTaskLink {
  id           String   @id @default(cuid())
  messageId    String
  taskSystem   String   // pm / crm / hr / external
  taskId       String
  direction    String   @default("message_to_task") // or task_to_message
  createdBy    String
  createdAt    DateTime @default(now())

  message      CkmChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
}

model CkmMessageEmbedding {
  messageId       String   @id
  embedding       Unsupported("vector(1536)")
  provider        String   @default("openai")
  model           String   @default("text-embedding-3-small")
  lastReindexedAt DateTime @default(now())
  status          String   @default("ready") // pending / failed / ready
  attempts        Int      @default(0)

  message         CkmChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
}

model CkmNotificationSetting {
  id            String   @id @default(cuid())
  memberId      String
  channel       String   // in_app / email / push
  level         String   @default("mentions") // all / mentions / mute
  quietHours    Json?
  digest        Json?
  updatedAt     DateTime @updatedAt
}

model CkmAuditLog {
  id           String   @id @default(cuid())
  actorId      String
  workspaceId  String?
  roomId       String?
  action       String
  resourceType String
  resourceId   String
  payload      Json?
  occurredAt   DateTime @default(now())

  @@index([resourceType, resourceId])
  @@index([actorId, occurredAt])
}
```

### 4.3 リレーション／インデックス設計
- 主要検索キー：`CkmChatMessage.roomId+postedAt`, `CkmChatThread.roomId+status`, `CkmRoomMember.membership`。
- pgvector 拡張を有効化 (`CREATE EXTENSION IF NOT EXISTS vector;`)。`CkmMessageEmbedding` に HNSW インデックスを作成。
- ログ・監査用途向けに `CkmAuditLog` は日時降順クラスタインデックスを付与し、データ保持ポリシー（24 か月）を設定。

### 4.4 マイグレーションと整合性
- 既存 Prisma スキーマを分割し、`schema.prisma` に CKM 用 datasource を追加。`npx prisma migrate dev --schema prisma/ckm.prisma` で独立適用。
- SQLite → PostgreSQL への移行は CKM モジュール追加時に行い、既存 `Project` モジュールは段階的に Postgres へ移行予定。
- 行ロック／同時編集競合を防ぐため、メッセージ更新 API では `version` を用いた楽観ロックを適用。

## 5. API 設計

### 5.1 GraphQL スキーマ案
```graphql
type CkmStatus {
  enabled: Boolean!
}

type CkmMessage {
  id: ID!
  roomId: ID!
  threadId: ID
  parentMessageId: ID
  authorId: String!
  messageType: CkmMessageType!
  priority: Int!
  body: String!
  bodyRich: String
  mentions: [String!]
  metadataJson: String
  postedAt: String!
}

type CkmWorkspaceSummary {
  id: ID!
  code: String!
  name: String!
  type: String!
  description: String
  defaultRole: CkmWorkspaceRole!
  isPrivate: Boolean!
  archivedAt: String
  createdAt: String!
  updatedAt: String!
  roomCount: Int!
  memberCount: Int!
}

type CkmWorkspace {
  id: ID!
  code: String!
  name: String!
  type: String!
  isPrivate: Boolean!
  rooms(first: Int, after: String): CkmChatRoomConnection!
}

type CkmChatRoom {
  id: ID!
  roomType: CkmRoomType!
  title: String!
  topic: String
  members: [CkmRoomMember!]!
  threads(first: Int, after: String, status: [String!]): CkmChatThreadConnection!
}

type CkmChatThread {
  id: ID!
  status: String!
  linkedTask: CkmTaskLink
  rootMessage: CkmChatMessage
  messages(first: Int, after: String): CkmChatMessageConnection!
  summary: String
}

type Mutation {
  createWorkspace(input: CreateWorkspaceInput!): CkmWorkspace!
  inviteWorkspaceMember(input: InviteWorkspaceMemberInput!): CkmWorkspaceMembership!
  createRoom(input: CreateRoomInput!): CkmChatRoom!
  postMessage(input: PostMessageInput!): CkmChatMessage!
  updateMessage(input: UpdateMessageInput!): CkmChatMessage!
  addReaction(messageId: ID!, emoji: String!): CkmChatMessage!
  linkTask(input: LinkTaskInput!): CkmMessageTaskLink!
  postCkmMessage(input: PostMessageInput!, authorId: ID!): CkmMessage!
  updateCkmMessage(input: UpdateMessageInput!, editorId: ID!): CkmMessage!
  deleteCkmMessage(workspaceCode: String!, messageId: ID!, actorId: ID!): Boolean!
}

type Query {
  ckmWorkspaces: [CkmWorkspaceSummary!]!
  ckmStatus: CkmStatus!
  ckmWorkspace(code: String!): CkmWorkspace
  ckmRoom(id: ID!): CkmChatRoom
  ckmMessageSearch(workspaceCode: String!, keyword: String!, roomId: ID, limit: Int): [CkmMessage!]!
}
```
- DTO は `class-transformer` / `class-validator` でバリデーション。`PostMessageInput` には `threadId` or `parentMessageId` のいずれかを指定（XOR）すると同時に、`authorId` は GraphQL では引数、REST ではボディで受け取る。
- GraphQL Resolver は `@UseGuards(CkmAclGuard)` を通過し、Workspace/Room 権限を検証。`ckmMessageSearch` は当初テキスト検索を提供し、Embedding 連携後に置き換える。
- `CkmNotificationService` が `ckm.message.created/updated/deleted` を発行し、当面はログ出力に留めつつ、次フェーズで WebSocket/SSE 配信へ置換する。

### 5.2 REST エンドポイント

| メソッド | パス | 説明 | 認可 |
|----------|------|------|------|
| `GET` | `/api/v1/ckm/workspaces` | 所属ワークスペース一覧 | ログイン済み |
| `GET` | `/api/v1/ckm/workspaces/:code` | ワークスペース詳細（ルーム含む） | メンバー |
| `POST` | `/api/v1/ckm/workspaces` | ワークスペース作成 | `workspace_admin` 以上 |
| `POST` | `/api/v1/ckm/workspaces/:code/members` | 招待／ロール変更 | `workspace_admin` 以上 |
| `GET` | `/api/v1/ckm/workspaces/:code/rooms` | ルーム一覧 | メンバー |
| `POST` | `/api/v1/ckm/workspaces/:code/rooms` | ルーム作成 | `maintainer` 以上 |
| `GET` | `/api/v1/ckm/rooms/:roomId/messages` | メッセージページング取得 | ルーム参加者 |
| `POST` | `/api/v1/ckm/messages` | メッセージ投稿（Author 指定） | ルーム参加者 |
| `PATCH` | `/api/v1/ckm/messages/:id` | 編集（楽観ロック） | 投稿者 or モデレーター |
| `DELETE` | `/api/v1/ckm/messages/:id` | ソフト削除 | 投稿者 or モデレーター |
| `POST` | `/api/v1/ckm/messages/:id/reactions` | リアクション追加 | ルーム参加者 |
| `POST` | `/api/v1/ckm/messages/:id/task-link` | タスク化／リンク | `maintainer` 以上 |
| `GET` | `/api/v1/ckm/messages/search` | テキスト検索（Embedding 連携予定） | メンバー |
| `GET` | `/api/v1/ckm/realtime/stream` | SSE ストリーム購読（workspaceId/roomId で絞込可） | ログイン済み |
| `GET` | `/api/v1/ckm/export/:roomId` | 監査用エクスポート（NDJSON） | `workspace_admin` |
| `GET` | `/api/v1/ckm/status` | CKM データストアの接続状態 | ログイン済み |

### 5.3 エラーハンドリング・ペイロード
- HTTP 409：楽観ロック失敗（`version` ミスマッチ）。
- HTTP 423：アーカイブ済み／権限がないルームへの書き込み禁止。
- 監査用途で `X-Request-ID` を受け取り、`CkmAuditLog` に保持。
- WebSocket/SSE は `/api/v1/ckm/ws`（WS）／`/api/v1/ckm/events`（SSE）を提供、JWT ベースで認証。

## 6. 権限／ACL 設計

### 6.1 ロール定義

| ロール | 権限概要 |
|--------|----------|
| `OWNER` | ワークスペース作成者。全操作 + ロール変更 |
| `ADMIN` | メンバー管理、ルーム設定変更、監査エクスポート |
| `MAINTAINER` | ルーム作成、通知設定、タスク連携 |
| `MEMBER` | ルーム参加、投稿、検索、既存タスク参照 |
| `GUEST` | 読み取り + コメント（指定ルームのみ） |
| `EXTERNAL` | 外部ユーザー。専用ルーム閲覧／投稿のみ |

- ルームごとに `OWNER/MODERATOR/PARTICIPANT/VIEWER` を設定し、権限を上書き。例: `EXTERNAL` でも特定ルームでは `PARTICIPANT` として投稿可能。
- ACL 実装方針：NestJS Guard (`CkmAclGuard`) で **Workspace Role → Room Role → メッセージオーナー** の順に判定。
- 招待フロー：`status=pending` のメンバーは閲覧不可。承認後 `status=active` に更新。
- 監査／コンプライアンス要求に合わせて `CkmAuditLog` に操作を保存し、必要に応じて `PlanS/system_integration_spec.md` の統合ロール（`ckm:admin/use/hr` 等）とマッピング。

### 6.2 通知ポリシー
- `CkmNotificationSetting` により各チャンネルの通知レベルを保持。`mutedUntil` を設定すると一時停止。
- メンション時は `notificationLevel=mentions` 以上に達しないユーザーも強制でリアルタイム通知を受信。

## 7. 検索・Embedding パイプライン
- **イベント起点**: `postMessage` / `updateMessage` / `deleteMessage` で `CkmMessageCreated` 等のドメインイベントを発行。
- **ジョブ処理**:
  1. 省略可の要約（5行まで）を `shared/ai/chat-summary` を拡張した `CkmMessageSummarizer` で生成（高優先度メッセージのみ）。
  2. OpenAI `text-embedding-3-small` 既定、失敗時は `retry`（指数バックオフ上限 5 回）。保留状態は `status=pending`。
  3. Embedding を `CkmMessageEmbedding` に保存し、pgvector HNSW インデックスへ反映。
- **検索 API** は以下のステップを実行:
  - `topK` ベクトル検索（Min Score 0.25）。スコア低下時は trigram or `ILIKE` でフォールバック。
  - ルーム ACL を考慮したフィルタ（`roomId` in permitted rooms）。
  - ハイライト生成は PostgreSQL `ts_headline`（フォールバック: simple substring）。
- **再インデックス**:
  - `scripts/ckm/reindex-embeddings.ts --workspace <code>` でバッチ実行。
  - バージョン管理：`semanticVersion` でモデル更新時に差分を検出し再計算。

## 8. タスク連携仕様
- **メッセージからタスク化**:
  1. `POST /api/v1/ckm/messages/:id/task-link` で DTO `{ targetSystem, targetId?, title, description, dueDate }` を受け取る。
  2. `targetId` が未指定の場合は `projects` or `crm` API を呼び出しタスクを作成。作成結果を `CkmMessageTaskLink` に保存。
  3. 双方向リンク用に対象タスクへ `ckmMessageId` メタデータを保存。
- **タスクからチャットへ引用**:
  - `PATCH /projects/tasks/:id` 側で `ckmMessageId` が渡された場合、該当メッセージへ `direction=task_to_message` のリンクを作成。
- **UI/UX**:
  - メッセージ hover で「タスク化」ボタン。フォームでは担当者/期限/相手システムを選択。
  - タスク更新（ステータス変更など）は `ckm.task.updated` イベントとしてルームへ通知（リアクション）。
- **トレース**: 監査ログに `action=task_link.created`／`task_link.removed` を記録。

## 9. 通知・リアルタイム通信
- **コネクション**: WebSocket（優先）と SSE（フォールバック）。JWT（`ckm:ws` scope）で認証し、接続時に購読ルーム ID を渡す。
- **イベント種別**:
  - `room.created`, `room.archived`
  - `message.created`, `message.updated`, `message.deleted`, `message.reaction_changed`
  - `thread.status_changed`
  - `notification.deliver`（メール/プッシュ送信結果）
  - `task.linked`
- **配信制御**:
- 現行実装では `CkmNotificationService` が `ckm.message.created/updated/deleted` を発火し、`CkmRealtimeService` を経由して SSE (`/api/v1/ckm/realtime/stream`) と WebSocket (`ws://.../ckm`) へイベントを配信する。Redis Stream (`CKM_REDIS_URL`) を設定すると多ノード配信に対応し、未設定時は単一ノード内で Subject を利用する。
  - `priority>0` のメッセージは「緊急」扱い。通知ワーカーが即時メール + モバイルプッシュを送信（今後の実装）。
- **ユーザー設定**:
  - `CkmNotificationSetting` で Quiet Hours。`digest.enabled` なら 1 日単位のまとめメールを送信。
- **外部通知**:
  - Slack/Teams Webhook をルーム単位で登録可能。`message.created` イベントを JSON payload として送信し、署名で検証。

## 10. 外部移行計画（Chatwork / ClickUp）

### 10.1 データマッピング

| Chatwork/ClickUp | CKM 対応 | 備考 |
|------------------|----------|------|
| チャットルーム（Chatwork グループ/ClickUp スペース） | `CkmWorkspace` or `CkmChatRoom` | 複数組織では Workspace → Room を二分 |
| メンバー（role） | `CkmWorkspaceMembership.role` | `admin`→`ADMIN`, `member`→`MEMBER`, `guest`→`EXTERNAL` |
| メッセージ本文/添付 | `CkmChatMessage` / `CkmMessageAttachment` | HTML → Markdown 正規化、添付は S3 へ転送 |
| スレッド（日付/返信） | `CkmChatThread` / `parentMessageId` | 返信チェーンを辿り root message を識別 |
| タスクリンク（ClickUp タスクID） | `CkmMessageTaskLink` | `taskSystem="clickup"` として保存、後続で `projects` タスクへリマップ |

### 10.2 プロセス
1. **抽出**: 提供 API から JSON エクスポート。Rate Limit 対応でバックオフ。
2. **変換**: 文字コード・改行・メンション形式を CKM 仕様に統一。ユーザー ID マッピングテーブルを用意。
3. **検証**: Dry-run CLI `scripts/ckm/import-chatwork.ts --dry-run` で件数・ハッシュを確認。
4. **ロード**: 本番実行。スループット確保のため `COPY` or `INSERT ... ON CONFLICT` を使用。
5. **整合性確認**: メッセージ件数、添付チェックサム、タスクリンク一致率（>=99%）を検証。
6. **ロールバックプラン**: 読み取り専用フラグで旧システムを一定期間保持。差異が出た場合 `CkmAuditLog` と比較。

## 11. メトリクス / ダッシュボード設計
- **Datadog メトリクス**:
  - `ckm.chat.message_created`, `ckm.chat.message_edited`, `ckm.chat.message_deleted`
  - `ckm.chat.ws.connections.active`, `ckm.chat.ws.events.delivered`, `ckm.chat.ws.events.dropped`
  - `ckm.chat.notifications.sent`（タグ：`channel:email|push|app`, `priority:normal|high`）
  - `ckm.chat.embedding.success`, `ckm.chat.embedding.failure`, `ckm.chat.embedding.duration_ms`
  - `ckm.chat.search.success_rate`, `ckm.chat.search.latency_ms`
  - `ckm.chat.response_time_seconds`（質問→初回応答時間）
- **ログ構造**: `logger=ckm`、`eventType` を付与。監査用途は `audit.ckm` チャンネルに出力。
- **ダッシュボード**: `docs/monitoring/ckm-chat-dashboard.json` を新設し、SLA（通知 1 秒以内、検索成功率 97%）を監視。
- **アラート**:
  - Embedding 失敗率 >5%（5 分平均）で当番に PagerDuty。
  - WS ドロップ率 >2% で自動スケール通知。
  - 応答時間 SLA 未達で `ckm.chat.response_time_seconds` アラート。

## 12. 実装ロードマップとテスト戦略

| フェーズ | 期間目安 | 主タスク | テスト |
|----------|----------|----------|--------|
| Phase 0: 基盤整備 | 1 sprint | Postgres 導入、Prisma 分割、Workspace/Room CRUD | Prisma migration test、Unit test（Repository） |
| Phase 1: メッセージ MVP | 1 sprint | メッセージ投稿・編集・リアルタイム配信、ACL 実装 | Jest + Supertest、GraphQL resolver test、WS integration test |
| Phase 2: 検索・Embedding | 1 sprint | BullMQ ワーカー、pgvector インデックス、検索 API | Pipeline unit test、E2E（embedding 再試行）、負荷テスト |
| Phase 3: タスク連携・通知 | 1 sprint | タスクリンク API、外部通知、設定 UI API | Contract test（projects/crm）、通知モックテスト |
| Phase 4: 移行 & 運用 | 1 sprint | Import CLI、メトリクス/ダッシュボード、Runbook | Dry-run test、データ整合性チェック、Chaos test（WS drop） |

- CI には `npm run test:ckm`（Unit/E2E）と `npm run lint -- ckmmodule` を追加。
- Playwright で UI PoC（`ui-poc`）と連動し、リアルタイム差分を検証。

## 13. リスクと未決事項
- **DB 分離**: Postgres への移行が前提。既存 SQLite との共存期間中に参照整合性を保つため、接続管理とトランザクション境界を整理する必要がある。
- **組織ディレクトリ統合**: `memberId` をどの ID 管理（HR/IDP）に紐付けるか確定が必要。SSO/SCIM 対応を別タスクで調整。
- **外部通知**: Slack/Teams Webhook のレート制限、認証方式の確認。
- **セキュリティ**: メッセージ暗号化や DLP 要件は別仕様として検討中。将来の暗号化導入を見越し、添付ファイルは KMS 暗号化 S3 Bucket を使用。
- **AI 依存**: Embedding/Summary で OpenAI を利用するが、リージョン制約やコスト最適化のため Azure OpenAI/Falcon 等への切替をオプションに保持。

---

本設計に基づき実装すれば Issue #318 のチェックリスト（仕様ギャップ洗い出し、データモデル、API、ACL、検索パイプライン、タスク連携、通知方式、外部移行、メトリクス定義）を網羅できる。次フェーズではフェーズ別タスクを Jira/GitHub Projects に起票し、優先度順に実装へ移行する。
