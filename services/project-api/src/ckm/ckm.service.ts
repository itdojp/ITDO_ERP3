import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CkmRoomType, CkmWorkspaceRole, Prisma, CkmMessageType, CkmChatMessage } from '../../generated/ckm-client';
import { CkmPrismaService } from '../prisma/ckm-prisma.service';
import { CkmNotificationService } from './notification/ckm-notification.service';

export interface CkmWorkspaceSummary {
  id: string;
  code: string;
  name: string;
  type: string;
  description?: string | null;
  defaultRole: CkmWorkspaceRole;
  isPrivate: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  roomCount: number;
  memberCount: number;
}

export interface CkmRoomSummary {
  id: string;
  title: string;
  topic?: string | null;
  roomType: CkmRoomType;
  isPrivate: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
}

export interface CkmWorkspaceDetail extends CkmWorkspaceSummary {
  rooms: CkmRoomSummary[];
}

export interface CkmMessage {
  id: string;
  roomId: string;
  threadId?: string | null;
  parentMessageId?: string | null;
  authorId: string;
  messageType: CkmMessageType;
  priority: number;
  body: string;
  bodyRich?: string | null;
  mentions?: string[] | null;
  metadataJson?: string | null;
  postedAt: string;
  deletedAt?: string | null;
}

export interface PostMessageParams {
  workspaceCode: string;
  roomId: string;
  authorId: string;
  threadId?: string;
  parentMessageId?: string;
  messageType?: CkmMessageType;
  body: string;
  priority?: number;
  mentions?: string[];
  metadataJson?: string;
}

export interface MessageSearchParams {
  workspaceCode: string;
  keyword: string;
  roomId?: string;
  limit?: number;
}

export interface UpdateMessageParams {
  workspaceCode: string;
  messageId: string;
  editorId: string;
  version: number;
  body?: string;
  messageType?: CkmMessageType;
  priority?: number;
  mentions?: string[];
  metadataJson?: string;
}

export interface DeleteMessageParams {
  workspaceCode: string;
  messageId: string;
  actorId: string;
}

type WorkspaceWithCounts = Prisma.CkmWorkspaceGetPayload<{
  include: { _count: { select: { rooms: true; memberships: true } } };
}>;

type WorkspaceWithRooms = Prisma.CkmWorkspaceGetPayload<{
  include: {
    _count: { select: { rooms: true; memberships: true } };
    rooms: { include: { _count: { select: { members: true } } } };
  };
}>;

type RoomWithCount = Prisma.CkmChatRoomGetPayload<{
  include: { _count: { select: { members: true } } };
}>;

@Injectable()
export class CkmService {
  constructor(
    private readonly ckmPrismaService: CkmPrismaService,
    private readonly notificationService: CkmNotificationService,
  ) {}

  isEnabled(): boolean {
    return this.ckmPrismaService.enabled;
  }

  get prisma() {
    if (!this.ckmPrismaService.enabled) {
      throw new ServiceUnavailableException('CKM datastore is disabled. Set DATABASE_CKM_URL to enable it.');
    }
    return this.ckmPrismaService.prisma;
  }

