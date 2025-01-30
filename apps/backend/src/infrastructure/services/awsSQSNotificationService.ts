import { SQS } from 'aws-sdk';
import { trace } from '@opentelemetry/api';
import { NotificationService, AlertNotification } from '../../core/ports/notification-service';

export class AWSSQSNotificationService implements NotificationService {
  private sqs: SQS;
  private queueUrl: string;
  private tracer = trace.getTracer('aws-sqs-notification-service');

  constructor() {
    if (!process.env.AWS_REGION || !process.env.NOTIFICATION_QUEUE_URL) {
      throw new Error('AWS configuration is missing')
    }

    this.sqs = new SQS({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });
    
    this.queueUrl = process.env.NOTIFICATION_QUEUE_URL;
  }

  async sendAlertNotification(notification: AlertNotification): Promise<void> {
    const span = this.tracer.startSpan('sendAlertNotification');
    
    try {
      span.setAttribute('alert.id', notification.alertId);
      span.setAttribute('user.id', notification.userId);
      span.setAttribute('crypto.symbol', notification.cryptoSymbol);
      span.setAttribute('alert.type', notification.alertType);

      const deduplicationId = this.generateDeduplicationId(notification);

      const params: SQS.SendMessageRequest = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(notification),
        MessageGroupId: notification.userId,
        MessageDeduplicationId: deduplicationId
      };

      await this.sqs.sendMessage(params).promise();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'InvalidParameterException') {
          throw new Error('Invalid notification parameters');
        }
        if (error.name === 'AccessDeniedException') {
          throw new Error('Access denied to SQS queue');
        }
        throw new Error(`Failed to send notification: ${error.message}`);
      }
      throw new Error('Unknown error occurred while sending notification');
    } finally {
      span.end();
    }
  }

  private generateDeduplicationId(notification: AlertNotification): string {
    const content = `${notification.alertId}-${notification.cryptoSymbol}-${notification.currentPrice}-${Date.now()}`;
    return Buffer.from(content).toString('base64');
  }
} 