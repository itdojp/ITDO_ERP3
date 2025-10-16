-- CKM 初期マイグレーション

CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TYPE "CkmWorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MAINTAINER', 'MEMBER', 'GUEST', 'EXTERNAL');
CREATE TYPE "CkmRoomType" AS ENUM ('DIRECT', 'GROUP', 'TOPIC', 'BROADCAST');
CREATE TYPE "CkmRoomRole" AS ENUM ('OWNER', 'MODERATOR', 'PARTICIPANT', 'VIEWER');
CREATE TYPE "CkmMessageType" AS ENUM ('TEXT', 'SYSTEM', 'FILE', 'TASK', 'ANNOUNCEMENT');

CREATE TABLE "CkmWorkspace" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'team',
  "description" TEXT,
  "defaultRole" "CkmWorkspaceRole" NOT NULL DEFAULT 'MEMBER',
  "isPrivate" BOOLEAN NOT NULL DEFAULT FALSE,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE TABLE "CkmWorkspaceMembership" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "memberType" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "role" "CkmWorkspaceRole" NOT NULL DEFAULT 'MEMBER',
  "status" TEXT NOT NULL DEFAULT 'active',
  "invitedBy" TEXT,
  "notificationLevel" TEXT NOT NULL DEFAULT 'all',
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "CkmWorkspaceMembership_workspaceId_memberType_memberId_key"
    UNIQUE ("workspaceId", "memberType", "memberId"),
  CONSTRAINT "CkmWorkspaceMembership_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "CkmWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CkmChatRoom" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "roomType" "CkmRoomType" NOT NULL,
  "title" TEXT NOT NULL,
  "topic" TEXT,
  "ownerMembershipId" TEXT NOT NULL,
  "isPrivate" BOOLEAN NOT NULL DEFAULT FALSE,
  "pinnedMessageId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "CkmChatRoom_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "CkmWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CkmChatRoom_ownerMembershipId_fkey"
    FOREIGN KEY ("ownerMembershipId") REFERENCES "CkmWorkspaceMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CkmRoomMember" (
  "id" TEXT PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "roomRole" "CkmRoomRole" NOT NULL DEFAULT 'PARTICIPANT',
  "lastReadMessageId" TEXT,
  "mutedUntil" TIMESTAMP(3),
  "notificationLevel" TEXT NOT NULL DEFAULT 'inherit',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "CkmRoomMember_roomId_membershipId_key" UNIQUE ("roomId", "membershipId"),
  CONSTRAINT "CkmRoomMember_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "CkmChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CkmRoomMember_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "CkmWorkspaceMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CkmChatMessage" (
  "id" TEXT PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "threadId" TEXT,
  "parentMessageId" TEXT,
  "authorId" TEXT NOT NULL,
  "messageType" "CkmMessageType" NOT NULL DEFAULT 'TEXT',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "body" TEXT NOT NULL,
  "bodyRich" JSONB,
  "mentionsJson" JSONB,
  "metadataJson" JSONB,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "editedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "CkmChatMessage_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "CkmChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CkmChatMessage_parentMessageId_fkey"
    FOREIGN KEY ("parentMessageId") REFERENCES "CkmChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CkmChatThread" (
  "id" TEXT PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "rootMessageId" TEXT UNIQUE,
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "linkedTaskSystem" TEXT,
  "linkedTaskId" TEXT,
  "summary" TEXT,
  "summaryEmbedding" vector(1536),
  "summaryUpdatedAt" TIMESTAMP(3),
  CONSTRAINT "CkmChatThread_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "CkmChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "CkmChatMessage"
  ADD CONSTRAINT "CkmChatMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "CkmChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CkmChatThread"
  ADD CONSTRAINT "CkmChatThread_rootMessageId_fkey"
  FOREIGN KEY ("rootMessageId") REFERENCES "CkmChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;


CREATE TABLE "CkmMessageVersion" (
  "id" TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "diff" JSONB,
  "editedBy" TEXT NOT NULL,
  "editedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "CkmMessageVersion_messageId_version_key" UNIQUE ("messageId", "version"),
  CONSTRAINT "CkmMessageVersion_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "CkmChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CkmMessageAttachment" (
  "id" TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "objectStorageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "checksum" TEXT,
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "CkmMessageAttachment_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "CkmChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CkmMessageReaction" (
  "id" TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "CkmMessageReaction_messageId_actorId_emoji_key"
    UNIQUE ("messageId", "actorId", "emoji"),
  CONSTRAINT "CkmMessageReaction_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "CkmChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CkmMessageTaskLink" (
  "id" TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "taskSystem" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'message_to_task',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "CkmMessageTaskLink_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "CkmChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CkmMessageEmbedding" (
  "messageId" TEXT PRIMARY KEY,
  "embedding" vector(1536) NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'openai',
  "model" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  "lastReindexedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "status" TEXT NOT NULL DEFAULT 'ready',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CkmMessageEmbedding_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "CkmChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CkmNotificationSetting" (
  "id" TEXT PRIMARY KEY,
  "membershipId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'mentions',
  "quietHours" JSONB,
  "digest" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "CkmNotificationSetting_membershipId_channel_key"
    UNIQUE ("membershipId", "channel"),
  CONSTRAINT "CkmNotificationSetting_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "CkmWorkspaceMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CkmAuditLog" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "roomId" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "payload" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "CkmAuditLog_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "CkmWorkspace"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CkmAuditLog_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "CkmChatRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CkmWorkspace_type_idx" ON "CkmWorkspace"("type");
CREATE INDEX "CkmWorkspace_isPrivate_idx" ON "CkmWorkspace"("isPrivate");
CREATE INDEX "CkmWorkspaceMembership_memberId_idx" ON "CkmWorkspaceMembership"("memberId");
CREATE INDEX "CkmChatRoom_workspaceId_roomType_idx" ON "CkmChatRoom"("workspaceId", "roomType");
CREATE INDEX "CkmChatRoom_isPrivate_idx" ON "CkmChatRoom"("isPrivate");
CREATE INDEX "CkmRoomMember_membershipId_idx" ON "CkmRoomMember"("membershipId");
CREATE INDEX "CkmChatThread_roomId_status_idx" ON "CkmChatThread"("roomId", "status");
CREATE INDEX "CkmChatMessage_roomId_postedAt_idx" ON "CkmChatMessage"("roomId", "postedAt");
CREATE INDEX "CkmChatMessage_authorId_idx" ON "CkmChatMessage"("authorId");
CREATE INDEX "CkmChatMessage_threadId_idx" ON "CkmChatMessage"("threadId");
CREATE INDEX "CkmMessageAttachment_messageId_idx" ON "CkmMessageAttachment"("messageId");
CREATE INDEX "CkmMessageTaskLink_taskSystem_taskId_idx" ON "CkmMessageTaskLink"("taskSystem", "taskId");
CREATE INDEX "CkmAuditLog_resourceType_resourceId_idx" ON "CkmAuditLog"("resourceType", "resourceId");
CREATE INDEX "CkmAuditLog_actorId_occurredAt_idx" ON "CkmAuditLog"("actorId", "occurredAt");
