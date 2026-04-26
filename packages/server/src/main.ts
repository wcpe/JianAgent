import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { RealtimeGateway } from './realtime/realtime.gateway.js';
import { Logger, RequestMethod } from '@nestjs/common';
import { readServerConfig, readCorsConfig } from './common/network-config.js';
import { validateEnv } from './common/env-validation.js';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';

const logger = new Logger('Bootstrap');

process.on('unhandledRejection', (reason: unknown) => {
  logger.fatal(
    `Unhandled promise rejection: ${reason instanceof Error ? reason.stack : String(reason)}`,
    'UnhandledRejection',
  );
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  logger.fatal(
    `Uncaught exception: ${error.stack ?? error.message}`,
    'UncaughtException',
  );
  process.exit(1);
});

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 10 * 1024 * 1024 }), // 10MB max
  );

  // Global API version prefix — excludes health endpoints.
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health/(.*)', method: RequestMethod.ALL }, { path: 'health', method: RequestMethod.ALL }],
  });

  // Request logging via Fastify hook.
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook('onRequest', (request: { method: string; url: string }, _reply: unknown, done: () => void) => {
    logger.log(`${request.method} ${request.url}`);
    done();
  });

  // Register Helmet security headers.
  // CSP is disabled because the frontend SPA requires inline scripts.
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(compress, { encodings: ['gzip', 'deflate'] });

  const { origins } = readCorsConfig();
  app.enableCors(
    origins.length > 0
      ? { origin: origins, credentials: true }
      : { origin: false },
  );
  app.enableShutdownHooks();

  const { host, port } = readServerConfig();
  await app.listen(port, host);

  const httpServer = app.getHttpAdapter().getHttpServer();
  const realtimeGateway = app.get(RealtimeGateway);
  realtimeGateway.attachToServer(httpServer);

  logger.log(`Server running on http://${host}:${port}`);
}

bootstrap();
