import { AlertType } from "../domain/alert";

export interface AlertNotification {
  userId: string;
  alertId: string;
  cryptoSymbol: string;
  currentPrice: number;
  threshold: number;
  alertType: AlertType;
  changePercent: number;
}

export interface NotificationService {
  sendAlertNotification(notification: AlertNotification): Promise<void>;
}
