import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TAG_HEALTH, TAG_MUNICIPIOS, TAG_UFS } from './common/tags';

/**
 * Versão da API, lida do `package.json`. O caminho relativo vale nos dois
 * cenários: `src/` (ts-jest, `start:dev`) e `dist/` (imagem Docker), porque
 * em ambos o `package.json` fica um nível acima. Ler o arquivo em vez de
 * importá-lo evita `resolveJsonModule`, que mudaria a raiz do `dist/`.
 */
function versaoDaApi(): string {
  const conteudo = readFileSync(join(__dirname, '..', 'package.json'), 'utf8');
  return (JSON.parse(conteudo) as { version: string }).version;
}

/**
 * Configuração comum da aplicação, compartilhada entre o bootstrap real
 * (main.ts) e as instâncias criadas nos testes e2e, para que o prefixo
 * `/api` e a documentação nunca sejam definidos em dois lugares.
 */
export function configurarApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  configurarDocumentacao(app);
  return app;
}

/**
 * Documentação OpenAPI 3 gerada a partir dos controllers e das classes de
 * resposta. Com `useGlobalPrefix`, a interface fica em `/api/docs` e o JSON
 * em `/api/docs-json`, atrás do mesmo proxy `/api` do nginx.
 */
function configurarDocumentacao(app: INestApplication): void {
  const configuracao = new DocumentBuilder()
    .setTitle('Censo 2022 API')
    .setDescription(
      'Consulta ao Censo Demográfico 2022 do IBGE por município e por UF.',
    )
    .setVersion(versaoDaApi())
    .addTag(TAG_MUNICIPIOS, 'Autocomplete e agregados por município')
    .addTag(TAG_UFS, 'Lista de estados, agregados e ranking de densidade')
    .addTag(TAG_HEALTH, 'Prontidão da API, usada pelo Docker Compose')
    .build();
  const documento = SwaggerModule.createDocument(app, configuracao);
  SwaggerModule.setup('docs', app, documento, {
    useGlobalPrefix: true,
    jsonDocumentUrl: 'docs-json',
    // Só o JSON: sem isto a biblioteca publica também `/api/docs-yaml`.
    raw: ['json'],
  });
}
