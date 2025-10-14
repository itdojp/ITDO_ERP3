import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CrmService } from './service';
import {
  AddInteractionNoteInput,
  CreateCustomerInput,
  CreateOpportunityInput,
  UpdateCustomerInput,
} from './dto/crm.input';
import { CustomerModel, InteractionNoteModel, OpportunityModel } from './models/crm.model';

@Controller('api/v1/crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('customers')
  listCustomers(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('industry') industry?: string,
  ): Promise<CustomerModel[]> {
    const filter = search || type || industry ? { search, type, industry } : undefined;
    return this.crmService.listCustomers(filter);
  }

  @Post('customers')
  createCustomer(@Body() input: CreateCustomerInput): Promise<CustomerModel> {
    return this.crmService.createCustomer(input);
  }

  @Patch('customers/:id')
  updateCustomer(
    @Param('id') id: string,
    @Body() input: UpdateCustomerInput,
  ): Promise<CustomerModel> {
    return this.crmService.updateCustomer(id, input);
  }

  @Get('customers/:id/opportunities')
  customerOpportunities(@Param('id') id: string): Promise<OpportunityModel[]> {
    return this.crmService.listOpportunities(id);
  }

  @Post('opportunities')
  createOpportunity(@Body() input: CreateOpportunityInput): Promise<OpportunityModel> {
    return this.crmService.createOpportunity(input);
  }

  @Post('interaction-notes')
  addInteractionNote(@Body() input: AddInteractionNoteInput): Promise<InteractionNoteModel> {
    return this.crmService.addInteractionNote(input);
  }
}
