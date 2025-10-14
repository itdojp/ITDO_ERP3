import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddInteractionNoteInput,
  CreateCustomerInput,
  CreateOpportunityInput,
  UpdateCustomerInput,
} from './dto/crm.input';
import {
  ContactModel,
  ConversationSummaryModel,
  CustomerModel,
  InteractionNoteModel,
  OpportunityModel,
} from './models/crm.model';

type CustomerFilter = {
  search?: string;
  type?: string;
  industry?: string;
};

interface ConversationSummaryEntity {
  id: string;
  summaryText: string;
  followupSuggestedJson: string;
  confidence: number | null;
  createdAt: Date;
}

interface InteractionNoteEntity {
  id: string;
  channel: string;
  rawText: string;
  occurredAt: Date;
  createdAt: Date;
  summary: ConversationSummaryEntity | null;
}

interface ContactEntity {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  createdAt: Date;
}

interface OpportunityEntity {
  id: string;
  customerId: string;
  title: string;
  stage: string;
  amount: number | null;
  currency: string;
  probability: number | null;
  expectedClose: Date | null;
  notes: InteractionNoteEntity[];
}

interface CustomerEntity {
  id: string;
  name: string;
  type: string;
  industry: string | null;
  ownerUserId: string | null;
  tagsJson: string;
  createdAt: Date;
  updatedAt: Date;
  contacts: ContactEntity[];
  opportunities: OpportunityEntity[];
}

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers(filter?: CustomerFilter): Promise<CustomerModel[]> {
    const where: Prisma.CustomerWhereInput = {};

    const filterValues: CustomerFilter = filter ? { ...filter } : {};

    if (filterValues.type) {
      where.type = filterValues.type;
    }

    if (filterValues.industry) {
      where.industry = { equals: filterValues.industry, mode: 'insensitive' };
    }

    if (filterValues.search) {
      where.OR = [
        { name: { contains: filterValues.search, mode: 'insensitive' } },
        { industry: { contains: filterValues.search, mode: 'insensitive' } },
      ];
    }

    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        contacts: true,
        opportunities: {
          orderBy: { createdAt: 'desc' },
          include: {
            notes: {
              orderBy: { createdAt: 'desc' },
              include: { summary: true },
            },
          },
        },
      },
    });

    return (customers as CustomerEntity[]).map((entity) => this.mapCustomer(entity));
  }

  async getCustomer(id: string): Promise<CustomerModel> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        contacts: true,
        opportunities: {
          orderBy: { createdAt: 'desc' },
          include: {
            notes: {
              orderBy: { createdAt: 'desc' },
              include: { summary: true },
            },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    return this.mapCustomer(customer as CustomerEntity);
  }

  async createCustomer(input: CreateCustomerInput): Promise<CustomerModel> {
    const customer = await this.prisma.customer.create({
      data: {
        name: input.name,
        type: input.type ?? 'CUSTOMER',
        industry: input.industry,
        ownerUserId: input.ownerUserId,
        tagsJson: JSON.stringify(input.tags ?? []),
      },
      include: {
        contacts: true,
        opportunities: {
          include: { notes: { include: { summary: true } } },
        },
      },
    });

    return this.mapCustomer(customer);
  }

  async updateCustomer(id: string, input: UpdateCustomerInput): Promise<CustomerModel> {
    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        name: input.name ?? undefined,
        type: input.type ?? undefined,
        industry: input.industry ?? undefined,
        ownerUserId: input.ownerUserId ?? undefined,
        tagsJson: input.tags ? JSON.stringify(input.tags) : undefined,
      },
      include: {
        contacts: true,
        opportunities: {
          include: { notes: { include: { summary: true } } },
        },
      },
    });

    return this.mapCustomer(customer);
  }

  async createOpportunity(input: CreateOpportunityInput): Promise<OpportunityModel> {
    await this.assertCustomerExists(input.customerId);

    const opportunity = await this.prisma.opportunity.create({
      data: {
        customerId: input.customerId,
        title: input.title,
        stage: input.stage ?? 'LEAD',
        amount: input.amount ?? 0,
        currency: input.currency ?? 'JPY',
        probability: input.probability ?? null,
        expectedClose: input.expectedClose ?? null,
      },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { summary: true },
        },
      },
    });

    return this.mapOpportunity(opportunity as OpportunityEntity);
  }

  async addInteractionNote(input: AddInteractionNoteInput): Promise<InteractionNoteModel> {
    await this.assertCustomerExists(input.customerId);

    const note = await this.prisma.interactionNote.create({
      data: {
        customerId: input.customerId,
        contactId: input.contactId ?? null,
        opportunityId: input.opportunityId ?? null,
        channel: input.channel,
        rawText: input.rawText,
      },
    });

    if (input.summaryText || (input.followups && input.followups.length)) {
      await this.prisma.conversationSummary.create({
        data: {
          interactionId: note.id,
          summaryText: input.summaryText ?? '',
          followupSuggestedJson: JSON.stringify(input.followups ?? []),
          confidence: input.confidence ?? 0,
        },
      });
    }

    return this.getInteractionNote(note.id);
  }

  async listOpportunities(customerId: string): Promise<OpportunityModel[]> {
    const opportunities = await this.prisma.opportunity.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { summary: true },
        },
      },
    });

    return (opportunities as OpportunityEntity[]).map((op) => this.mapOpportunity(op));
  }

  private async getInteractionNote(id: string): Promise<InteractionNoteModel> {
    const note = await this.prisma.interactionNote.findUnique({
      where: { id },
      include: {
        summary: true,
      },
    });

    if (!note) {
      throw new NotFoundException(`Interaction note ${id} not found`);
    }

    return this.mapInteractionNote(note as InteractionNoteEntity);
  }

  private async assertCustomerExists(id: string): Promise<void> {
    const exists = await this.prisma.customer.count({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
  }

  private mapCustomer(entity: CustomerEntity): CustomerModel {
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      industry: entity.industry ?? undefined,
      ownerUserId: entity.ownerUserId ?? undefined,
      tags: this.safeParseStringArray(entity.tagsJson),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      contacts: entity.contacts.map((contact) => this.mapContact(contact)),
      opportunities: entity.opportunities.map((opportunity) => this.mapOpportunity(opportunity)),
    };
  }

  private mapContact(entity: ContactEntity): ContactModel {
    return {
      id: entity.id,
      name: entity.name,
      role: entity.role ?? undefined,
      email: entity.email ?? undefined,
      phone: entity.phone ?? undefined,
      createdAt: entity.createdAt,
    };
  }

  private mapOpportunity(entity: OpportunityEntity): OpportunityModel {
    return {
      id: entity.id,
      title: entity.title,
      stage: entity.stage,
      amount: entity.amount ?? 0,
      currency: entity.currency,
      probability: entity.probability ?? undefined,
      expectedClose: entity.expectedClose ?? undefined,
      notes: entity.notes.map((note) => this.mapInteractionNote(note)),
    };
  }

  private mapInteractionNote(entity: InteractionNoteEntity): InteractionNoteModel {
    return {
      id: entity.id,
      channel: entity.channel,
      rawText: entity.rawText,
      occurredAt: entity.occurredAt,
      createdAt: entity.createdAt,
      summary: entity.summary ? this.mapSummary(entity.summary) : undefined,
    };
  }

  private mapSummary(entity: ConversationSummaryEntity): ConversationSummaryModel {
    return {
      id: entity.id,
      summaryText: entity.summaryText,
      followupSuggested: this.safeParseStringArray(entity.followupSuggestedJson),
      confidence: entity.confidence ?? 0,
      createdAt: entity.createdAt,
    };
  }

  private safeParseStringArray(value: string | null | undefined): string[] {
    if (!value) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
      return [];
    } catch {
      return [];
    }
  }
}
