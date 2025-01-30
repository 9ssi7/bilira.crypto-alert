import { Pool } from "pg";
import { Coin, CoinUpdatePriceReq } from "../../core/domain/coin";
import { Tracer } from "@opentelemetry/api";
import { createRepoHandler, RepoHandler } from "./base.repository";

const findById: RepoHandler<string, Coin | null> = async (
  pool,
  span,
  id: string
) => {
  span.setAttribute("coin.id", id);
  const result = await pool.query(
    "SELECT * FROM coins WHERE id = $1 AND is_active = true",
    [id]
  );
  return result.rows[0] || null;
};

const findAll: RepoHandler<void, Coin[]> = async (
  pool,
  span
) => {
  const result = await pool.query(
    "SELECT * FROM coins WHERE is_active = true"
  );
  span.setAttribute("coins.count", result.rows.length);
  return result.rows;
};

const findBySymbol: RepoHandler<string, Coin | null> = async (
  pool,
  span,
  symbol: string
) => {
  span.setAttribute("coin.symbol", symbol);
  const result = await pool.query(
    "SELECT * FROM coins WHERE symbol = $1 AND is_active = true",
    [symbol]
  );
  return result.rows[0] || null;
};

const updatePrice: RepoHandler<CoinUpdatePriceReq, Coin> = async (
  pool,
  span,
  req
) => {
  span.setAttribute("coin.symbol", req.symbol);
  span.setAttribute("coin.price", req.price);

  const result = await pool.query(
    `UPDATE coins 
     SET current_price = $1, last_updated = NOW() 
     WHERE symbol = $2 AND is_active = true 
     RETURNING *`,
    [req.price, req.symbol]
  );

  if (!result.rows[0]) {
    throw new Error(`Coin ${req.symbol} not found`);
  }

  return result.rows[0];
};

const create: RepoHandler<Omit<Coin, "id" | "lastUpdated">, Coin> = async (
  pool,
  span,
  coin: Omit<Coin, "id" | "lastUpdated">
) => {
  span.setAttribute("coin.symbol", coin.symbol);
  span.setAttribute("coin.name", coin.name);

  const result = await pool.query(
    `INSERT INTO coins (
      symbol, name, current_price, is_active
    ) VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [coin.symbol, coin.name, coin.currentPrice, coin.isActive]
  );

  return result.rows[0];
};

export function createPostgresCoinRepo(pool: Pool, tracer: Tracer) {
  return {
    findById: createRepoHandler(
      pool,
      tracer,
      'coin.repo.findById',
      findById
    ),
    findAll: createRepoHandler(
      pool,
      tracer,
      'coin.repo.findAll',
      findAll
    ),
    findBySymbol: createRepoHandler(
      pool,
      tracer,
      'coin.repo.findBySymbol',
      findBySymbol
    ),
    updatePrice: createRepoHandler(
      pool,
      tracer,
      'coin.repo.updatePrice',
      updatePrice
    ),
    create: createRepoHandler(
      pool,
      tracer,
      'coin.repo.create',
      create
    ),
  };
} 