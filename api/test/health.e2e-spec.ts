import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';

// Cópia de trabalho em um arquivo temporário, um por arquivo de teste,
// para não tocar em .data/ nem colidir com outra suíte rodando em paralelo.
const caminhoTrabalho = join(
  tmpdir(),
  `censo.work.e2e-${process.pid}-${Date.now()}.sqlite`,
);
process.env.DB_WORK_PATH = caminhoTrabalho;

describe('Healthcheck (e2e)', () => {
  let app: INestApplication | undefined;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configurarApp(modulo.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    // Opcional: se o beforeAll falhou, não mascara o erro original.
    await app?.close();
    rmSync(caminhoTrabalho, { force: true });
  });

  it('GET /api/health devolve 200 com status ok, versão do SQLite e 5.571 municípios', async () => {
    const resposta = await request(app!.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(resposta.body.status).toBe('ok');
    expect(resposta.body.sqlite).toMatch(/^\d+\.\d+\.\d+$/);
    expect(resposta.body.municipios).toBe(5571);
  });

  it('GET /api/nada devolve 404 JSON padrão do Nest', async () => {
    const resposta = await request(app!.getHttpServer())
      .get('/api/nada')
      .expect(404);

    expect(resposta.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Cannot GET /api/nada',
    });
  });

  it('GET /health sem o prefixo /api devolve 404', async () => {
    await request(app!.getHttpServer()).get('/health').expect(404);
  });
});
