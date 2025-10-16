import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  await prisma.reviewCycleParticipant.deleteMany();
  await prisma.reviewCycle.deleteMany();
  await prisma.employeeSkillTag.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.skillTag.deleteMany();

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
      name: 'Beta CX Transformation',
      description: 'Customer experience analytics with AI summarization and CRM integration.',
      status: 'active',
      startDate: new Date('2025-02-10'),
      endDate: new Date('2025-09-30'),
      plannedValue: 98000,
      earnedValue: 90000,
      actualCost: 87000,
      phases: {
        create: [
          {
            id: 'phase-beta-discovery',
            name: 'Discovery',
            sortOrder: 1,
            startDate: new Date('2025-02-10'),
            endDate: new Date('2025-03-15'),
          },
          {
            id: 'phase-beta-build',
            name: 'Build',
            sortOrder: 2,
            startDate: new Date('2025-03-16'),
            endDate: new Date('2025-07-31'),
          },
        ],
      },
      tasks: {
        create: [
          {
            name: 'Stakeholder Interviews',
            phaseId: 'phase-beta-discovery',
            status: 'done',
            startDate: new Date('2025-02-10'),
            endDate: new Date('2025-02-18'),
            effortHours: 32,
            orderIndex: 1,
          },
          {
            name: 'AI Interaction Summaries',
            phaseId: 'phase-beta-build',
            status: 'inProgress',
            startDate: new Date('2025-03-20'),
            endDate: new Date('2025-05-10'),
            effortHours: 210,
            orderIndex: 2,
          },
          {
            name: 'CX Dashboard Rollout',
            phaseId: 'phase-beta-build',
            status: 'todo',
            startDate: new Date('2025-06-01'),
            endDate: new Date('2025-08-15'),
            effortHours: 160,
            orderIndex: 3,
          },
        ],
      },
      risks: {
        create: [
          { probability: 30, impact: 4, status: 'monitoring', summary: 'AI summarizer accuracy drift risk' },
          { probability: 20, impact: 2, status: 'new', summary: 'Integration timeline with CRM backend' },
        ],
      },
      burndown: {
        create: [
          { label: 'Sprint 1', planned: 110, actual: 108, orderIndex: 1 },
          { label: 'Sprint 2', planned: 220, actual: 215, orderIndex: 2 },
          { label: 'Sprint 3', planned: 330, actual: 320, orderIndex: 3 },
          { label: 'Sprint 4', planned: 440, actual: 420, orderIndex: 4 },
        ],
      },
      chatThreads: {
        create: [
          {
            provider: 'Teams',
            externalThreadId: 'beta-thread-042',
            channelName: 'beta-cx-weekly',
            summary: 'Discussed AI summarizer accuracy and CRM sync timeline.',
            messages: {
              create: [
                {
                  author: 'ProductOwner',
                  content: 'Need accuracy >92% before pilot; review model prompts.',
                  postedAt: new Date('2025-04-02T09:15:00Z'),
                },
                {
                  author: 'DataLead',
                  content: 'Working on fine-tune dataset with CRM transcripts.',
                  postedAt: new Date('2025-04-02T12:45:00Z'),
                },
                {
                  author: 'CSM',
                  content: 'Pilot retailers willing to test dashboards in June.',
                  postedAt: new Date('2025-04-02T15:20:00Z'),
                },
              ],
            },
          },
        ],
      },
    },
  ];

  const gammaProject = {
    code: 'GAMMA-03',
    name: 'Gamma Compliance Automation',
    description: 'Automate compliance evidence collection across finance and HR.',
    status: 'planning',
    startDate: new Date('2025-05-01'),
    endDate: new Date('2025-12-31'),
    plannedValue: 75000,
    earnedValue: 15000,
    actualCost: 12000,
    phases: {
      create: [
        {
          id: 'phase-gamma-design',
          name: 'Design',
          sortOrder: 1,
          startDate: new Date('2025-05-01'),
          endDate: new Date('2025-06-15'),
        },
        {
          id: 'phase-gamma-automation',
          name: 'Automation Build',
          sortOrder: 2,
          startDate: new Date('2025-06-16'),
          endDate: new Date('2025-10-31'),
        },
      ],
    },
    tasks: {
      create: [
        {
          name: 'Compliance Requirement Mapping',
          phaseId: 'phase-gamma-design',
          status: 'inProgress',
          startDate: new Date('2025-05-05'),
          endDate: new Date('2025-05-25'),
          effortHours: 120,
          orderIndex: 1,
        },
        {
          name: 'Evidence Collector Bot',
          phaseId: 'phase-gamma-automation',
          status: 'todo',
          startDate: new Date('2025-07-01'),
          endDate: new Date('2025-08-31'),
          effortHours: 200,
          orderIndex: 2,
        },
      ],
    },
    risks: {
      create: [
        { probability: 35, impact: 3, status: 'new', summary: 'Regulatory change mid-project' },
      ],
    },
    burndown: {
      create: [
        { label: 'Sprint 1', planned: 80, actual: 78, orderIndex: 1 },
        { label: 'Sprint 2', planned: 160, actual: 150, orderIndex: 2 },
      ],
    },
    chatThreads: {
      create: [
        {
          provider: 'Slack',
          externalThreadId: 'gamma-thread-015',
          channelName: 'gamma-compliance-weekly',
          summary: 'Discussed evidence automation scope and dependency on HR data export.',
          messages: {
            create: [
              {
                author: 'ComplianceLead',
                content: 'Need integration with HR data export before automation sprint.',
                postedAt: new Date('2025-05-10T10:00:00Z'),
              },
              {
                author: 'AutomationEngineer',
                content: 'Prototype bot ready for demo next sprint.',
                postedAt: new Date('2025-05-10T12:15:00Z'),
              },
            ],
          },
        },
      ],
    },
  };

  for (const project of projects) {
    await prisma.project.create({
      data: project,
    });
  }

  await prisma.project.create({
    data: gammaProject,
  });

  const acme = await prisma.customer.create({
    data: {
      name: 'Acme Manufacturing',
      type: 'CUSTOMER',
      industry: 'Manufacturing',
      ownerUserId: 'user-sdr-001',
      tagsJson: JSON.stringify(['key-account', 'renewal-2025']),
      contacts: {
        create: [
          {
            name: 'Keiko Tanaka',
            role: 'COO',
            email: 'keiko.tanaka@acme.example.com',
            phone: '+81-3-1234-5678',
            slackUserId: 'U02COO',
          },
          {
            name: 'Ryohei Sato',
            role: 'Finance Director',
            email: 'ryohei.sato@acme.example.com',
            phone: '+81-3-2345-6789',
            slackUserId: 'U03FIN',
          },
        ],
      },
    },
    include: { contacts: true },
  });

  const acmeOpp = await prisma.opportunity.create({
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
      opportunityId: acmeOpp.id,
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
      totalAmount: acmeQuote.totalAmount,
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

  const skillTagsSeedPath = resolve(__dirname, '..', '..', '..', 'db', 'seeds', 'hr', 'skill-tags.json');
  const skillTagPayloads = JSON.parse(readFileSync(skillTagsSeedPath, 'utf8')) as Array<{
    tag: string;
    description: string;
    category: string;
    weight?: number;
  }>;

  const skillTagRecords = await Promise.all(
    skillTagPayloads.map((payload) =>
      prisma.skillTag.create({
        data: {
          tag: payload.tag,
          description: payload.description,
          category: payload.category,
          weight: payload.weight ?? 0,
        },
      }),
    ),
  );

  const skillTagMap = new Map(skillTagRecords.map((record) => [record.tag, record.id]));

  const employeeSeed = [
    {
      name: 'Mina Kato',
      email: 'mina.kato@itdo.example.com',
      tags: ['project_management', 'nestjs'],
    },
    {
      name: 'Sara Fujimoto',
      email: 'sara.fujimoto@itdo.example.com',
      tags: ['react_ui', 'ai_prompting'],
    },
    {
      name: 'Kenji Morita',
      email: 'kenji.morita@itdo.example.com',
      tags: ['hr_policy', 'project_management'],
    },
  ];

  const employees = await Promise.all(
    employeeSeed.map((employee) => {
      const assignments = employee.tags
        .map((tag) => skillTagMap.get(tag))
        .filter((value): value is string => Boolean(value));

      return prisma.employee.create({
        data: {
          name: employee.name,
          email: employee.email,
          skills: {
            create: assignments.map((skillTagId) => ({ skillTagId })),
          },
        },
      });
    }),
  );

  const reviewCyclesSeed = [
    {
      cycleName: 'FY2025-H1 Performance Review',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-06-30'),
      participants: employees.map((employee) => employee.id),
    },
    {
      cycleName: 'FY2025-H2 Midpoint Check-in',
      startDate: new Date('2025-10-01'),
      endDate: new Date('2025-12-15'),
      participants: employees.slice(0, 2).map((employee) => employee.id),
    },
  ];

  await Promise.all(
    reviewCyclesSeed.map((cycle) =>
      prisma.reviewCycle.create({
        data: {
          cycleName: cycle.cycleName,
          startDate: cycle.startDate,
          endDate: cycle.endDate,
          participants: {
            create: cycle.participants.map((employeeId) => ({ employeeId })),
          },
        },
      }),
    ),
  );
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
