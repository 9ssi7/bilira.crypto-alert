import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      symbol VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      current_price DECIMAL NOT NULL,
      last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT true
    );

    CREATE INDEX IF NOT EXISTS idx_coins_symbol ON coins(symbol);
  `);

  // Seed
  await pool.query(`
    INSERT INTO coins (symbol, name, current_price, is_active) 
    VALUES 
      ('BTC', 'Bitcoin', 45000.00, true),
      ('ETH', 'Ethereum', 2500.00, true),
      ('BNB', 'Binance Coin', 300.00, true),
      ('ADA', 'Cardano', 1.20, true),
      ('SOL', 'Solana', 100.00, true),
      ('XRP', 'Ripple', 0.80, true),
      ('DOT', 'Polkadot', 25.00, true),
      ('DOGE', 'Dogecoin', 0.15, true),
      ('AVAX', 'Avalanche', 80.00, true),
      ('MATIC', 'Polygon', 2.00, true)
    ON CONFLICT (symbol) DO NOTHING;
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query(`
    DROP TABLE IF EXISTS coins CASCADE;
  `);
} 