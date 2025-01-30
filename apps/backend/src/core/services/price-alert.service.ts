import { trace } from '@opentelemetry/api';
import { CoinPriceHistoryRepository } from '../domain/coin-price-history';
import { NotificationService, AlertNotification } from '../ports/notification-service';
import { AlertRepository, Alert, AlertType } from '../domain/alert';
import { createService, Service } from './base.service';

type PriceMetrics = {
  currentPrice: number;
  previousPrice: number;
  percentageChange: number;
  volatility: number;
}

type AnalyzePriceChangeReq = {
  symbol: string;
  currentPrice: number;
}

const analyzePriceChange = (
  priceHistoryRepository: CoinPriceHistoryRepository,
  alertRepository: AlertRepository,
  notificationService: NotificationService
): Service<AnalyzePriceChangeReq, void> => {
  return async (req, span) => {
    span.setAttribute('coin.symbol', req.symbol);
    span.setAttribute('coin.currentPrice', req.currentPrice);

    const activeAlerts = await alertRepository.findActiveAlertsBySymbol(req.symbol);
    if (!activeAlerts.length) return;

    for (const alert of activeAlerts) {
      await checkAlert(
        alert, 
        req.symbol, 
        req.currentPrice, 
        priceHistoryRepository, 
        alertRepository, 
        notificationService
      );
    }
  }
}

const checkAlert = async(
  alert: Alert,
  symbol: string,
  currentPrice: number,
  priceHistoryRepository: CoinPriceHistoryRepository,
  alertRepository: AlertRepository,
  notificationService: NotificationService
): Promise<void> => {
  if (alert.lastTriggeredAt && alert.timeWindow) {
    const timeSinceLastTrigger = Date.now() - alert.lastTriggeredAt.getTime();
    const minimumInterval = alert.timeWindow * 60 * 1000;
    if (timeSinceLastTrigger < minimumInterval) {
      return;
    }
  }

  const metrics = await calculateMetrics(priceHistoryRepository, symbol, currentPrice, alert.timeWindow || 5);
  let shouldTrigger = false;
  let changePercent = 0;

  switch (alert.alertType) {
    case AlertType.PRICE_ABOVE:
      shouldTrigger = currentPrice >= alert.threshold;
      changePercent = ((currentPrice - alert.threshold) / alert.threshold) * 100;
      break;

    case AlertType.PRICE_BELOW:
      shouldTrigger = currentPrice <= alert.threshold;
      changePercent = ((alert.threshold - currentPrice) / alert.threshold) * 100;
      break;

    case AlertType.PRICE_INCREASE:
      shouldTrigger = metrics.percentageChange >= alert.threshold;
      changePercent = metrics.percentageChange;
      break;

    case AlertType.PRICE_DECREASE:
      shouldTrigger = metrics.percentageChange <= -alert.threshold;
      changePercent = Math.abs(metrics.percentageChange);
      break;

    case AlertType.HIGH_VOLATILITY:
      shouldTrigger = metrics.volatility >= alert.threshold;
      changePercent = metrics.volatility;
      break;

    case AlertType.TREND_CHANGE:
      const trendChanged = await detectTrendChange(priceHistoryRepository, symbol, currentPrice, alert.timeWindow || 60);
      shouldTrigger = trendChanged && Math.abs(metrics.percentageChange) >= alert.threshold;
      changePercent = Math.abs(metrics.percentageChange);
      break;
  }

  if (shouldTrigger) {
    await triggerAlert(alert, symbol, currentPrice, changePercent, alertRepository, notificationService);
  }
}

const calculateMetrics = async (
  priceHistoryRepository: CoinPriceHistoryRepository,
  symbol: string,
  currentPrice: number,
  timeWindowMinutes: number
): Promise<PriceMetrics> => {
  const now = new Date();
  const timeAgo = new Date(now.getTime() - timeWindowMinutes * 60 * 1000);

  const history = await priceHistoryRepository.findBySymbol({
    symbol,
    from: timeAgo,
    to: now
  });
  const previousPrice = history[0]?.price || currentPrice;

  const percentageChange = ((currentPrice - previousPrice) / previousPrice) * 100;
  const volatility = calculateVolatility(history.map(h => h.price));

  return {
    currentPrice,
    previousPrice,
    percentageChange,
    volatility
  };
}

const detectTrendChange = async (
  priceHistoryRepository: CoinPriceHistoryRepository,
  symbol: string,
  currentPrice: number,
  timeWindowMinutes: number
): Promise<boolean> => {
  const now = new Date();
  const timeAgo = new Date(now.getTime() - timeWindowMinutes * 60 * 1000);

  const history = await priceHistoryRepository.findBySymbol({
    symbol,
    from: timeAgo,
    to: now
  });
  if (history.length < 3) return false;

  const recentPrices = history.slice(0, 3).map(h => h.price);
  const oldTrend = Math.sign(recentPrices[1] - recentPrices[2]);
  const newTrend = Math.sign(recentPrices[0] - recentPrices[1]);

  return oldTrend !== newTrend && oldTrend !== 0;
}

const calculateVolatility = (prices: number[]): number => {
  if (prices.length < 2) return 0;

  const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / (prices.length - 1);

  return Math.sqrt(variance) / mean * 100;
}

const triggerAlert = async (
  alert: Alert,
  symbol: string,
  currentPrice: number,
  changePercent: number,
  alertRepository: AlertRepository,
  notificationService: NotificationService
): Promise<void> => {
  const notification: AlertNotification = {
    alertId: alert.id,
    userId: alert.userId,
    cryptoSymbol: symbol,
    currentPrice: currentPrice,
    threshold: alert.threshold,
    alertType: alert.alertType,
    changePercent: changePercent
  };

  await notificationService.sendAlertNotification(notification);

  await alertRepository.update({
    id: alert.id,
    alert: {
      lastTriggeredAt: new Date()
    }
  });
}

export type PriceAlertService = ReturnType<typeof createPriceAlertService>;

export function createPriceAlertService(
  priceHistoryRepository: CoinPriceHistoryRepository,
  alertRepository: AlertRepository,
  notificationService: NotificationService
) {
  const tracer = trace.getTracer('price-alert.service');
  return {
    analyzePriceChange: createService(
      tracer,
      'price-alert.service.analyzePriceChange',
      analyzePriceChange(priceHistoryRepository, alertRepository, notificationService)
    )
  }
} 