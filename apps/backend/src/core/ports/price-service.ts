export interface PriceService {
  getCurrentPrice(symbol: string): Promise<number>;
  getHistoricalPrice(symbol: string, date: Date): Promise<number>;
} 