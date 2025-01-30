import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_type') THEN
        CREATE TYPE alert_type AS ENUM (
          'PRICE_ABOVE',
          'PRICE_BELOW',
          'PRICE_INCREASE',
          'PRICE_DECREASE',
          'HIGH_VOLATILITY',
          'TREND_CHANGE'
        );
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(100) NOT NULL,
      crypto_symbol VARCHAR(20) NOT NULL,
      alert_type alert_type NOT NULL,
      threshold DECIMAL NOT NULL,
      time_window INTEGER,
      is_active BOOLEAN DEFAULT true,
      last_triggered_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT fk_crypto_symbol 
        FOREIGN KEY (crypto_symbol) 
        REFERENCES coins(symbol) 
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_crypto_symbol ON alerts(crypto_symbol);

    -- Create or replace the updated_at function
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Drop the trigger if it exists and create it again
    DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
    CREATE TRIGGER update_alerts_updated_at
      BEFORE UPDATE ON alerts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query(`
    DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
    DROP FUNCTION IF EXISTS update_updated_at_column();
    DROP TABLE IF EXISTS alerts CASCADE;
    DROP TYPE IF EXISTS alert_type CASCADE;
  `);
} 