import { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';

function envCheck() {
  const keys = ['ALLOWED_ORIGINS', 'RATE_LIMIT_WHITELIST', 'RATE_LIMIT_MAX', 'RATE_LIMIT_WINDOW'];
  for (const key of keys) {
    if (!process.env[key]) {
      throw new Error(`${key} is not set`);
    }
  }
}

export async function registerSecurity(server: FastifyInstance) {
  envCheck();
  await server.register(fastifyCors, {
    origin: process.env.ALLOWED_ORIGINS!.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    maxAge: 86400, // 24 hours
  });

  await server.register(fastifyHelmet, {
    global: true,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:'],
        frameSrc: ["'self'", 'https:'],
        objectSrc: ["'self'", 'https:'],
        baseUri: ["'self'", 'https:'],
        formAction: ["'self'", 'https:'],
        frameAncestors: ["'self'", 'https:'],
        
      },
    },
  });

  const allowList = process.env.RATE_LIMIT_WHITELIST!.split(',');

  await server.register(fastifyRateLimit, {
    global: true,
    max: Number(process.env.RATE_LIMIT_MAX),
    timeWindow: process.env.RATE_LIMIT_WINDOW,
    allowList,
    errorResponseBuilder: (req, context) => ({
      code: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded, retry in ${context.after}`,
      date: Date.now(),
      expiresIn: context.ttl,
    }),
  });

  server.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && !isValidOrigin(origin)) {
      return reply.code(403).send({ error: 'Invalid origin' });
    }

    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
  });
}

function isValidOrigin(origin: string): boolean {
  const allowedOrigins = process.env.ALLOWED_ORIGINS!.split(',');
  return allowedOrigins.includes(origin) || allowedOrigins.includes('*');
} 