import { FastifyInstance } from 'fastify';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SQSPriceUpdateConsumer } from '../services/sqsPriceUpdateConsumer';
import { DatabaseManager } from '../database/database.manager';
import { TelemetryManager } from '../telemetry/telemetry.manager';

export class ShutdownManager {
  private tracer = trace.getTracer('shutdown-manager');
  private isShuttingDown = false;

  constructor(
    private server: FastifyInstance,
    private priceUpdateConsumer: SQSPriceUpdateConsumer,
    private databaseManager: DatabaseManager,
    private telemetryManager: TelemetryManager,
    private cleanupTimeout: number = 10000
  ) {}

  listen() {

    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach((signal) => {
      process.on(signal, async () => {
        await this.handleShutdown(signal);
      });
    });

    process.on('uncaughtException', async (error) => {
      console.error('Uncaught Exception:', error);
      await this.handleShutdown('uncaughtException');
    });

    process.on('unhandledRejection', async (reason) => {
      console.error('Unhandled Rejection:', reason);
      await this.handleShutdown('unhandledRejection');
    });
  }

  private async handleShutdown(signal: string): Promise<void> {
    const span = this.tracer.startSpan('graceful-shutdown');
    
    try {
      if (this.isShuttingDown) {
        console.log('Shutdown already in progress...');
        return;
      }

      this.isShuttingDown = true;
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

      span.setAttribute('shutdown.signal', signal);
      span.setAttribute('shutdown.timeout', this.cleanupTimeout);

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Shutdown timeout exceeded'));
        }, this.cleanupTimeout);
      });

      const cleanupPromise = this.cleanup();

      await Promise.race([cleanupPromise, timeoutPromise]);
      
      span.setAttribute('shutdown.success', true);
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Shutdown failed'
      });
      console.error('Shutdown failed:', error);
      process.exit(1);
    } finally {
      span.end();
    }
  }

  private async cleanup(): Promise<void> {
    const span = this.tracer.startSpan('cleanup');
    
    try {
      await this.server.close();
      span.setAttribute('server.closed', true);

      await this.priceUpdateConsumer.stop();
      span.setAttribute('consumer.stopped', true);

      await this.databaseManager.close();
      span.setAttribute('database.closed', true);

      await this.telemetryManager.shutdown();
      span.setAttribute('telemetry.shutdown', true);
    } finally {
      span.end();
    }
  }
} 