  async listWorkspaces(): Promise<CkmWorkspaceSummary[]> {
    const workspaces = await this.prisma.ckmWorkspace.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { rooms: true, memberships: true } } },
    });
    return workspaces.map((ws) => this.mapWorkspaceSummary(ws));
  }

  async getWorkspaceByCode(code: string): Promise<CkmWorkspaceDetail> {
    const workspace = await this.prisma.ckmWorkspace.findUnique({
      where: { code },
      include: {
        _count: { select: { rooms: true, memberships: true } },
        rooms: {
          where: { archivedAt: null },
          orderBy: { title: 'asc' },
          include: { _count: { select: { members: true } } },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException(`CKM workspace not found for code "${code}".`);
    }

    return this.mapWorkspaceDetail(workspace);
  }

  async listRooms(workspaceCode: string): Promise<CkmRoomSummary[]> {
    const workspace = await this.getWorkspaceByCode(workspaceCode);
    return workspace.rooms;
  }

  async createMessage(params: PostMessageParams): Promise<CkmMessage> {
    const { workspaceCode, roomId, authorId } = params;
    if (!authorId.trim()) {
      throw new BadRequestException('authorId is required.');
    }
    const workspace = await this.requireWorkspace(workspaceCode);

    const room = await this.prisma.ckmChatRoom.findFirst({
      where: { id: roomId, workspaceId: workspace.id },
    });
    if (!room) {
      throw new NotFoundException(`CKM room not found (id="${roomId}") in workspace "${workspaceCode}".`);
    }

    let threadId: string | null = params.threadId ?? null;
    if (threadId) {
      const thread = await this.prisma.ckmChatThread.findUnique({ where: { id: threadId } });
      if (!thread || thread.roomId !== room.id) {
        throw new NotFoundException(`CKM thread not found (id="${threadId}") in room "${roomId}".`);
      }
    }

    if (params.parentMessageId) {
      const parent = await this.prisma.ckmChatMessage.findUnique({
        where: { id: params.parentMessageId },
      });
      if (!parent || parent.roomId !== room.id) {
        throw new NotFoundException(`CKM parent message not found (id="${params.parentMessageId}") in room "${roomId}".`);
      }
      if (!threadId) {
        threadId = parent.threadId ?? null;
      }
    }

    const metadataParsed =
      params.metadataJson !== undefined
        ? this.safeParseJson<Record<string, unknown> | null>(params.metadataJson, 'metadataJson', null)
        : undefined;
    const metadata =
      metadataParsed === undefined
        ? undefined
        : metadataParsed === null
        ? Prisma.JsonNull
        : (metadataParsed as Prisma.InputJsonValue);
    const mentionsJson =
      params.mentions !== undefined ? (params.mentions as Prisma.InputJsonValue) : undefined;

    const created = await this.prisma.ckmChatMessage.create({
      data: {
        roomId: room.id,
        threadId,
        parentMessageId: params.parentMessageId ?? null,
        authorId,
        messageType: params.messageType ?? CkmMessageType.TEXT,
        priority: params.priority ?? 0,
        body: params.body,
        mentionsJson,
        metadataJson: metadata,
      },
    });

    const mapped = this.mapMessage(created);

    await this.logAudit(this.prisma, {
      actorId: authorId,
      workspaceId: workspace.id,
      roomId: room.id,
      action: 'message.created',
      resourceType: 'ckm.message',
      resourceId: created.id,
      payload: {
        threadId,
        priority: params.priority ?? 0,
        mentions: params.mentions ?? [],
      },
    });

    await this.notificationService.notifyMessageCreated({
      workspaceId: workspace.id,
      roomId: room.id,
      message: mapped,
    });

    return mapped;
  }

  async searchMessages(params: MessageSearchParams): Promise<CkmMessage[]> {
    const { workspaceCode, keyword, roomId, limit = 20 } = params;
    const workspace = await this.requireWorkspace(workspaceCode);

    const roomFilter = roomId ? { id: roomId, workspaceId: workspace.id } : null;
    if (roomFilter) {
      const room = await this.prisma.ckmChatRoom.findFirst({ where: roomFilter });
      if (!room) {
        throw new NotFoundException(
          `CKM room not found (id="${roomId}") in workspace "${workspaceCode}".`,
        );
      }
    }

    const messages = await this.prisma.ckmChatMessage.findMany({
      where: {
        room: {
          workspaceId: workspace.id,
          ...(roomId ? { id: roomId } : {}),
        },
        deletedAt: null,
        body: { contains: keyword, mode: Prisma.QueryMode.insensitive },
      },
      orderBy: { postedAt: 'desc' },
      take: limit,
    });

    return messages.map((message) => this.mapMessage(message));
  }

  async updateMessage(params: UpdateMessageParams): Promise<CkmMessage> {
    const workspace = await this.requireWorkspace(params.workspaceCode);
    const message = await this.requireMessage(workspace.id, params.messageId);

    if (message.deletedAt) {
      throw new BadRequestException('Cannot edit a deleted message.');
    }

    if (message.version !== params.version) {
      throw new ConflictException('Message version mismatch. Reload and try again.');
    }

    const nextVersion = message.version + 1;
    const metadataParsed =
      params.metadataJson !== undefined
        ? this.safeParseJson<Record<string, unknown> | null>(
            params.metadataJson,
            'metadataJson',
            null,
          )
        : undefined;
    const metadata =
      metadataParsed === undefined
        ? undefined
        : metadataParsed === null
        ? Prisma.JsonNull
        : (metadataParsed as Prisma.InputJsonValue);

    const mentions =
      params.mentions !== undefined
        ? (params.mentions as Prisma.InputJsonValue)
        : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.ckmMessageVersion.create({
        data: {
          messageId: message.id,
          version: nextVersion,
          body: message.body,
          diff: {
            before: { body: message.body },
            after: { body: params.body ?? message.body },
          },
          editedBy: params.editorId,
          editedAt: new Date(),
        },
      });

      const updatedMessage = await tx.ckmChatMessage.update({
        where: { id: message.id },
        data: {
          body: params.body ?? message.body,
          messageType: params.messageType ?? message.messageType,
          priority: params.priority ?? message.priority,
          ...(mentions !== undefined ? { mentionsJson: mentions } : {}),
          ...(metadata !== undefined ? { metadataJson: metadata } : {}),
          editedAt: new Date(),
          version: nextVersion,
        },
      });

      await this.logAudit(tx, {
        actorId: params.editorId,
        workspaceId: workspace.id,
        roomId: message.roomId,
        action: 'message.updated',
        resourceType: 'ckm.message',
        resourceId: message.id,
        payload: {
          updatedFields: {
            body: params.body !== undefined,
            messageType: params.messageType !== undefined,
            priority: params.priority !== undefined,
            mentions: params.mentions !== undefined,
            metadata: params.metadataJson !== undefined,
          },
        },
      });

      return updatedMessage;
    });

    const mapped = this.mapMessage(updated);
    await this.notificationService.notifyMessageUpdated({
      workspaceId: workspace.id,
      roomId: message.roomId,
      message: mapped,
    });
    return mapped;
  }

  async deleteMessage(params: DeleteMessageParams): Promise<CkmMessage> {
    const workspace = await this.requireWorkspace(params.workspaceCode);
    const message = await this.requireMessage(workspace.id, params.messageId);

    if (message.deletedAt) {
      throw new BadRequestException('Message already deleted.');
    }

    const nextVersion = message.version + 1;
    const deleted = await this.prisma.$transaction(async (tx) => {
      await tx.ckmMessageVersion.create({
        data: {
          messageId: message.id,
          version: nextVersion,
          body: message.body,
          diff: { deleted: true },
          editedBy: params.actorId,
          editedAt: new Date(),
        },
      });

      const updatedMessage = await tx.ckmChatMessage.update({
        where: { id: message.id },
        data: {
          deletedAt: new Date(),
          version: nextVersion,
        },
      });

      await this.logAudit(tx, {
        actorId: params.actorId,
        workspaceId: workspace.id,
        roomId: message.roomId,
        action: 'message.deleted',
        resourceType: 'ckm.message',
        resourceId: message.id,
        payload: { threadId: message.threadId },
      });

      return updatedMessage;
    });

    const mapped = this.mapMessage(deleted);
    await this.notificationService.notifyMessageDeleted({
      workspaceId: workspace.id,
      roomId: message.roomId,
      message: mapped,
    });
    return mapped;
  }

  private mapWorkspaceSummary(workspace: WorkspaceWithCounts): CkmWorkspaceSummary {
    return {
      id: workspace.id,
      code: workspace.code,
      name: workspace.name,
      type: workspace.type,
      description: workspace.description,
      defaultRole: workspace.defaultRole,
      isPrivate: workspace.isPrivate,
      archivedAt: workspace.archivedAt ? workspace.archivedAt.toISOString() : null,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
      roomCount: workspace._count.rooms,
      memberCount: workspace._count.memberships,
    };
  }

  private mapWorkspaceDetail(workspace: WorkspaceWithRooms): CkmWorkspaceDetail {
    return {
      ...this.mapWorkspaceSummary(workspace),
      rooms: workspace.rooms.map((room) => this.mapRoom(room)),
    };
  }

  private mapRoom(room: RoomWithCount): CkmRoomSummary {
    return {
      id: room.id,
      title: room.title,
      topic: room.topic,
      roomType: room.roomType,
      isPrivate: room.isPrivate,
      archivedAt: room.archivedAt ? room.archivedAt.toISOString() : null,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
      memberCount: room._count.members,
    };
  }

  private mapMessage(message: CkmChatMessage): CkmMessage {
    const mentionsArray =
      message.mentionsJson === null || message.mentionsJson === undefined
        ? null
        : Array.isArray(message.mentionsJson)
        ? (message.mentionsJson as string[])
        : typeof message.mentionsJson === 'string'
        ? this.safeParseJson<string[]>(message.mentionsJson, 'mentionsJson', [])
        : null;

    const metadata =
      message.metadataJson === null || message.metadataJson === undefined
        ? null
        : typeof message.metadataJson === 'object'
        ? message.metadataJson
        : typeof message.metadataJson === 'string'
        ? this.safeParseJson<Record<string, unknown> | null>(message.metadataJson, 'metadataJson', null)
        : null;

    return {
      id: message.id,
      roomId: message.roomId,
      threadId: message.threadId ?? null,
      parentMessageId: message.parentMessageId ?? null,
      authorId: message.authorId,
      messageType: message.messageType as CkmMessageType,
      priority: message.priority,
      body: message.body,
      bodyRich:
        message.bodyRich === null || message.bodyRich === undefined
          ? null
          : typeof message.bodyRich === 'string'
          ? message.bodyRich
          : JSON.stringify(message.bodyRich),
      mentions: mentionsArray,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
      postedAt: message.postedAt instanceof Date ? message.postedAt.toISOString() : new Date().toISOString(),
      deletedAt: message.deletedAt instanceof Date ? message.deletedAt.toISOString() : null,
    };
  }

  private safeParseJson<T>(value: string, field: string, fallback?: T): T {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      if (fallback !== undefined) {
        return fallback;
      }
      throw new BadRequestException(`Invalid JSON in ${field}: ${(error as Error).message}`);
    }
  }

  private async requireWorkspace(code: string) {
    const workspace = await this.prisma.ckmWorkspace.findUnique({ where: { code } });
    if (!workspace) {
      throw new NotFoundException(`CKM workspace not found for code "${code}".`);
    }
    return workspace;
  }

  private async requireMessage(workspaceId: string, messageId: string) {
    const message = await this.prisma.ckmChatMessage.findUnique({
      where: { id: messageId },
      include: { room: true },
    });
    if (!message || message.room.workspaceId !== workspaceId) {
      throw new NotFoundException(`CKM message not found (id="${messageId}") in the specified workspace.`);
    }
    return message;
  }

  private logAudit(
    client: { ckmAuditLog: { create: (args: Prisma.CkmAuditLogCreateArgs) => Promise<unknown> } },
    params: {
      actorId: string;
      workspaceId?: string | null;
      roomId?: string | null;
      action: string;
      resourceType: string;
      resourceId: string;
      payload?: Prisma.InputJsonValue;
    },
  ) {
    const payloadValue = params.payload === undefined ? Prisma.JsonNull : params.payload;
    return client.ckmAuditLog.create({
      data: {
        actorId: params.actorId,
        workspaceId: params.workspaceId ?? null,
        roomId: params.roomId ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        payload: payloadValue,
      },
    });
  }
}
