/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotFoundException } from '@nestjs/common';
import { CrmService } from './service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  customer: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  opportunity: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  interactionNote: {
    create: jest.Mock;
  };
  conversationSummary: {
    create: jest.Mock;
  };
};

const baseCustomer = {
  id: 'cust-1',
  name: 'ITDO Corp.',
  type: 'CUSTOMER',
  industry: 'SaaS',
  ownerUserId: 'user-1',
  tagsJson: '["priority","phase3"]',
  createdAt: new Date('2025-03-01T00:00:00Z'),
  updatedAt: new Date('2025-03-02T00:00:00Z'),
  contacts: [
    {
      id: 'contact-1',
      name: 'Mina Ito',
      role: 'CTO',
      email: 'mina@itdo.example.com',
      phone: null,
      createdAt: new Date('2025-03-01T00:00:00Z'),
    },
  ],
  opportunities: [
    {
      id: 'op-1',
      customerId: 'cust-1',
      title: 'Phase3 Rollout',
      stage: 'PROPOSAL',
      amount: 2500000,
      currency: 'JPY',
      probability: 0.6,
      expectedClose: new Date('2025-04-15T00:00:00Z'),
      notes: [
        {
          id: 'note-1',
          channel: 'email',
          rawText: '確認中',
          occurredAt: new Date('2025-03-03T09:00:00Z'),
          createdAt: new Date('2025-03-03T09:05:00Z'),
          summary: {
            id: 'summary-1',
            summaryText: '顧客は見積りをレビュー中。',
            followupSuggestedJson: '["2日後にフォロー"]',
            confidence: 0.9,
            createdAt: new Date('2025-03-03T09:06:00Z'),
          },
        },
      ],
    },
  ],
};

