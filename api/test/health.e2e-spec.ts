import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';

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
  });

  it('GET /api/health devolve 200 com status ok e versão do SQLite', async () => {
    const resposta = await request(app!.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(resposta.body.status).toBe('ok');
    expect(resposta.body.sqlite).toMatch(/^\d+\.\d+\.\d+$/);
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
