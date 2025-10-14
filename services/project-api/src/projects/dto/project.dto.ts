import { ArgsType, Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ChatProvider, ProjectStatus } from '../models/project.model';

export class ListProjectsFilterDto {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}

@ArgsType()
export class ProjectFilterArgs extends ListProjectsFilterDto {
  @Field(() => ProjectStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}

export class CreateProjectDto {
  @IsString()
  @MaxLength(20)
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

@InputType()
export class CreateProjectInput extends CreateProjectDto {
  @Field()
  code!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  startDate!: string;

  @Field({ nullable: true })
  endDate?: string;
}

export class CreateChatThreadDto {
  @IsEnum(ChatProvider)
  provider!: ChatProvider;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  channelName?: string;
}

@InputType()
export class CreateChatThreadInput extends CreateChatThreadDto {
  @Field(() => ChatProvider)
  provider!: ChatProvider;

  @Field({ nullable: true })
  channelName?: string;
}

@ArgsType()
export class ProvisionChatThreadArgs {
  @Field(() => CreateChatThreadInput)
  @Type(() => CreateChatThreadInput)
  input!: CreateChatThreadInput;
}

export class ChatSummarySearchDto {
  @IsString()
  @MaxLength(500)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  top?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number;
}
