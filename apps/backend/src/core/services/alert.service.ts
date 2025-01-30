import { trace } from '@opentelemetry/api';
import { Alert, AlertRepository, AlertType } from '../domain/alert';
import { PriceService } from '../ports/price-service';
import { NotificationService } from '../ports/notification-service';
import { createService, Service } from './base.service';

const validateThreshold = (alertType: AlertType, threshold: number): void => {
  if (threshold <= 0) {
    throw new Error('Threshold must be a positive number');
  }

  switch (alertType) {
    case AlertType.PRICE_ABOVE:
    case AlertType.PRICE_BELOW:
      if (threshold < 0.000001) {
        throw new Error('Price threshold must be at least 0.000001');
      }
      break;

    case AlertType.PRICE_INCREASE:
    case AlertType.PRICE_DECREASE:
    case AlertType.HIGH_VOLATILITY:
    case AlertType.TREND_CHANGE:
      if (threshold > 100) {
        throw new Error('Percentage threshold cannot exceed 100%');
      }
      break;

    default:
      throw new Error(`Invalid alert type: ${alertType}`);
  }
}

type AlertCreateReq = {
  userId: string,
  cryptoSymbol: string,
  alertType: AlertType,
  threshold: number,
  timeWindow?: number
}

const alertCreate = (alertRepository: AlertRepository) : Service<AlertCreateReq, Alert> => {
  return async (req, span) => {
    span.setAttribute('user.id', req.userId);
    span.setAttribute('crypto.symbol', req.cryptoSymbol);
    span.setAttribute('alert.type', req.alertType);
    span.setAttribute('alert.threshold', req.threshold);
    if (req.timeWindow) {
      span.setAttribute('alert.timeWindow', req.timeWindow);
    }
    validateThreshold(req.alertType, req.threshold);

    const alert: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: req.userId,
      cryptoSymbol: req.cryptoSymbol,
      alertType: req.alertType,
      threshold: req.threshold,
      timeWindow: req.timeWindow,
      isActive: true
    };

    return await alertRepository.create(alert);
  }
}

type AlertUpdateReq = {
  alertId: string,
  updates: {
    threshold?: number;
    timeWindow?: number;
    isActive?: boolean;
  }
}

const alertUpdate = (alertRepository: AlertRepository) : Service<AlertUpdateReq, Alert> => {
  return async (req, span) => {
    span.setAttribute('alert.id', req.alertId);

    const existingAlert = await alertRepository.findById(req.alertId);
    if (!existingAlert) {
      throw new Error('Alert not found');
    }

    if (req.updates.threshold !== undefined) {
      validateThreshold(existingAlert.alertType, req.updates.threshold);
      span.setAttribute('alert.threshold', req.updates.threshold);
    }

    if (req.updates.timeWindow !== undefined) {
      span.setAttribute('alert.timeWindow', req.updates.timeWindow);
    }

    return await alertRepository.update({
      id: req.alertId,
      alert: req.updates
    });
  }
}

type AlertDeleteReq = {
  alertId: string;
}

const alertDelete = (alertRepository: AlertRepository) : Service<AlertDeleteReq, void> => {
  return async (req, span) => {
    span.setAttribute('alert.id', req.alertId);
    await alertRepository.remove(req.alertId);
  }
}

type AlertGetByUserReq = {
  userId: string;
}

const alertGetByUser = (alertRepository: AlertRepository) : Service<AlertGetByUserReq, Alert[]> => {
  return async (req, span) => {
    span.setAttribute('user.id', req.userId);
    return await alertRepository.findByUserId(req.userId);
  }
}

type AlertToggleStatusReq = {
  alertId: string;
  isActive: boolean;
}

const alertToggleStatus = (alertRepository: AlertRepository) : Service<AlertToggleStatusReq, Alert> => {
  return async (req, span) => {
    span.setAttribute('alert.id', req.alertId);
    span.setAttribute('alert.isActive', req.isActive);
    const alert = await alertRepository.findById(req.alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    return await alertRepository.update({
      id: req.alertId,
      alert: { isActive: req.isActive }
    });
  }
}

type AlertGetActiveBySymbolReq = {
  symbol: string;
}

const alertGetActiveBySymbol = (alertRepository: AlertRepository) : Service<AlertGetActiveBySymbolReq, Alert[]> => {
  return async (req, span) => {
    span.setAttribute('crypto.symbol', req.symbol);
    return await alertRepository.findActiveAlertsBySymbol(req.symbol);
  }
}

  const alertCheckActive = (alertRepository: AlertRepository, priceService: PriceService, notificationService: NotificationService) : Service<void, void> => {
  return async (req, span) => {
    const activeAlerts = await alertRepository.findByUserId('');
    const alerts = activeAlerts.filter(alert => alert.isActive);
    
    for (const alert of alerts) {
      const currentPrice = await priceService.getCurrentPrice(alert.cryptoSymbol);
      
      if (shouldTriggerAlert(alert, currentPrice)) {
        await notificationService.sendAlertNotification({
          userId: alert.userId,
          alertId: alert.id,
          cryptoSymbol: alert.cryptoSymbol,
          currentPrice,
          threshold: alert.threshold,
          alertType: alert.alertType,
          changePercent: calculateChangePercent(alert, currentPrice)
        });
        
        await alertRepository.update({
          id: alert.id,
          alert: { isActive: false }
        });
      }
    }
  }
}


const shouldTriggerAlert = (alert: Alert, currentPrice: number): boolean => {
  switch (alert.alertType) {
    case AlertType.PRICE_ABOVE:
      return currentPrice >= alert.threshold;
    
    case AlertType.PRICE_BELOW:
      return currentPrice <= alert.threshold;
    
    case AlertType.PRICE_INCREASE:
      const increasePercent = ((currentPrice - alert.threshold) / alert.threshold) * 100;
      return increasePercent >= alert.threshold;
    
    case AlertType.PRICE_DECREASE:
      const decreasePercent = ((alert.threshold - currentPrice) / alert.threshold) * 100;
      return decreasePercent >= alert.threshold;
    
    case AlertType.HIGH_VOLATILITY:
      const volatilityPercent = Math.abs(((currentPrice - alert.threshold) / alert.threshold) * 100);
      return volatilityPercent >= alert.threshold;
    
    case AlertType.TREND_CHANGE:
      const trendChangePercent = Math.abs(((currentPrice - alert.threshold) / alert.threshold) * 100);
      return trendChangePercent >= alert.threshold;
    
    default:
      return false;
  }
}

const calculateChangePercent = (alert: Alert, currentPrice: number): number => {
  return ((currentPrice - alert.threshold) / alert.threshold) * 100;
}

export type AlertService = ReturnType<typeof createAlertService>;

export function createAlertService(alertRepository: AlertRepository, priceService: PriceService, notificationService: NotificationService) {
  const tracer = trace.getTracer('alert.service');
  return {
    create: createService(tracer, 'alert.service.create', alertCreate(alertRepository)),
    update: createService(tracer, 'alert.service.update', alertUpdate(alertRepository)),
    delete: createService(tracer, 'alert.service.delete', alertDelete(alertRepository)),
    getByUser: createService(tracer, 'alert.service.getByUser', alertGetByUser(alertRepository)),
    toggleStatus: createService(tracer, 'alert.service.toggleStatus', alertToggleStatus(alertRepository)),
    getActiveBySymbol: createService(tracer, 'alert.service.getActiveBySymbol', alertGetActiveBySymbol(alertRepository)),
    checkActive: createService(tracer, 'alert.service.checkActive', alertCheckActive(alertRepository, priceService, notificationService))
  }
}