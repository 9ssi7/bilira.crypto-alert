import { trace } from '@opentelemetry/api';
import { Coin, CoinRepository } from '../domain/coin';
import { CoinPriceHistory, CoinPriceHistoryRepository } from '../domain/coin-price-history';
import { createService, Service } from './base.service';

type CoinGetAllReq = void;

const coinGetAll = (coinRepository: CoinRepository): Service<CoinGetAllReq, Coin[]> => {
  return async (req, span) => {
    return await coinRepository.findAll();
  }
}

type CoinGetBySymbolReq = {
  symbol: string;
}

const coinGetBySymbol = (coinRepository: CoinRepository): Service<CoinGetBySymbolReq, Coin | null> => {
  return async (req, span) => {
    span.setAttribute('coin.symbol', req.symbol);
    return await coinRepository.findBySymbol(req.symbol);
  }
}

type CoinGetPriceHistoryReq = {
  symbol: string;
  from: Date;
  to: Date;
}

const coinGetPriceHistory = (priceHistoryRepository: CoinPriceHistoryRepository): Service<CoinGetPriceHistoryReq, CoinPriceHistory[]> => {
  return async (req, span) => {
    span.setAttribute('coin.symbol', req.symbol);
    span.setAttribute('date.from', req.from.toISOString());
    span.setAttribute('date.to', req.to.toISOString());
    return await priceHistoryRepository.findBySymbol({
      symbol: req.symbol,
      from: req.from,
      to: req.to
    });
  }
}

type CoinGetPriceStatsReq = {
  symbol: string;
  from: Date;
  to: Date;
}

const coinGetPriceStats = (priceHistoryRepository: CoinPriceHistoryRepository): Service<CoinGetPriceStatsReq, { averagePrice: number }> => {
  return async (req, span) => {
    span.setAttribute('coin.symbol', req.symbol);
    span.setAttribute('date.from', req.from.toISOString());
    span.setAttribute('date.to', req.to.toISOString());
    const avgPrice = await priceHistoryRepository.getAveragePrice({
      symbol: req.symbol,
      from: req.from,
      to: req.to
    });
    return { averagePrice: avgPrice };
  }
}

type CoinUpdatePriceReq = {
  symbol: string;
  price: number;
}

const coinUpdatePrice = (coinRepository: CoinRepository): Service<CoinUpdatePriceReq, Coin> => {
  return async (req, span) => {
    span.setAttribute('coin.symbol', req.symbol);
    span.setAttribute('coin.price', req.price);
    return await coinRepository.updatePrice({
      symbol: req.symbol,
      price: req.price
    });
  }
}

export type CoinService = ReturnType<typeof createCoinService>;

export function createCoinService(
  coinRepository: CoinRepository,
  priceHistoryRepository: CoinPriceHistoryRepository
) {
  const tracer = trace.getTracer('coin.service');
  return {
    getAll: createService(tracer, 'coin.service.getAll', coinGetAll(coinRepository)),
    getBySymbol: createService(tracer, 'coin.service.getBySymbol', coinGetBySymbol(coinRepository)),
    getPriceHistory: createService(tracer, 'coin.service.getPriceHistory', coinGetPriceHistory(priceHistoryRepository)),
    getPriceStats: createService(tracer, 'coin.service.getPriceStats', coinGetPriceStats(priceHistoryRepository)),
    updatePrice: createService(tracer, 'coin.service.updatePrice', coinUpdatePrice(coinRepository))
  }
}
