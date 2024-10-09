import { IsString, IsEmail, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Chain } from '../enums/chain.enum';

export class SetAlertDto {
  @ApiProperty({ description: 'Blockchain chain name', enum: Chain })
  @IsEnum(Chain, { message: 'chain must be a valid blockchain name' })
  chain: Chain;
  
  @ApiProperty({ description: 'Target price for the alert' })
  @IsNumber()
  targetPrice: number;

  @ApiProperty({ description: 'Email address to receive the alert' })
  @IsEmail()
  email: string;
}