export interface CoinPriceHistory {
  id: string;
  coinSymbol: string;
  price: number;
  timestamp: Date;
}

export interface CoinPriceHistoryRepository {
  create(history: Omit<CoinPriceHistory, 'id'>): Promise<CoinPriceHistory>;
  findBySymbol(req: CoinPriceHistoryFindBySymbolReq): Promise<CoinPriceHistory[]>;
  findLatestBySymbol(req: CoinPriceHistoryFindLatestBySymbolReq): Promise<CoinPriceHistory[]>;
  getAveragePrice(req: CoinPriceHistoryGetAveragePriceReq): Promise<number>;
} 

export type CoinPriceHistoryFindBySymbolReq = {
  symbol: string;
  from: Date;
  to: Date;
}

export type CoinPriceHistoryFindLatestBySymbolReq = {
  symbol: string;
  limit: number;
}

export type CoinPriceHistoryGetAveragePriceReq = {
  symbol: string;
  from: Date;
  to: Date;
}