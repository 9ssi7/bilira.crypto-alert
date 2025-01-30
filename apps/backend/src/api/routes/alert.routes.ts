import { FastifyInstance } from 'fastify';
import { AlertType } from '../../core/domain/alert';
import { AlertService } from '@/src/core/services/alert.service';
import { createAlertController } from '../controllers/alert.controller';

export async function alertRoutes(
  server: FastifyInstance,
  alertService: AlertService
) {
  const alertController = createAlertController(alertService);


  server.post('/api/alerts', {
    schema: {
      body: {
        type: 'object',
        required: ['userId', 'cryptoSymbol', 'alertType', 'threshold'],
        properties: {
          userId: { type: 'string' },
          cryptoSymbol: { type: 'string' },
          threshold: { type: 'number' },
          alertType: { 
            type: 'string',
            enum: Object.values(AlertType)
          },
          timeWindow: { type: 'number' }
        }
      }
    },
    handler: alertController.create
  });

  server.get('/api/users/:userId/alerts', {
    schema: {
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      }
    },
    handler: alertController.getByUser
  });

  server.put('/api/alerts/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    },
    handler: alertController.update
  });

  server.delete('/api/alerts/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    },
    handler: alertController.delete
  });
} 