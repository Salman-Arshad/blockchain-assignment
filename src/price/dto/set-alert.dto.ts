import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNumber, IsEnum } from 'class-validator';
import { Chain } from '../enums/chain.enum';

export class SetAlertDto {
  @ApiProperty({ description: 'Blockchain chain name', enum: Chain })
  @IsEnum(Chain, { message: 'chain must be a valid blockchain name' })
  chain: Chain;

  @ApiProperty()
  @IsNumber()
  targetPrice: number;

  @ApiProperty()
  @IsEmail()
  email: string;
}
