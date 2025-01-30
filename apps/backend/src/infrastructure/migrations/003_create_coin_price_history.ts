import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coin_price_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      coin_symbol VARCHAR(20) NOT NULL,
      price DECIMAL NOT NULL,
      timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_coin_symbol 
        FOREIGN KEY (coin_symbol) 
        REFERENCES coins(symbol) 
        ON DELETE CASCADE
    );

    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_coin_price_history_symbol_timestamp'
      ) THEN
        CREATE INDEX idx_coin_price_history_symbol_timestamp 
          ON coin_price_history(coin_symbol, timestamp);
      END IF;
    END $$;
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query(`
    DROP TABLE IF EXISTS coin_price_history CASCADE;
  `);
} 