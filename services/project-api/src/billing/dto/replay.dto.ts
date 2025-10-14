import { ContractEventPayload } from '../../../../../shared/contracts/lifecycle';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ReplayEventType {
  ISSUED = 'ISSUED',
  SIGNED = 'SIGNED',
  ACTIVATED = 'ACTIVATED',
  RENEWED = 'RENEWED',
  TERMINATED = 'TERMINATED',
}

export class ReplayInvoiceDto {
  @IsString()
  @MaxLength(120)
  contractId!: string;

  @IsString()
  @MaxLength(120)
  contractCode!: string;

  @IsEnum(ReplayEventType)
  eventType!: ContractEventPayload['type'];

  @IsOptional()
  @IsEmail()
  customerEmail?: string;
}
