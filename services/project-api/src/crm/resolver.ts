import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class CrmResolver {
  @Query(() => [String])
  sampleCrm() {
    return [];
  }
}
