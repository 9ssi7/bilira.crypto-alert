import { FastifyInstance } from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";

export async function registerSwagger(server: FastifyInstance) {
  await server.register(fastifySwagger, {
    swagger: {
      info: {
        title: "Crypto Price Alert API",
        version: "1.0.0",
      },
      schemes: ["http", "https"],
      consumes: ["application/json"],
      produces: ["application/json"],
    },
  });
  
  await server.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "full",
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => {
      return header
        .replace('script-src', `script-src 'self' 'unsafe-inline' 'unsafe-eval'`)
        .replace('style-src', `style-src 'self' 'unsafe-inline'`)
        .replace('img-src', `img-src 'self' data: https:`)
        .replace('font-src', `font-src 'self' data: https:`);
    }
  });
}
