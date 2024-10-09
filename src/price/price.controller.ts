import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { PriceService } from './price.service';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { SetAlertDto } from './dto/set-alert.dto';
// import { SwapRateDto } from './dto/swap-rate.dto';

@ApiTags('prices')
@Controller('prices')
export class PriceController {
  constructor(private readonly pricesService: PriceService) {}

  @Get('hourly')
  @ApiOperation({ summary: 'Get hourly prices within the last 24 hours' })
  @ApiQuery({ name: 'chain', required: true })
  async getHourlyPrices(@Query('chain') chain: string) {
    return this.pricesService.getHourlyPrices(chain);
  }

  @Post('alerts')
  @ApiOperation({ summary: 'Set a price alert' })
  async setPriceAlert(@Body() setAlertDto: SetAlertDto) {
    const { chain, targetPrice, email } = setAlertDto;
    return this.pricesService.setPriceAlert(chain, targetPrice, email);
  }

  @Get('swap-rate')
  @ApiOperation({ summary: 'Get swap rate from ETH to BTC' })
  @ApiQuery({
    name: 'amount',
    required: true,
    description: 'Amount in Ethereum',
  })
  async getSwapRate(@Query('amount') amount: number) {
    return this.pricesService.getSwapRate(amount);
  }
}
