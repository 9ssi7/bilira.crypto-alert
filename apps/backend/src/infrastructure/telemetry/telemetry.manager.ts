import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { BatchSpanProcessor, NoopSpanProcessor } from '@opentelemetry/sdk-trace-base';

export class TelemetryManager {
  private tracer = trace.getTracer('telemetry-manager');
  private sdk: NodeSDK;

  constructor() {
    const span = this.tracer.startSpan('initialize-telemetry');
    const env = process.env.NODE_ENV || 'development';
    try {
      const isDevelopment = env === 'development';
      const spanProcessor = isDevelopment 
        ? new BatchSpanProcessor(new OTLPTraceExporter({
            url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
          }))
        : new NoopSpanProcessor();

      this.sdk = new NodeSDK({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: 'crypto-alert-service',
          [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env
        }),
        spanProcessor,
      });

      span.setAttribute('telemetry.initialized', true);
      span.setAttribute('telemetry.environment', env);
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Telemetry initialization failed'
      });
      throw error;
    } finally {
      span.end();
    }
  }

  async start(): Promise<void> {
    const span = this.tracer.startSpan('start-telemetry');
    
    try {
      this.sdk.start();
      span.setAttribute('telemetry.started', true);
      console.log('Telemetry initialized');
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Failed to start telemetry'
      });
      throw error;
    } finally {
      span.end();
    }
  }

  async shutdown(): Promise<void> {
    const span = this.tracer.startSpan('shutdown-telemetry');
    
    try {
      await this.sdk.shutdown();
      span.setAttribute('telemetry.shutdown', true);
      console.log('Telemetry shut down');
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Failed to shutdown telemetry'
      });
      throw error;
    } finally {
      span.end();
    }
  }
} 