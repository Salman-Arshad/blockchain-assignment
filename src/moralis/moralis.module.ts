import { Module, Global } from '@nestjs/common';
import Moralis from 'moralis';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  providers: [
    {
      provide: 'MORALIS',
      useFactory: async (configService: ConfigService) => {
        await Moralis.start({
          apiKey: configService.get<string>('MORALIS_API_KEY'),
        });
        return Moralis;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['MORALIS'],
})
export class MoralisModule {}
