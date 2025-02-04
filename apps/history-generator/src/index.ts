import { SQS } from 'aws-sdk';
import crypto from 'crypto';

export async function handler(event: any, context: any) {
  console.log('Starting history generator');
  const sqs = new SQS({
    region: process.env.AWS_REGION || 'eu-north-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
  });
  const QUEUE_URL = process.env.PRICE_UPDATE_QUEUE_URL || '';
  const COINS = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE', 'AVAX', 'MATIC'];
  try {
    for (const symbol of COINS) {
      let price: number;
      switch (symbol) {
        case 'BTC':
          price = 30000 + (Math.random() * 10000); // $30,000 - $40,000
          break;
        case 'ETH':
          price = 2000 + (Math.random() * 500); // $2,000 - $2,500
          break;
        default:
          price = 10 + (Math.random() * 90); // $10 - $100
      }

      price = Number(price.toFixed(2));
      
      const timestamp = new Date().toISOString();
      
      const message = {
        symbol,
        price,
        timestamp
      };

      const deduplicationId = crypto
        .createHash('md5')
        .update(`${symbol}-${price}-${timestamp}`)
        .digest('hex');

      await sqs.sendMessage({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(message),
        MessageGroupId: symbol,
        MessageDeduplicationId: deduplicationId
      }).promise();

      console.log(`Published price update for ${symbol}: $${price}`);
    }
  } catch (error) {
    console.error('Error publishing price updates:', error);
  }
}