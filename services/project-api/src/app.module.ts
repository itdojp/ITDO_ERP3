import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectModule } from './projects/project.module';
import { BillingModule } from './billing/billing.module';
import { CrmModule } from './crm/module';
import { SalesModule } from './sales/module';
import { HrModule } from './hr/module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'dist/schema.gql'),
      sortSchema: true,
      path: '/graphql',
    }),
    ProjectModule,
    BillingModule,
    CrmModule,
    SalesModule,
    HrModule,
  ],
})
export class AppModule {}
