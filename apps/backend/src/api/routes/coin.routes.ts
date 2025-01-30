import { FastifyInstance } from 'fastify';
import { createCoinController } from '../controllers/coin.controller';
import { CoinService } from '@/src/core/services/coin.service';

export async function coinRoutes(
  server: FastifyInstance,
  coinService: CoinService
) {
  const coinController = createCoinController(coinService);

  server.get('/api/coins', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              symbol: { type: 'string' },
              name: { type: 'string' },
              currentPrice: { type: 'number' },
              lastUpdated: { type: 'string', format: 'date-time' },
              isActive: { type: 'boolean' }
            }
          }
        }
      }
    },
    handler: coinController.getAll
  });

  server.get('/api/coins/:symbol', {
    schema: {
      params: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string' }
        }
      }
    },
    handler: coinController.getBySymbol
  });

  server.get('/api/coins/:symbol/history', {
    schema: {
      params: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' }
        }
      }
    },
    handler: coinController.getPriceHistory
  });

  server.get('/api/coins/:symbol/stats', {
    schema: {
      params: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' }
        }
      }
    },
    handler: coinController.getPriceStats
  });
} 