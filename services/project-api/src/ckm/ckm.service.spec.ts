import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CkmService, DeleteMessageParams, PostMessageParams, UpdateMessageParams } from './ckm.service';
import { CkmPrismaService } from '../prisma/ckm-prisma.service';
import { CkmNotificationService } from './notification/ckm-notification.service';
import { CkmMessageType } from '../../generated/ckm-client';

type PrismaClientMock = {
  ckmWorkspace: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
  };
  ckmChatRoom: {
    findFirst: jest.Mock;
  };
  ckmChatThread: {
    findUnique: jest.Mock;
  };
  ckmWorkspaceMembership: {
    findFirst: jest.Mock;
  };
  ckmRoomMember: {
    findFirst: jest.Mock;
  };
  ckmChatMessage: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  ckmMessageVersion: {
    create: jest.Mock;
  };
  ckmAuditLog: {
    create: jest.Mock;
  };
  $transaction: jest.Mock;
};

type NotificationMock = {
  notifyMessageCreated: jest.Mock;
  notifyMessageUpdated: jest.Mock;
  notifyMessageDeleted: jest.Mock;
};

const createNotificationMock = (): NotificationMock => ({
  notifyMessageCreated: jest.fn().mockResolvedValue(undefined),
  notifyMessageUpdated: jest.fn().mockResolvedValue(undefined),
  notifyMessageDeleted: jest.fn().mockResolvedValue(undefined),
});

