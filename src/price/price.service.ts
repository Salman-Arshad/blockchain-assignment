import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Price } from './entities/price.entity';
import { Repository, Between, LessThan } from 'typeorm';
import { Alert } from './entities/alert.entity';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Cron, CronExpression } from '@nestjs/schedule';
import Moralis from 'moralis';
import { EvmChain } from '@moralisweb3/common-evm-utils';
import axios from 'axios';
@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(Price)
    private pricesRepository: Repository<Price>,

    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,

    @Inject('MORALIS') private readonly moralis: typeof Moralis,

    private configService: ConfigService,
  ) {
    // Configure the email transporter using environment variables
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure: this.configService.get<boolean>('EMAIL_SECURE'), // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    });
  }

  // Scheduled task to run every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    await this.fetchAndSavePrices();
    await this.checkPriceIncrease();
    await this.checkAlerts();
  }

  // Fetch and save prices for Ethereum and Polygon
  async fetchAndSavePrices() {
    const chains = ['ethereum', 'polygon'];
    for (const chain of chains) {
      try {
        const price = await this.fetchPrice(chain);
        const priceEntity = this.pricesRepository.create({ chain, price });
        await this.pricesRepository.save(priceEntity);
        this.logger.log(`Saved price for ${chain}: $${price}`);
      } catch (error) {
        this.logger.error(
          `Error fetching/saving price for ${chain}: ${error.message}`,
        );
      }
    }
  }
  // Fetch price using Moralis SDK
  async fetchPrice(chain: string): Promise<number> {
    const coinGeckoIds = {
      ethereum: 'ethereum',
      polygon: 'matic-network',
      bitcoin: 'bitcoin',
      // solana: 'solana',
    };

    const coinId = coinGeckoIds[chain.toLowerCase()];
    if (!coinId) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: {
            ids: coinId,
            vs_currencies: 'usd',
          },
        },
      );
      const price = response.data[coinId].usd;
      return price;
    } catch (error) {
      this.logger.error(`Failed to fetch price for ${chain}: ${error.message}`);
      throw new Error(`Failed to fetch price for ${chain}`);
    }
  }
  // Fetch Bitcoin price using axios and CoinGecko API
  async fetchBitcoinPrice(): Promise<number> {
    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price',
        {
          params: {
            ids: 'bitcoin',
            vs_currencies: 'usd',
          },
        },
      );
      const price = response.data['bitcoin'].usd;
      return price;
    } catch (error) {
      this.logger.error(`Failed to fetch Bitcoin price: ${error.message}`);
      throw new Error('Failed to fetch Bitcoin price');
    }
  }

  // Check if price increased by more than 3% compared to one hour ago
  async checkPriceIncrease() {
    const chains = ['ethereum', 'polygon', 'bitcoin', 'solana'];
    for (const chain of chains) {
      try {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const currentPriceRecord = await this.pricesRepository.findOne({
          where: { chain },
          order: { timestamp: 'DESC' },
        });

        const pastPriceRecord = await this.pricesRepository.findOne({
          where: { chain, timestamp: LessThan(oneHourAgo) },
          order: { timestamp: 'DESC' },
        });

        if (currentPriceRecord && pastPriceRecord) {
          const currentPrice = parseFloat(currentPriceRecord.price.toString());
          const pastPrice = parseFloat(pastPriceRecord.price.toString());
          const increasePercentage =
            ((currentPrice - pastPrice) / pastPrice) * 100;

          if (increasePercentage > 3) {
            await this.sendEmailNotification(chain, increasePercentage);
          }
        }
      } catch (error) {
        this.logger.error(
          `Error checking price increase for ${chain}: ${error.message}`,
        );
      }
    }
  }


  async sendEmailNotification(chain: string, increasePercentage: number) {
    try {
      const mailOptions = {
        from: this.configService.get<string>('EMAIL_USER'),
        to: 'hyperhire_assignment@hyperhire.in',
        subject: `${chain.toUpperCase()} Price Alert`,
        text: `The price of ${chain.toUpperCase()} has increased by ${increasePercentage.toFixed(
          2,
        )}% in the last hour.`,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Price increase notification sent for ${chain}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email notification for ${chain}: ${error.message}`,
      );
    }
  }


  async getHourlyPrices(chain: string) {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const prices = await this.pricesRepository.find({
        where: {
          chain,
          timestamp: Between(twentyFourHoursAgo, now),
        },
        order: { timestamp: 'ASC' },
      });

      return prices;
    } catch (error) {
      this.logger.error(
        `Error fetching hourly prices for ${chain}: ${error.message}`,
      );
      throw new Error(`Failed to get hourly prices for ${chain}`);
    }
  }


  async setPriceAlert(chain: string, targetPrice: number, email: string) {
    try {
      const alert = this.alertsRepository.create({ chain, targetPrice, email });
      await this.alertsRepository.save(alert);
      this.logger.log(`Price alert set for ${chain} at $${targetPrice}`);
      return { message: 'Alert set successfully' };
    } catch (error) {
      this.logger.error(
        `Error setting price alert for ${chain}: ${error.message}`,
      );
      throw new Error('Failed to set price alert');
    }
  }

  async checkAlerts() {
    try {
      const alerts = await this.alertsRepository.find();

      for (const alert of alerts) {
        const currentPrice = await this.fetchPrice(alert.chain);
        if (currentPrice >= parseFloat(alert.targetPrice.toString())) {
          await this.sendCustomEmail(alert.email, alert.chain, currentPrice);
          await this.alertsRepository.delete(alert.id);
        }
      }
    } catch (error) {
      this.logger.error(`Error checking alerts: ${error.message}`);
    }
  }

  // Send custom email for user-set alerts
  async sendCustomEmail(email: string, chain: string, price: number) {
    try {
      const mailOptions = {
        from: this.configService.get<string>('EMAIL_USER'),
        to: email,
        subject: `${chain.toUpperCase()} Price Alert`,
        text: `${chain.toUpperCase()} has reached your target price of $${price.toFixed(2)}.`,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Custom alert email sent to ${email} for ${chain}`);
    } catch (error) {
      this.logger.error(
        `Failed to send custom email to ${email}: ${error.message}`,
      );
    }
  }

  async getSwapRate(amountInEth: number) {
    try {
      const ethPrice = await this.fetchPrice('ethereum');
      const btcPrice = await this.fetchBitcoinPrice();

      const amountInUsd = amountInEth * ethPrice;
      const amountInBtc = amountInUsd / btcPrice;

      const feePercentage = 0.03;
      const feeInEth = amountInEth * feePercentage;
      const feeInUsd = feeInEth * ethPrice;

      return {
        btcAmount: amountInBtc - feeInUsd / btcPrice,
        feeEth: feeInEth,
        feeUSD: feeInUsd,
      };
    } catch (error) {
      this.logger.error(`Error calculating swap rate: ${error.message}`);
      throw new Error('Failed to get swap rate');
    }
  }
}
