import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CrmService } from './service';
import {
  AddInteractionNoteInput,
  CreateCustomerInput,
  CreateOpportunityInput,
  CustomerFilterInput,
  UpdateCustomerInput,
} from './dto/customer.input';
import {
  CustomerModel,
  InteractionNoteModel,
  OpportunityModel,
} from './models/customer.model';

@Resolver(() => CustomerModel)
export class CrmResolver {
  constructor(private readonly crmService: CrmService) {}

  @Query(() => [CustomerModel])
  customers(@Args('filter', { nullable: true }) filter?: CustomerFilterInput): Promise<CustomerModel[]> {
    return this.crmService.listCustomers(filter);
  }

  @Query(() => CustomerModel)
  customer(@Args('id') id: string): Promise<CustomerModel> {
    return this.crmService.getCustomer(id);
  }

  @Mutation(() => CustomerModel)
  createCustomer(@Args('input') input: CreateCustomerInput): Promise<CustomerModel> {
    return this.crmService.createCustomer(input);
  }

  @Mutation(() => CustomerModel)
  updateCustomer(
    @Args('id') id: string,
    @Args('input') input: UpdateCustomerInput,
  ): Promise<CustomerModel> {
    return this.crmService.updateCustomer(id, input);
  }

  @Mutation(() => OpportunityModel)
  createOpportunity(@Args('input') input: CreateOpportunityInput): Promise<OpportunityModel> {
    return this.crmService.createOpportunity(input);
  }

  @Query(() => [OpportunityModel])
  customerOpportunities(@Args('customerId') customerId: string): Promise<OpportunityModel[]> {
    return this.crmService.listOpportunities(customerId);
  }

  @Mutation(() => InteractionNoteModel)
  addInteractionNote(@Args('input') input: AddInteractionNoteInput): Promise<InteractionNoteModel> {
    return this.crmService.addInteractionNote(input);
  }
}
