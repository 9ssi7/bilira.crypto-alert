import { PriceService } from '../../core/ports/price-service';
import { trace, SpanStatusCode } from '@opentelemetry/api';

export class CoinGeckoPriceService implements PriceService {
  private tracer = trace.getTracer('price-service');

  async getCurrentPrice(symbol: string): Promise<number> {
    return this.tracer.startActiveSpan('getCurrentPrice', async (span) => {
      try {
        span.setAttribute('crypto.symbol', symbol);
        const price = Math.random() * 50000;
        span.setAttribute('crypto.price', price);
        return price;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Failed to get price'
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getHistoricalPrice(symbol: string, date: Date): Promise<number> {
    return Math.random() * 50000;
  }
} 