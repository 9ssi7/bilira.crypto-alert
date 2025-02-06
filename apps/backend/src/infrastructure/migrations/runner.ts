import { Pool } from 'pg';
import * as createAlertsTable from './001_create_alerts_table';
import * as createCoinsTable from './002_create_coins_table';
import * as createCoinPriceHistoryTable from './003_create_coin_price_history';

const migrations = [
  createCoinsTable,
  createAlertsTable,
  createCoinPriceHistoryTable
];

export async function runMigrations(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : undefined
  });

  try {
    for (const migration of migrations) {
      await migration.up(pool);
    }
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}