import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { RealtimeGateway } from './realtime/realtime.gateway.js';
import { Logger } from '@nestjs/common';
import { readServerConfig } from './common/network-config.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.enableCors({ origin: true, credentials: true });
  app.enableShutdownHooks();

  const { host, port } = readServerConfig();
  await app.listen(port, host);

  const httpServer = app.getHttpAdapter().getHttpServer();
  const realtimeGateway = app.get(RealtimeGateway);
  realtimeGateway.attachToServer(httpServer);

  logger.log(`Server running on http://${host}:${port}`);
}

bootstrap();
