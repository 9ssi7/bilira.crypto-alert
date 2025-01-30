import { Span, Tracer } from '@opentelemetry/api';
import { Pool } from 'pg';

export type RepoHandler<P = any, R = void> = (pool: Pool, span: Span, params: P) => Promise<R>;

export function createRepoHandler<P = any, R = void>(pool: Pool, tracer: Tracer, name: string, handler: RepoHandler<P, R>) {
  return async (params: P) => {
    return tracer.startActiveSpan(name, async (span) => {
      return await handler(pool, span, params);
    });
  }
}