describe('CrmService', () => {
  let prisma: PrismaMock;
  let service: CrmService;

  beforeEach(() => {
    prisma = {
      customer: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      opportunity: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      interactionNote: {
        create: jest.fn(),
      },
      conversationSummary: {
        create: jest.fn(),
      },
    };

    service = new CrmService(prisma as unknown as PrismaService);
  });

  describe('listCustomers', () => {
    it('returns mapped customers with relationships', async () => {
      prisma.customer.findMany.mockResolvedValue([baseCustomer]);

      const customers = await service.listCustomers();

      expect(prisma.customer.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { updatedAt: 'desc' },
        include: {
          contacts: true,
          opportunities: {
            orderBy: { createdAt: 'desc' },
            include: { notes: { orderBy: { createdAt: 'desc' }, include: { summary: true } } },
          },
        },
      });
      expect(customers[0].opportunities[0].notes[0].summary?.followupSuggested).toEqual(['2日後にフォロー']);
    });

    it('applies filters and search', async () => {
      prisma.customer.findMany.mockResolvedValue([baseCustomer]);

      await service.listCustomers({
        type: 'PARTNER',
        industry: 'Manufacturing',
        search: 'phase3',
      });

      expect(prisma.customer.findMany).toHaveBeenCalledWith({
        where: {
          type: 'PARTNER',
          industry: { equals: 'Manufacturing', mode: 'insensitive' },
          OR: [
            { name: { contains: 'phase3', mode: 'insensitive' } },
            { industry: { contains: 'phase3', mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          contacts: true,
          opportunities: {
            orderBy: { createdAt: 'desc' },
            include: { notes: { orderBy: { createdAt: 'desc' }, include: { summary: true } } },
          },
        },
      });
    });
  });

  describe('getCustomer', () => {
    it('returns mapped customer when found', async () => {
      prisma.customer.findUnique.mockResolvedValue(baseCustomer);

      const customer = await service.getCustomer('cust-1');

      expect(prisma.customer.findUnique).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        include: {
          contacts: true,
          opportunities: {
            orderBy: { createdAt: 'desc' },
            include: { notes: { orderBy: { createdAt: 'desc' }, include: { summary: true } } },
          },
        },
      });
      expect(customer.tags).toEqual(['priority', 'phase3']);
    });

    it('throws when customer does not exist', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.getCustomer('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCustomer', () => {
    it('creates customer with defaults', async () => {
      prisma.customer.create.mockResolvedValue({
        ...baseCustomer,
        type: 'CUSTOMER',
        industry: null,
        ownerUserId: null,
        tagsJson: '[]',
      });

      const result = await service.createCustomer({
        name: 'New Customer',
      });

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: {
          name: 'New Customer',
          type: 'CUSTOMER',
          industry: null,
          ownerUserId: null,
          tagsJson: JSON.stringify([]),
        },
        include: {
          contacts: true,
          opportunities: {
            include: { notes: { include: { summary: true } } },
          },
        },
      });
      expect(result.tags).toEqual([]);
    });
  });

  describe('updateCustomer', () => {
    it('updates customer and re-hydrates relations', async () => {
      prisma.customer.update.mockResolvedValue({
        ...baseCustomer,
        name: 'Updated',
        tagsJson: JSON.stringify(['vip']),
      });

      const customer = await service.updateCustomer('cust-1', {
        name: 'Updated',
        tags: ['vip'],
      });

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: {
          name: 'Updated',
          type: undefined,
          industry: undefined,
          ownerUserId: undefined,
          tagsJson: JSON.stringify(['vip']),
        },
        include: {
          contacts: true,
          opportunities: {
            include: { notes: { include: { summary: true } } },
          },
        },
      });
      expect(customer.name).toBe('Updated');
      expect(customer.tags).toEqual(['vip']);
    });
  });

  describe('createOpportunity', () => {
    it('creates opportunity after verifying customer exists', async () => {
      prisma.customer.count.mockResolvedValue(1);
      prisma.opportunity.create.mockResolvedValue(baseCustomer.opportunities[0]);

      const opportunity = await service.createOpportunity({
        customerId: 'cust-1',
        title: 'Phase3 Rollout',
      });

      expect(prisma.customer.count).toHaveBeenCalledWith({ where: { id: 'cust-1' } });
      expect(prisma.opportunity.create).toHaveBeenCalledWith({
        data: {
          customerId: 'cust-1',
          title: 'Phase3 Rollout',
          stage: 'LEAD',
          amount: 0,
          currency: 'JPY',
          probability: null,
          expectedClose: null,
        },
        include: { notes: { include: { summary: true }, orderBy: { createdAt: 'desc' } } },
      });
      expect(opportunity.notes).toHaveLength(1);
    });

    it('throws when customer does not exist', async () => {
      prisma.customer.count.mockResolvedValue(0);

      await expect(
        service.createOpportunity({
          customerId: 'missing',
          title: 'Phase3 Rollout',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addInteractionNote', () => {
    it('creates note and optional summary', async () => {
      prisma.customer.count.mockResolvedValue(1);
      prisma.interactionNote.create.mockResolvedValue({
        id: 'note-1',
        channel: 'call',
        rawText: 'ヒアリング実施',
        occurredAt: new Date('2025-03-05T10:00:00Z'),
        createdAt: new Date('2025-03-05T10:05:00Z'),
        summary: null,
      });

      await service.addInteractionNote({
        customerId: 'cust-1',
        channel: 'call',
        rawText: 'ヒアリング実施',
        summaryText: '要件定義フェーズに進む',
        followups: ['3月10日に契約ステータス確認'],
        confidence: 0.8,
      });

      expect(prisma.interactionNote.create).toHaveBeenCalledWith({
        data: {
          customerId: 'cust-1',
          contactId: null,
          opportunityId: null,
          channel: 'call',
          rawText: 'ヒアリング実施',
        },
        include: { summary: true },
      });
      expect(prisma.conversationSummary.create).toHaveBeenCalledWith({
        data: {
          interactionId: 'note-1',
          summaryText: '要件定義フェーズに進む',
          followupSuggestedJson: JSON.stringify(['3月10日に契約ステータス確認']),
          confidence: 0.8,
        },
      });
    });
  });

  describe('listOpportunities', () => {
    it('returns mapped opportunities', async () => {
      prisma.opportunity.findMany.mockResolvedValue(baseCustomer.opportunities);

      const result = await service.listOpportunities('cust-1');

      expect(prisma.opportunity.findMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1' },
        orderBy: { createdAt: 'desc' },
        include: { notes: { include: { summary: true }, orderBy: { createdAt: 'desc' } } },
      });
      expect(result[0].notes[0].summary?.summaryText).toBe('顧客は見積りをレビュー中。');
    });
  });
});
