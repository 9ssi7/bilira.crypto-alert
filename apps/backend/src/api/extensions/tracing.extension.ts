import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { trace, Span, Tracer } from '@opentelemetry/api';

declare module 'fastify' {
  interface FastifyRequest {
    span?: Span;
  }
}

const onRequest = (tracer: Tracer) => {
    return async(req: FastifyRequest) => {
        const span = tracer.startSpan(`${req.method} ${req.url}`);
        span.setAttribute('http.method', req.method);
        span.setAttribute('http.url', req.url);
        span.setAttribute('http.route', req.routeOptions?.url || req.url);
        Object.entries(req.headers).forEach(([key, value]) => {
          if (value) {
            span.setAttribute(`http.header.${key}`, value.toString());
          }
        });
        req.span = span;
    }
}

const onResponse = (tracer: Tracer) => {
    return async(req: FastifyRequest, reply: FastifyReply) => {
        if (req.span) {
            req.span.setAttribute('http.status_code', reply.statusCode);
            req.span.end();
        }
    }
}

const onTimeout = (tracer: Tracer) => {
    return async(req: FastifyRequest, reply: FastifyReply) => {
        if (req.span) {
            req.span.setAttribute('error', true);
            req.span.setAttribute('error.type', 'timeout');
            req.span.end();
        }
    }
}

const onError = (tracer: Tracer) => {
    return async(req: FastifyRequest, reply: FastifyReply, error: Error) => {
        if (req.span) {
            req.span.setAttribute('error', true);
            req.span.setAttribute('error.type', error.name);
            req.span.setAttribute('error.message', error.message);
            req.span.end();
        }
    }
}

export function registerTracing(server: FastifyInstance) {
    const tracer = trace.getTracer('http-server');

    server.addHook('onRequest', onRequest(tracer));
    server.addHook('onResponse', onResponse(tracer));
    server.addHook('onTimeout', onTimeout(tracer));
    server.addHook('onError', onError(tracer));
}

export function getCurrentSpan(request: FastifyRequest): Span | undefined {
  return request.span;
} 

export function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  if (request.span) {
    request.span.setAttribute('error', true);
    request.span.setAttribute('error.type', error.name);
    request.span.setAttribute('error.message', error.message);
    request.span.end();
  }
  return reply.code(500).send({
    error: error instanceof Error ? error.message : 'Internal server error'
  });
}