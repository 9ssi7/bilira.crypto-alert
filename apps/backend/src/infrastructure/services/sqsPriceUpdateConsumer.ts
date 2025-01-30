import { SQS } from 'aws-sdk';
import { Consumer } from 'sqs-consumer';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { CoinRepository } from '../../core/domain/coin';
import { CoinPriceHistoryRepository } from '../../core/domain/coin-price-history';

interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: string;
}

export class SQSPriceUpdateConsumer {
  private consumer: Consumer;
  private tracer = trace.getTracer('price-update-consumer');

  constructor(
    private coinRepository: CoinRepository,
    private priceHistoryRepository: CoinPriceHistoryRepository,
    private queueUrl: string
  ) {
    if (!queueUrl) {
      throw new Error('PRICE_UPDATE_QUEUE_URL environment variable is required');
    }

    this.consumer = Consumer.create({
      queueUrl: this.queueUrl,
      handleMessage: async (message: SQS.Message) => {
        await this.processMessage(message);
      },
      batchSize: 10,
      pollingWaitTimeMs: 20000,
      sqs: new SQS({
        region: process.env.AWS_REGION || 'eu-north-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
        }
      })
    });

    this.consumer.on('error', (err: any) => {
      console.error('Error processing message:', err);
    });

    this.consumer.on('processing_error', (err: any) => {
      console.error('Error processing message:', err);
    });
  }

  async start(): Promise<void> {
    await this.consumer.start();
    console.log('SQS Consumer started');
  }

  async stop(): Promise<void> {
    await this.consumer.stop();
    console.log('SQS Consumer stopped');
  }

  private async processMessage(message: SQS.Message): Promise<void> {
    return this.tracer.startActiveSpan('processMessage', async (span) => {
      try {
        if (!message.Body) {
          throw new Error('Empty message body');
        }

        const update: PriceUpdate = JSON.parse(message.Body);
        
        const price = Number(update.price);
        if (isNaN(price)) {
          throw new Error(`Invalid price value: ${update.price}`);
        }

        span.setAttribute('coin.symbol', update.symbol);
        span.setAttribute('coin.price', price);

        await this.coinRepository.updatePrice({
          symbol: update.symbol,
          price: price
        });

        await this.priceHistoryRepository.create({
          coinSymbol: update.symbol,
          price: price,
          timestamp: new Date(update.timestamp)
        });

      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Failed to process message'
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }
} 