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
import { registerSecurity } from '../api/extensions/security.extension';

type Server = { 
  server: FastifyInstance; 
  priceUpdateConsumer: SQSPriceUpdateConsumer;
  databaseManager: DatabaseManager;
  telemetryManager: TelemetryManager;
}

async function buildServer(): Promise<Server> {
  console.log('Building server...');
  const telemetryManager = new TelemetryManager();
  await telemetryManager.start();
  console.log('Telemetry manager started');

  const server = Fastify({
    logger: true,
    trustProxy: true
  });
  console.log('Fastify server created');
  const databaseManager = new DatabaseManager();
  const dbPool = databaseManager.getPool();
  console.log('Database pool created');
  server.setErrorHandler(errorHandler)
  registerTracing(server);
  console.log('Tracing registered');
  await registerSwagger(server);
  console.log('Swagger registered');
  const alertRepository = createPostgresAlertRepo(dbPool, trace.getTracer('alert-repository'));
  console.log('Alert repository created');
  const coinRepository = createPostgresCoinRepo(dbPool, trace.getTracer('coin-repository'));
  console.log('Coin repository created');
  const coinPriceHistoryRepository = createPostgresCoinPriceHistoryRepo(dbPool, trace.getTracer('coin-price-history-repository'));
  console.log('Coin price history repository created');
  
  const priceService = new CoinGeckoPriceService();
  console.log('Price service created');
  const notificationService = new AWSSQSNotificationService();
  console.log('Notification service created');
  const priceUpdateConsumer = new SQSPriceUpdateConsumer(
    coinRepository,
    coinPriceHistoryRepository,
    process.env.PRICE_UPDATE_QUEUE_URL || ''
  );
  console.log('Price update consumer created');
  const alertService = createAlertService(
    alertRepository,
    priceService,
    notificationService
  );
  const coinService = createCoinService(coinRepository, coinPriceHistoryRepository);
  console.log('Coin service created');
  await registerSecurity(server);
  console.log('Security registered');
  await alertRoutes(server, alertService);
  console.log('Alert routes registered');
  await coinRoutes(server, coinService);
  console.log('Coin routes registered');  
  await priceUpdateConsumer.start();
  console.log('Price update consumer started');
  return { server, priceUpdateConsumer, databaseManager, telemetryManager };
}

async function bootstrap(): Promise<void> {
  try {
    const { server, priceUpdateConsumer, databaseManager, telemetryManager } = await buildServer();
    console.log('Running migrations');
    await runMigrations();
    console.log('Migrations run');  
    const port = parseInt(process.env.PORT || '4000');
    console.log('Server created');  
    const shutdownManager = new ShutdownManager(
      server, 
      priceUpdateConsumer, 
      databaseManager,
      telemetryManager
    );
    console.log('Shutdown manager created');
    shutdownManager.listen();
    console.log('Shutdown manager listening');
    const address = await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening at ${address} on port ${port}`);
  } catch (err) {
    console.error(err);
    console.log('Error occurred');
    process.exit(1);
  }
}

bootstrap().catch(console.error); 