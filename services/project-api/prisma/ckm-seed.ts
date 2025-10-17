import { CkmMessageType, CkmRoomRole, CkmRoomType, CkmWorkspaceRole, PrismaClient as CkmPrismaClient } from '../../generated/ckm-client';

const prisma = new CkmPrismaClient();

async function clearCkmData() {
  await prisma.$transaction([
    prisma.ckmMessageEmbedding.deleteMany(),
    prisma.ckmMessageTaskLink.deleteMany(),
    prisma.ckmMessageReaction.deleteMany(),
    prisma.ckmMessageAttachment.deleteMany(),
    prisma.ckmMessageVersion.deleteMany(),
    prisma.ckmChatMessage.deleteMany(),
    prisma.ckmChatThread.deleteMany(),
    prisma.ckmRoomMember.deleteMany(),
    prisma.ckmNotificationSetting.deleteMany(),
    prisma.ckmAuditLog.deleteMany(),
    prisma.ckmChatRoom.deleteMany(),
    prisma.ckmWorkspaceMembership.deleteMany(),
    prisma.ckmWorkspace.deleteMany(),
  ]);
}

async function seed() {
  console.log('🌱 Seeding CKM sample data...');
  await clearCkmData();

  const workspace = await prisma.ckmWorkspace.create({
    data: {
      code: 'DEV',
      name: 'Development Workspace',
      description: 'Sample workspace for CKM chat verification',
      defaultRole: CkmWorkspaceRole.MEMBER,
      isPrivate: false,
      rooms: {
        create: [],
      },
      memberships: {
        create: [],
      },
    },
  });

  const aliceMembership = await prisma.ckmWorkspaceMembership.create({
    data: {
      workspaceId: workspace.id,
      memberType: 'user',
      memberId: 'user-alice',
      role: CkmWorkspaceRole.OWNER,
      status: 'active',
      notificationLevel: 'all',
    },
  });

  const bobMembership = await prisma.ckmWorkspaceMembership.create({
    data: {
      workspaceId: workspace.id,
      memberType: 'user',
      memberId: 'user-bob',
      role: CkmWorkspaceRole.MEMBER,
      status: 'active',
      notificationLevel: 'mentions',
    },
  });

  const room = await prisma.ckmChatRoom.create({
    data: {
      workspaceId: workspace.id,
      roomType: CkmRoomType.TOPIC,
      title: 'general',
      topic: 'General discussion for the Dev workspace',
      ownerMembershipId: aliceMembership.id,
    },
  });

  await prisma.ckmRoomMember.createMany({
    data: [
      {
        roomId: room.id,
        membershipId: aliceMembership.id,
        roomRole: CkmRoomRole.OWNER,
        notificationLevel: 'all',
      },
      {
        roomId: room.id,
        membershipId: bobMembership.id,
        roomRole: CkmRoomRole.PARTICIPANT,
        notificationLevel: 'inherit',
      },
    ],
  });

  const welcomeMessage = await prisma.ckmChatMessage.create({
    data: {
      roomId: room.id,
      authorId: 'user-alice',
      messageType: CkmMessageType.TEXT,
      body: 'Welcome to the CKM chat workspace! Feel free to start a thread.',
      mentionsJson: ['user-bob'],
    },
  });

  await prisma.ckmChatThread.create({
    data: {
      roomId: room.id,
      rootMessageId: welcomeMessage.id,
      title: 'Kick-off preparations',
      linkedTaskSystem: 'projects',
      linkedTaskId: 'ALPHA-01',
      messages: {
        create: [
          {
            roomId: room.id,
            authorId: 'user-bob',
            messageType: CkmMessageType.TEXT,
            body: 'Thanks! I will draft the integration checklist before the stand-up.',
          },
        ],
      },
    },
  });

  console.log('✅ CKM sample data seeded.');
  console.log(`   Workspace code: ${workspace.code}`);
  console.log(`   Room: ${room.title}`);
  console.log('   Users: user-alice (owner), user-bob (member)');
}

seed()
  .catch((error) => {
    console.error('❌ Failed to seed CKM data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
