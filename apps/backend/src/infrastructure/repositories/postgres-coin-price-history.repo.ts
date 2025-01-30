import { Pool } from 'pg';
import { CoinPriceHistory, CoinPriceHistoryFindBySymbolReq, CoinPriceHistoryFindLatestBySymbolReq, CoinPriceHistoryGetAveragePriceReq } from '../../core/domain/coin-price-history';
import { Tracer } from '@opentelemetry/api';
import { createRepoHandler, RepoHandler } from './base.repository';

const create: RepoHandler<Omit<CoinPriceHistory, 'id'>, CoinPriceHistory> = async (
  pool,
  span,
  history: Omit<CoinPriceHistory, 'id'>
) => {
  span.setAttribute('coin.symbol', history.coinSymbol);
  span.setAttribute('coin.price', history.price);

  if (typeof history.price !== 'number' || isNaN(history.price)) {
    throw new Error(`Invalid price value: ${history.price}`);
  }

  const result = await pool.query(
    `INSERT INTO coin_price_history (coin_symbol, price, timestamp)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [history.coinSymbol, history.price, history.timestamp]
  );

  return result.rows[0];
};

const findBySymbol: RepoHandler<CoinPriceHistoryFindBySymbolReq, CoinPriceHistory[]> = async (
  pool,
  span,
  req
) => {
  span.setAttribute('coin.symbol', req.symbol);
  span.setAttribute('date.from', req.from.toISOString());
  span.setAttribute('date.to', req.to.toISOString());

  const result = await pool.query(
    `SELECT * FROM coin_price_history 
     WHERE coin_symbol = $1 
     AND timestamp BETWEEN $2 AND $3
     ORDER BY timestamp DESC`,
    [req.symbol, req.from, req.to]
  );

  return result.rows;
};


const findLatestBySymbol: RepoHandler<CoinPriceHistoryFindLatestBySymbolReq, CoinPriceHistory[]> = async (
  pool,
  span,
  req
) => {
  span.setAttribute('coin.symbol', req.symbol);
  span.setAttribute('limit', req.limit);

  const result = await pool.query(
    `SELECT * FROM coin_price_history 
     WHERE coin_symbol = $1 
     ORDER BY timestamp DESC 
     LIMIT $2`,
    [req.symbol, req.limit]
  );

  return result.rows;
};


const getAveragePrice: RepoHandler<CoinPriceHistoryGetAveragePriceReq, number> = async (
  pool,
  span,
  req
) => {
  span.setAttribute('coin.symbol', req.symbol);
  span.setAttribute('date.from', req.from.toISOString());
  span.setAttribute('date.to', req.to.toISOString());

  const result = await pool.query(
    `SELECT AVG(price) as average_price 
     FROM coin_price_history 
     WHERE coin_symbol = $1 
     AND timestamp BETWEEN $2 AND $3`,
    [req.symbol, req.from, req.to]
  );

  return result.rows[0]?.average_price || 0;
};

export function createPostgresCoinPriceHistoryRepo(pool: Pool, tracer: Tracer) {
  return {
    create: createRepoHandler(
      pool,
      tracer,
      'coin-price-history.repo.create',
      create
    ),
    findBySymbol: createRepoHandler(
      pool,
      tracer,
      'coin-price-history.repo.findBySymbol',
      findBySymbol
    ),
    findLatestBySymbol: createRepoHandler(
      pool,
      tracer,
      'coin-price-history.repo.findLatestBySymbol',
      findLatestBySymbol
    ),
    getAveragePrice: createRepoHandler(
      pool,
      tracer,
      'coin-price-history.repo.getAveragePrice',
      getAveragePrice
    ),
  };
} 