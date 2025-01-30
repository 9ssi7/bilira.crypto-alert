export interface Coin {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  lastUpdated: Date;
  isActive: boolean;
}

export interface CoinRepository {
  findAll(): Promise<Coin[]>;
  findBySymbol(symbol: string): Promise<Coin | null>;
  findById(id: string): Promise<Coin | null>;
  updatePrice(req: CoinUpdatePriceReq): Promise<Coin>;
  create(coin: Omit<Coin, 'id' | 'lastUpdated'>): Promise<Coin>;
} 

export type CoinUpdatePriceReq = {
  symbol: string;
  price: number;
}