const createPrismaClientMock = (): PrismaClientMock => {
  const mock: PrismaClientMock = {
    ckmWorkspace: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    ckmChatRoom: {
      findFirst: jest.fn(),
    },
    ckmChatThread: {
      findUnique: jest.fn(),
    },
    ckmWorkspaceMembership: {
      findFirst: jest.fn(),
    },
    ckmRoomMember: {
      findFirst: jest.fn(),
    },
    ckmChatMessage: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    ckmMessageVersion: {
      create: jest.fn(),
    },
    ckmAuditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  mock.$transaction.mockImplementation(async (callback: (tx: PrismaClientMock) => Promise<unknown>) =>
    callback(mock),
  );

  return mock;
};

const createService = (options?: { enabled?: boolean }) => {
  const prisma = createPrismaClientMock();
  const notification = createNotificationMock();
  const prismaService = {
    enabled: options?.enabled ?? true,
    get prisma() {
      return prisma;
    },
  } as unknown as CkmPrismaService;

  const service = new CkmService(prismaService, notification as unknown as CkmNotificationService);
  return { service, prisma, notification };
};

describe('CkmService', () => {
  it('throws ServiceUnavailableException when CKM datastore is disabled', async () => {
    const { service } = createService({ enabled: false });

    await expect(
      service.createMessage({
        workspaceCode: 'DEV',
        roomId: 'room-1',
        authorId: 'user-1',
        body: 'hello',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('lists active workspaces', async () => {
    const { service, prisma } = createService();
    prisma.ckmWorkspace.findMany.mockResolvedValue([
      {
        id: 'ws-1',
        code: 'DEV',
        name: 'Dev Workspace',
        type: 'team',
        description: 'desc',
        defaultRole: 'MEMBER',
        isPrivate: false,
        archivedAt: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
        _count: { rooms: 2, memberships: 5 },
      },
    ]);

    const result = await service.listWorkspaces('user-1');

    expect(prisma.ckmWorkspace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          archivedAt: null,
          memberships: expect.objectContaining({
            some: expect.objectContaining({ memberId: 'user-1', status: 'active' }),
          }),
        }),
        orderBy: { name: 'asc' },
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        code: 'DEV',
        roomCount: 2,
        memberCount: 5,
      }),
    ]);
  });

  it('creates a CKM message with thread inheritance, audit log, and notification', async () => {
    const { service, prisma, notification } = createService();
    prisma.ckmWorkspace.findUnique.mockResolvedValue({ id: 'ws-1', code: 'DEV' });
    prisma.ckmChatRoom.findFirst.mockResolvedValue({ id: 'room-1', workspaceId: 'ws-1' });
    prisma.ckmChatThread.findUnique.mockResolvedValue(null);
    prisma.ckmWorkspaceMembership.findFirst.mockResolvedValue({
      id: 'mem-1',
      workspaceId: 'ws-1',
      memberId: 'user-1',
      status: 'active',
    });
    prisma.ckmRoomMember.findFirst.mockResolvedValue({
      id: 'room-mem-1',
      roomId: 'room-1',
      membershipId: 'mem-1',
    });
    prisma.ckmChatMessage.findUnique.mockResolvedValue({
      id: 'msg-parent',
      roomId: 'room-1',
      threadId: 'thread-1',
    });
    const now = new Date('2024-01-03T00:00:00Z');
    prisma.ckmChatMessage.create.mockResolvedValue({
      id: 'msg-1',
      roomId: 'room-1',
      threadId: 'thread-1',
      parentMessageId: 'msg-parent',
      authorId: 'user-1',
      messageType: 'TEXT',
      priority: 0,
      body: 'Hello CKM',
      bodyRich: null,
      mentionsJson: ['user-2'],
      metadataJson: { foo: 'bar' },
      postedAt: now,
      editedAt: null,
      deletedAt: null,
      version: 1,
    });
    prisma.ckmAuditLog.create.mockResolvedValue({ id: 'audit-1' });

    const params: PostMessageParams = {
      workspaceCode: 'DEV',
      roomId: 'room-1',
      authorId: 'user-1',
      body: 'Hello CKM',
      parentMessageId: 'msg-parent',
      mentions: ['user-2'],
      metadataJson: JSON.stringify({ foo: 'bar' }),
    };

    const result = await service.createMessage(params);

    expect(prisma.ckmChatMessage.create).toHaveBeenCalled();
    expect(prisma.ckmAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'message.created' }) }),
    );
    expect(notification.notifyMessageCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        roomId: 'room-1',
        message: expect.objectContaining({ id: 'msg-1' }),
      }),
    );
    expect(result).toEqual({
      id: 'msg-1',
      roomId: 'room-1',
      threadId: 'thread-1',
      parentMessageId: 'msg-parent',
      authorId: 'user-1',
      messageType: CkmMessageType.TEXT,
      priority: 0,
      body: 'Hello CKM',
      bodyRich: null,
      mentions: ['user-2'],
      metadataJson: JSON.stringify({ foo: 'bar' }),
      postedAt: now.toISOString(),
      deletedAt: null,
    });
  });

  it('throws NotFoundException if workspace does not exist when creating a message', async () => {
    const { service, prisma } = createService();
    prisma.ckmWorkspace.findUnique.mockResolvedValue(null);

    await expect(
      service.createMessage({
        workspaceCode: 'MISSING',
        roomId: 'room-1',
        authorId: 'user-1',
        body: 'Hello',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('searches messages by keyword within workspace', async () => {
    const { service, prisma } = createService();
    prisma.ckmWorkspace.findUnique.mockResolvedValue({ id: 'ws-1', code: 'DEV' });
    prisma.ckmChatRoom.findFirst.mockResolvedValue({ id: 'room-1', workspaceId: 'ws-1' });
    prisma.ckmWorkspaceMembership.findFirst.mockResolvedValue({
      id: 'mem-1',
      workspaceId: 'ws-1',
      memberId: 'user-1',
      status: 'active',
    });
    prisma.ckmRoomMember.findFirst.mockResolvedValue({
      id: 'room-mem-1',
      roomId: 'room-1',
      membershipId: 'mem-1',
    });
    const postedAt = new Date('2024-01-05T00:00:00Z');
    prisma.ckmChatMessage.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        roomId: 'room-1',
        threadId: null,
        parentMessageId: null,
        authorId: 'user-1',
        messageType: 'TEXT',
        priority: 0,
        body: 'Project kickoff memo',
        bodyRich: null,
        mentionsJson: null,
        metadataJson: null,
        postedAt,
        editedAt: null,
        deletedAt: null,
        version: 1,
      },
    ]);

    const results = await service.searchMessages({ workspaceCode: 'DEV', keyword: 'kickoff', roomId: 'room-1', actorId: 'user-1' });

    expect(prisma.ckmChatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          body: expect.objectContaining({ contains: 'kickoff' }),
          deletedAt: null,
        }),
      }),
    );
    expect(results).toEqual([
      expect.objectContaining({
        id: 'msg-1',
        body: 'Project kickoff memo',
        postedAt: postedAt.toISOString(),
        deletedAt: null,
      }),
    ]);
  });

  it('updates a message with optimistic locking and audit log', async () => {
    const { service, prisma, notification } = createService();
    const postedAt = new Date('2024-01-05T00:00:00Z');
    prisma.ckmWorkspace.findUnique.mockResolvedValue({ id: 'ws-1', code: 'DEV' });
    prisma.ckmChatMessage.findUnique.mockResolvedValue({
      id: 'msg-1',
      roomId: 'room-1',
      threadId: 'thread-1',
      parentMessageId: null,
      authorId: 'user-1',
      messageType: 'TEXT',
      priority: 0,
      body: 'Original',
      bodyRich: null,
      mentionsJson: null,
      metadataJson: null,
      postedAt,
      editedAt: null,
      deletedAt: null,
      version: 1,
      room: { id: 'room-1', workspaceId: 'ws-1' },
    });
    prisma.ckmWorkspaceMembership.findFirst.mockResolvedValue({
      id: 'mem-1',
      workspaceId: 'ws-1',
      memberId: 'user-2',
      status: 'active',
    });
    prisma.ckmRoomMember.findFirst.mockResolvedValue({
      id: 'room-mem-1',
      roomId: 'room-1',
      membershipId: 'mem-1',
    });
    prisma.ckmMessageVersion.create.mockResolvedValue({ id: 'ver-2' });
    prisma.ckmChatMessage.update.mockResolvedValue({
      id: 'msg-1',
      roomId: 'room-1',
      threadId: 'thread-1',
      parentMessageId: null,
      authorId: 'user-1',
      messageType: 'TEXT',
      priority: 0,
      body: 'Updated',
      bodyRich: null,
      mentionsJson: ['user-2'],
      metadataJson: { foo: 'bar' },
      postedAt,
      editedAt: new Date('2024-01-06T00:00:00Z'),
      deletedAt: null,
      version: 2,
    });
    prisma.ckmAuditLog.create.mockResolvedValue({ id: 'audit-2' });

    const params: UpdateMessageParams = {
      workspaceCode: 'DEV',
      messageId: 'msg-1',
      editorId: 'user-2',
      version: 1,
      body: 'Updated',
      mentions: ['user-2'],
      metadataJson: JSON.stringify({ foo: 'bar' }),
    };

    const result = await service.updateMessage(params);

    expect(prisma.ckmMessageVersion.create).toHaveBeenCalled();
    expect(prisma.ckmChatMessage.update).toHaveBeenCalled();
    expect(prisma.ckmAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'message.updated' }) }),
    );
    expect(notification.notifyMessageUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.objectContaining({ id: 'msg-1', body: 'Updated' }) }),
    );
    expect(result.body).toBe('Updated');
  });

  it('throws ConflictException when version mismatches during update', async () => {
    const { service, prisma } = createService();
    prisma.ckmWorkspace.findUnique.mockResolvedValue({ id: 'ws-1', code: 'DEV' });
    prisma.ckmChatMessage.findUnique.mockResolvedValue({
      id: 'msg-1',
      roomId: 'room-1',
      threadId: null,
      parentMessageId: null,
      authorId: 'user-1',
      messageType: 'TEXT',
      priority: 0,
      body: 'Original',
      bodyRich: null,
      mentionsJson: null,
      metadataJson: null,
      postedAt: new Date('2024-01-01T00:00:00Z'),
      editedAt: null,
      deletedAt: null,
      version: 2,
      room: { id: 'room-1', workspaceId: 'ws-1' },
    });

    const params: UpdateMessageParams = {
      workspaceCode: 'DEV',
      messageId: 'msg-1',
      editorId: 'user-2',
      version: 1,
      body: 'Updated',
    };

    await expect(service.updateMessage(params)).rejects.toThrow(ConflictException);
  });

  it('soft deletes a message and records audit log & notification', async () => {
    const { service, prisma, notification } = createService();
    const postedAt = new Date('2024-01-01T00:00:00Z');
    prisma.ckmWorkspace.findUnique.mockResolvedValue({ id: 'ws-1', code: 'DEV' });
    prisma.ckmChatMessage.findUnique.mockResolvedValue({
      id: 'msg-1',
      roomId: 'room-1',
      threadId: 'thread-1',
      parentMessageId: null,
      authorId: 'user-1',
      messageType: 'TEXT',
      priority: 0,
      body: 'Original',
      bodyRich: null,
      mentionsJson: null,
      metadataJson: null,
      postedAt,
      editedAt: null,
      deletedAt: null,
      version: 1,
      room: { id: 'room-1', workspaceId: 'ws-1' },
    });
    prisma.ckmWorkspaceMembership.findFirst.mockResolvedValue({
      id: 'mem-1',
      workspaceId: 'ws-1',
      memberId: 'user-2',
      status: 'active',
    });
    prisma.ckmRoomMember.findFirst.mockResolvedValue({
      id: 'room-mem-1',
      roomId: 'room-1',
      membershipId: 'mem-1',
    });
    prisma.ckmMessageVersion.create.mockResolvedValue({ id: 'ver-2' });
    const deletedAt = new Date('2024-01-07T00:00:00Z');
    prisma.ckmChatMessage.update.mockResolvedValue({
      id: 'msg-1',
      roomId: 'room-1',
      threadId: 'thread-1',
      parentMessageId: null,
      authorId: 'user-1',
      messageType: 'TEXT',
      priority: 0,
      body: 'Original',
      bodyRich: null,
      mentionsJson: null,
      metadataJson: null,
      postedAt,
      editedAt: null,
      deletedAt,
      version: 2,
    });
    prisma.ckmAuditLog.create.mockResolvedValue({ id: 'audit-3' });

    const params: DeleteMessageParams = {
      workspaceCode: 'DEV',
      messageId: 'msg-1',
      actorId: 'user-2',
    };

    const result = await service.deleteMessage(params);

    expect(prisma.ckmChatMessage.update).toHaveBeenCalled();
    expect(prisma.ckmAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'message.deleted' }) }),
    );
    expect(notification.notifyMessageDeleted).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.objectContaining({ id: 'msg-1' }) }),
    );
    expect(result.deletedAt).toBe(deletedAt.toISOString());
  });
});
