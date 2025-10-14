import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  await prisma.chatMessage.deleteMany();
  await prisma.chatThread.deleteMany();
  await prisma.risk.deleteMany();
  await prisma.task.deleteMany();
  await prisma.phase.deleteMany();
  await prisma.burndownPoint.deleteMany();
  await prisma.project.deleteMany();

  const projects = [
    {
      code: 'ALPHA-01',
      name: 'Alpha Launch Enablement',
      description: 'ERP rollout for core operations with phased enablement.',
      status: 'active',
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-07-31'),
      plannedValue: 120000,
      earnedValue: 112500,
      actualCost: 105000,
      phases: {
        create: [
          {
            name: 'Initiation',
            sortOrder: 1,
            startDate: new Date('2025-01-15'),
            endDate: new Date('2025-01-31'),
          },
          {
            name: 'Execution',
            sortOrder: 2,
            startDate: new Date('2025-02-01'),
            endDate: new Date('2025-06-30'),
          },
        ],
      },
      tasks: {
        create: [
          {
            name: 'Kickoff & Alignment',
            status: 'done',
            startDate: new Date('2025-01-15'),
            endDate: new Date('2025-01-22'),
            effortHours: 40,
            orderIndex: 1,
          },
          {
            name: 'Finance Module Integration',
            status: 'inProgress',
            startDate: new Date('2025-01-25'),
            endDate: new Date('2025-03-15'),
            effortHours: 240,
            orderIndex: 2,
          },
          {
            name: 'User Acceptance Testing',
            status: 'todo',
            startDate: new Date('2025-03-20'),
            endDate: new Date('2025-05-15'),
            effortHours: 180,
            orderIndex: 3,
          },
        ],
      },
      risks: {
        create: [
          { probability: 40, impact: 3, status: 'monitoring', summary: 'Integration readiness risk' },
          { probability: 25, impact: 4, status: 'mitigated', summary: 'Data migration complexity' },
        ],
      },
      burndown: {
        create: [
          { label: 'Sprint 1', planned: 120, actual: 118, orderIndex: 1 },
          { label: 'Sprint 2', planned: 240, actual: 235, orderIndex: 2 },
          { label: 'Sprint 3', planned: 360, actual: 340, orderIndex: 3 },
          { label: 'Sprint 4', planned: 480, actual: 455, orderIndex: 4 },
        ],
      },
      chatThreads: {
        create: [
          {
            provider: 'Slack',
            externalThreadId: 'alpha-thread-001',
            channelName: 'alpha-daily-sync',
            messages: {
              create: [
                {
                  author: 'PM',
                  content: 'Finance integration is tracking; dependency on vendor API.',
                  postedAt: new Date('2025-02-10T09:00:00Z'),
                },
                {
                  author: 'TechLead',
                  content: 'Need to align with data migration team on schema changes.',
                  postedAt: new Date('2025-02-10T12:30:00Z'),
                },
                {
                  author: 'QA',
                  content: 'Preparing UAT scripts; waiting for staging refresh.',
                  postedAt: new Date('2025-02-11T03:45:00Z'),
                },
              ],
            },
          },
        ],
      },
    },
    {
      code: 'BETA-02',
      name: 'Customer Portal Revamp',
      description: 'Customer-facing portal modernization and chat integration.',
      status: 'onHold',
      startDate: new Date('2024-10-01'),
      endDate: new Date('2025-04-30'),
      plannedValue: 85000,
      earnedValue: 62000,
      actualCost: 69000,
      phases: {
        create: [
          {
            name: 'Discovery',
            sortOrder: 1,
            startDate: new Date('2024-10-01'),
            endDate: new Date('2024-11-10'),
          },
          {
            name: 'Design',
            sortOrder: 2,
            startDate: new Date('2024-11-11'),
            endDate: new Date('2025-01-31'),
          },
        ],
      },
      tasks: {
        create: [
          {
            name: 'Requirement Refinement',
            status: 'done',
            startDate: new Date('2024-10-03'),
            endDate: new Date('2024-11-15'),
            effortHours: 120,
            orderIndex: 1,
          },
          {
            name: 'UI/UX Prototype',
            status: 'review',
            startDate: new Date('2024-11-18'),
            endDate: new Date('2025-01-31'),
            effortHours: 200,
            orderIndex: 2,
          },
          {
            name: 'Chatbot Integration',
            status: 'blocked',
            startDate: new Date('2025-02-05'),
            endDate: new Date('2025-04-15'),
            effortHours: 160,
            orderIndex: 3,
          },
        ],
      },
      risks: {
        create: [
          { probability: 55, impact: 5, status: 'escalated', summary: 'Vendor contract pending' },
          { probability: 20, impact: 2, status: 'watching', summary: 'Security review resourcing' },
        ],
      },
      burndown: {
        create: [
          { label: 'Sprint 1', planned: 100, actual: 90, orderIndex: 1 },
          { label: 'Sprint 2', planned: 200, actual: 170, orderIndex: 2 },
          { label: 'Sprint 3', planned: 300, actual: 210, orderIndex: 3 },
          { label: 'Sprint 4', planned: 400, actual: 250, orderIndex: 4 },
        ],
      },
      chatThreads: {
        create: [
          {
            provider: 'Teams',
            externalThreadId: 'beta-thread-001',
            channelName: 'beta-design-huddle',
            messages: {
              create: [
                {
                  author: 'Designer',
                  content: 'Awaiting marketing sign-off on new landing page.',
                  postedAt: new Date('2025-01-25T04:00:00Z'),
                },
                {
                  author: 'SecurityLead',
                  content: 'Security review blocked until vendor provides SOC2 report.',
                  postedAt: new Date('2025-01-26T07:15:00Z'),
                },
              ],
            },
          },
        ],
      },
    },
    {
      code: 'GAMMA-03',
      name: 'Data Warehouse Stabilization',
      description: 'Stabilize ETL pipelines and improve reporting cadence.',
      status: 'completed',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-12-20'),
      plannedValue: 64000,
      earnedValue: 64000,
      actualCost: 65800,
      phases: {
        create: [
          {
            name: 'Audit',
            sortOrder: 1,
            startDate: new Date('2024-03-01'),
            endDate: new Date('2024-04-15'),
          },
          {
            name: 'Stabilization',
            sortOrder: 2,
            startDate: new Date('2024-04-16'),
            endDate: new Date('2024-10-31'),
          },
        ],
      },
      tasks: {
        create: [
          {
            name: 'Pipeline Audit',
            status: 'done',
            startDate: new Date('2024-03-05'),
            endDate: new Date('2024-04-15'),
            effortHours: 140,
            orderIndex: 1,
          },
          {
            name: 'Data Quality Initiative',
            status: 'done',
            startDate: new Date('2024-04-20'),
            endDate: new Date('2024-09-30'),
            effortHours: 320,
            orderIndex: 2,
          },
          {
            name: 'Executive Reporting Enablement',
            status: 'done',
            startDate: new Date('2024-10-05'),
            endDate: new Date('2024-12-10'),
            effortHours: 160,
            orderIndex: 3,
          },
        ],
      },
      risks: {
        create: [{ probability: 10, impact: 1, status: 'closed', summary: 'Post-mortem complete' }],
      },
      burndown: {
        create: [
          { label: 'Sprint 1', planned: 80, actual: 82, orderIndex: 1 },
          { label: 'Sprint 2', planned: 160, actual: 162, orderIndex: 2 },
          { label: 'Sprint 3', planned: 240, actual: 240, orderIndex: 3 },
          { label: 'Sprint 4', planned: 320, actual: 320, orderIndex: 4 },
        ],
      },
      chatThreads: {
        create: [
          {
            provider: 'Slack',
            externalThreadId: 'gamma-thread-001',
            channelName: 'gamma-retro',
            messages: {
              create: [
                {
                  author: 'PM',
                  content: 'Retro complete; focusing on knowledge transfer next sprint.',
                  postedAt: new Date('2024-12-18T09:15:00Z'),
                },
                {
                  author: 'Analyst',
                  content: 'Dashboard refresh now under 30 minutes consistently.',
                  postedAt: new Date('2024-12-18T11:45:00Z'),
                },
              ],
            },
          },
        ],
      },
    },
  ];

  for (const project of projects) {
    await prisma.project.create({
      data: project,
    });
  }
}

seed()
  .then(() => {
    console.log('Seed data created successfully');
  })
  .catch((error) => {
    console.error('Failed to seed database', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
