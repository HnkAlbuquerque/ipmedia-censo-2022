import { INestApplication } from '@nestjs/common';

/**
 * Configuração comum da aplicação, compartilhada entre o bootstrap real
 * (main.ts) e as instâncias criadas nos testes e2e, para que o prefixo
 * `/api` nunca seja definido em dois lugares.
 */
export function configurarApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  return app;
}
