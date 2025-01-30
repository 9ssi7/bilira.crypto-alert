export enum AlertType {
  PRICE_ABOVE = "PRICE_ABOVE",
  PRICE_BELOW = "PRICE_BELOW",
  PRICE_INCREASE = "PRICE_INCREASE",
  PRICE_DECREASE = "PRICE_DECREASE",
  HIGH_VOLATILITY = "HIGH_VOLATILITY",
  TREND_CHANGE = "TREND_CHANGE",
}

export interface Alert {
  id: string;
  userId: string;
  cryptoSymbol: string;
  alertType: AlertType;
  threshold: number; // Price or percentage threshold
  timeWindow?: number; // Time window (in minutes)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt?: Date; // Last triggered time
}

export interface AlertRepository {
  findById(id: string): Promise<Alert | null>;
  findByUserId(userId: string): Promise<Alert[]>;
  findActiveAlertsBySymbol(symbol: string): Promise<Alert[]>;
  create(alert: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>): Promise<Alert>;
  update(req: AlertUpdateReq): Promise<Alert>;
  remove(id: string): Promise<void>;
}

export type AlertUpdateReq = {
  id: string;
  alert: Partial<Alert>;
};