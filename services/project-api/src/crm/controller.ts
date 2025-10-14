import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CrmService } from './service';
import {
  AddInteractionNoteInput,
  CreateCustomerInput,
  CreateOpportunityInput,
  CustomerFilterInput,
  UpdateCustomerInput,
} from './dto/customer.input';
import { CustomerModel, InteractionNoteModel, OpportunityModel } from './models/customer.model';

@Controller('api/v1/crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('customers')
  listCustomers(@Query() filter?: CustomerFilterInput): Promise<CustomerModel[]> {
    return this.crmService.listCustomers(filter);
  }

  @Get('customers/:id')
  getCustomer(@Param('id') id: string): Promise<CustomerModel> {
    return this.crmService.getCustomer(id);
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
  listOpportunities(@Param('id') customerId: string): Promise<OpportunityModel[]> {
    return this.crmService.listOpportunities(customerId);
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
