import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  await prisma.orderAuditLog.deleteMany();
  await prisma.creditReview.deleteMany();
  await prisma.order.deleteMany();
  await prisma.quoteItem.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.conversationSummary.deleteMany();
  await prisma.interactionNote.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.customer.deleteMany();
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
            id: 'phase-alpha-init',
            name: 'Initiation',
            sortOrder: 1,
            startDate: new Date('2025-01-15'),
            endDate: new Date('2025-01-31'),
          },
          {
            id: 'phase-alpha-exec',
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
            phaseId: 'phase-alpha-init',
            status: 'done',
            startDate: new Date('2025-01-15'),
            endDate: new Date('2025-01-22'),
            effortHours: 40,
            orderIndex: 1,
          },
          {
            name: 'Finance Module Integration',
            phaseId: 'phase-alpha-exec',
            status: 'inProgress',
            startDate: new Date('2025-01-25'),
            endDate: new Date('2025-03-15'),
            effortHours: 240,
            orderIndex: 2,
          },
          {
            name: 'User Acceptance Testing',
            phaseId: 'phase-alpha-exec',
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
            id: 'phase-beta-discovery',
            name: 'Discovery',
            sortOrder: 1,
            startDate: new Date('2024-10-01'),
            endDate: new Date('2024-11-10'),
          },
          {
            id: 'phase-beta-design',
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
            phaseId: 'phase-beta-discovery',
            status: 'done',
            startDate: new Date('2024-10-03'),
            endDate: new Date('2024-11-15'),
            effortHours: 120,
            orderIndex: 1,
          },
          {
            name: 'UI/UX Prototype',
            phaseId: 'phase-beta-design',
            status: 'review',
            startDate: new Date('2024-11-18'),
            endDate: new Date('2025-01-31'),
            effortHours: 200,
            orderIndex: 2,
          },
          {
            name: 'Chatbot Integration',
            phaseId: 'phase-beta-design',
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
            id: 'phase-gamma-audit',
            name: 'Audit',
            sortOrder: 1,
            startDate: new Date('2024-03-01'),
            endDate: new Date('2024-04-15'),
          },
          {
            id: 'phase-gamma-stabilize',
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
            phaseId: 'phase-gamma-audit',
            status: 'done',
            startDate: new Date('2024-03-05'),
            endDate: new Date('2024-04-15'),
            effortHours: 140,
            orderIndex: 1,
          },
          {
            name: 'Data Quality Initiative',
            phaseId: 'phase-gamma-stabilize',
            status: 'done',
            startDate: new Date('2024-04-20'),
            endDate: new Date('2024-09-30'),
            effortHours: 320,
            orderIndex: 2,
          },
          {
            name: 'Executive Reporting Enablement',
            phaseId: 'phase-gamma-stabilize',
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

  const acme = await prisma.customer.create({
    data: {
      name: 'Acme Manufacturing',
      type: 'CUSTOMER',
      industry: 'Manufacturing',
      tagsJson: JSON.stringify(['strategic', 'phase2']),
      contacts: {
        create: [
          {
            name: 'Hiro Tanaka',
            role: 'Procurement Lead',
            email: 'hiro.tanaka@acme.example',
            phone: '+81-3-1234-5678',
          },
          {
            name: 'Mina Sato',
            role: 'IT Director',
            email: 'mina.sato@acme.example',
          },
        ],
      },
    },
    include: { contacts: true },
  });

  const acmeOpportunity = await prisma.opportunity.create({
    data: {
      customerId: acme.id,
      title: 'ERP Phase2 Rollout',
      stage: 'NEGOTIATION',
      amount: 18_000_000,
      currency: 'JPY',
      probability: 65,
      ownerUserId: 'user-sales-lead',
      expectedClose: new Date('2025-11-30'),
    },
  });

  const acmeNote = await prisma.interactionNote.create({
    data: {
      customerId: acme.id,
      contactId: acme.contacts[0].id,
      opportunityId: acmeOpportunity.id,
      channel: 'Teams',
      rawText: 'Reviewed pricing model; requested AI-assisted onboarding demo.',
    },
  });

  await prisma.conversationSummary.create({
    data: {
      interactionId: acmeNote.id,
      summaryText: 'Client wants assurance on AI onboarding; follow-up demo scheduled.',
      followupSuggestedJson: JSON.stringify(['Prepare onboarding demo deck', 'Share AI ops runbook preview']),
      confidence: 0.82,
    },
  });

  const acmeQuote = await prisma.quote.create({
    data: {
      quoteNumber: 'Q-2025-0001',
      customerId: acme.id,
      status: 'PENDING_APPROVAL',
      totalAmount: 18_500_000,
      currency: 'JPY',
      items: {
        create: [
          {
            productCode: 'ERP-CORE',
            description: 'ERP core license + support',
            quantity: 1,
            unitPrice: 12_000_000,
          },
          {
            productCode: 'AI-ADDON',
            description: 'AI Ops add-on bundle',
            quantity: 1,
            unitPrice: 6_500_000,
            discountRate: 0.1,
          },
        ],
      },
    },
  });

  const acmeOrder = await prisma.order.create({
    data: {
      orderNumber: 'SO-2025-0001',
      quoteId: acmeQuote.id,
      customerId: acme.id,
      status: 'PENDING',
      paymentTerm: 'Net 30',
      totalAmount: 18_500_000,
    },
  });

  await prisma.creditReview.create({
    data: {
      orderId: acmeOrder.id,
      status: 'APPROVED',
      reviewerUserId: 'user-finance',
      score: 82,
      remarks: 'Credit limit sufficient. Proceed once PO is received.',
      decidedAt: new Date('2025-10-10T02:30:00Z'),
    },
  });

  await prisma.orderAuditLog.create({
    data: {
      orderId: acmeOrder.id,
      changeType: 'status.change',
      payload: JSON.stringify({ from: 'REQUESTED', to: 'APPROVED', reviewer: 'user-finance' }),
      checksum: 'approved-2025-10-10',
    },
  });

  const betaCustomer = await prisma.customer.create({
    data: {
      name: 'Beta Retail Holdings',
      type: 'PROSPECT',
      industry: 'Retail',
      tagsJson: JSON.stringify(['pilot', 'high-touch']),
    },
  });

  await prisma.opportunity.create({
    data: {
      customerId: betaCustomer.id,
      title: 'Retail Expansion CRM',
      stage: 'QUALIFIED',
      amount: 9_800_000,
      currency: 'JPY',
      probability: 45,
      ownerUserId: 'user-crm-specialist',
    },
  });
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
