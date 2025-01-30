import Fastify, { FastifyInstance } from 'fastify';
import {  createAlertService } from '../core/services/alert.service';
import { createPostgresAlertRepo } from '../infrastructure/repositories/postgres-alert.repo';
import { CoinGeckoPriceService } from '../infrastructure/services/coinGeckoPriceService';
import { AWSSQSNotificationService } from '../infrastructure/services/awsSQSNotificationService';
import { runMigrations } from '../infrastructure/migrations/runner';
import { createPostgresCoinRepo } from '../infrastructure/repositories/postgres-coin.repo';
import { SQSPriceUpdateConsumer } from '../infrastructure/services/sqsPriceUpdateConsumer';
import { errorHandler, registerTracing } from '../api/extensions/tracing.extension';
import { coinRoutes } from '../api/routes/coin.routes';
import { alertRoutes } from '../api/routes/alert.routes';
import { registerSwagger } from '../api/extensions/swagger.extension';
import { DatabaseManager } from '../infrastructure/database/database.manager';
import { ShutdownManager } from '../infrastructure/shutdown/shutdown.manager';
import { TelemetryManager } from '../infrastructure/telemetry/telemetry.manager';
import { createCoinService } from '../core/services/coin.service';
import { createPostgresCoinPriceHistoryRepo } from '../infrastructure/repositories/postgres-coin-price-history.repo';
import { trace } from '@opentelemetry/api';

type Server = { 
  server: FastifyInstance; 
  priceUpdateConsumer: SQSPriceUpdateConsumer;
  databaseManager: DatabaseManager;
  telemetryManager: TelemetryManager;
}

async function buildServer(): Promise<Server> {
  const telemetryManager = new TelemetryManager();
  await telemetryManager.start();

  const server = Fastify({
    logger: true
  });
  const databaseManager = new DatabaseManager();
  const dbPool = databaseManager.getPool();
  server.setErrorHandler(errorHandler)
  registerTracing(server);
  await registerSwagger(server);

  const alertRepository = createPostgresAlertRepo(dbPool, trace.getTracer('alert-repository'));
  const coinRepository = createPostgresCoinRepo(dbPool, trace.getTracer('coin-repository'));
  const coinPriceHistoryRepository = createPostgresCoinPriceHistoryRepo(dbPool, trace.getTracer('coin-price-history-repository'));
  
  const priceService = new CoinGeckoPriceService();
  const notificationService = new AWSSQSNotificationService();
  const priceUpdateConsumer = new SQSPriceUpdateConsumer(
    coinRepository,
    coinPriceHistoryRepository,
    process.env.PRICE_UPDATE_QUEUE_URL || ''
  );
  
  const alertService = createAlertService(
    alertRepository,
    priceService,
    notificationService
  );
  const coinService = createCoinService(coinRepository, coinPriceHistoryRepository);
  
  await alertRoutes(server, alertService);
  await coinRoutes(server, coinService);

  await priceUpdateConsumer.start();
  return { server, priceUpdateConsumer, databaseManager, telemetryManager };
}

async function bootstrap(): Promise<void> {
  try {
    await runMigrations();
    const { server, priceUpdateConsumer, databaseManager, telemetryManager } = await buildServer();
    const port = parseInt(process.env.PORT || '4000');

    const shutdownManager = new ShutdownManager(
      server, 
      priceUpdateConsumer, 
      databaseManager,
      telemetryManager
    );
    shutdownManager.listen();
    const address = await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening at ${address} on port ${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

bootstrap().catch(console.error); 