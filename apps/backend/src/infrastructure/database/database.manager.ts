import { Pool } from 'pg';
import { trace, SpanStatusCode } from '@opentelemetry/api';

export class DatabaseManager {
  private tracer = trace.getTracer('database-manager');
  private pool: Pool;

  constructor() {
    const span = this.tracer.startSpan('initialize-database');
    
    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      
      span.setAttribute('database.connected', true);
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Database connection failed'
      });
      throw error;
    } finally {
      span.end();
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  async close(): Promise<void> {
    const span = this.tracer.startSpan('close-database');
    try {
      await this.pool.end();
      span.setAttribute('database.closed', true);
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Database close failed'
      });
      throw error;
    } finally {
      span.end();
    }
  }
} 