import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';
import { Sugestao } from '../src/municipios/municipios.types';

// Cópia de trabalho em um arquivo temporário, um por arquivo de teste,
// para não tocar em .data/ nem colidir com outra suíte rodando em paralelo.
const caminhoTrabalho = join(
  tmpdir(),
  `censo.work.e2e-mun-${process.pid}-${Date.now()}.sqlite`,
);
process.env.DB_WORK_PATH = caminhoTrabalho;

/**
 * Linhas de API da matriz da story 3 contra o censo.sqlite real (CAP-1, CAP-2).
 * Valores de referência em regras-de-dados.md.
 */
describe('Municípios (e2e)', () => {
  let app: INestApplication | undefined;

  const get = (url: string) => request(app!.getHttpServer()).get(url);

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configurarApp(modulo.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    rmSync(caminhoTrabalho, { force: true });
  });

  describe('GET /api/municipios?q=', () => {
    it('q=sao devolve 10 itens com São Paulo (SP) primeiro', async () => {
      const { body } = await get('/api/municipios?q=sao').expect(200);
      const itens = body as Sugestao[];

      expect(itens).toHaveLength(10);
      expect(itens[0]).toEqual({
        cdMun: '3550308',
        nome: 'São Paulo',
        uf: { cdUf: '35', sigla: 'SP', nome: 'São Paulo' },
      });
      for (const item of itens) {
        expect(item.nome).not.toBe('');
        expect(item.uf.sigla).toMatch(/^[A-Z]{2}$/);
      }
    });

    it('q=paulo casa prefixo de palavra: São Paulo (SP) primeiro', async () => {
      const { body } = await get('/api/municipios?q=paulo').expect(200);
      expect(body[0].nome).toBe('São Paulo');
      expect(body[0].uf.sigla).toBe('SP');
    });

    it('q=rio devolve Rio de Janeiro (RJ) primeiro', async () => {
      const { body } = await get('/api/municipios?q=rio').expect(200);
      expect(body[0].nome).toBe('Rio de Janeiro');
      expect(body[0].uf.sigla).toBe('RJ');
    });

    it('q=bom jesus: 5 exatos de 5 UFs primeiro, depois Bom Jesus da Lapa', async () => {
      const { body } = await get('/api/municipios?q=bom%20jesus').expect(200);
      const itens = body as Sugestao[];

      expect(itens).toHaveLength(10);
      const exatos = itens.slice(0, 5);
      expect(exatos.every((s) => s.nome === 'Bom Jesus')).toBe(true);
      expect(new Set(exatos.map((s) => s.uf.sigla)).size).toBe(5);
      expect(itens[5].nome).toBe('Bom Jesus da Lapa');
      expect(itens[5].uf.sigla).toBe('BA');
    });

    it('q=SÃO GONÇ ignora acento e caixa e contém São Gonçalo (RJ)', async () => {
      const { body } = await get(
        `/api/municipios?q=${encodeURIComponent('SÃO GONÇ')}`,
      ).expect(200);
      expect(body as Sugestao[]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            nome: 'São Gonçalo',
            uf: expect.objectContaining({ sigla: 'RJ' }),
          }),
        ]),
      );
    });

    it('q=mirim casa a palavra depois do hífen: contém Guajará-Mirim (RO)', async () => {
      const { body } = await get('/api/municipios?q=mirim').expect(200);
      expect(body as Sugestao[]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            nome: 'Guajará-Mirim',
            uf: expect.objectContaining({ sigla: 'RO' }),
          }),
        ]),
      );
    });

    it("q=oeste casa a palavra depois do apóstrofo: contém Santa Bárbara d'Oeste (SP)", async () => {
      const { body } = await get('/api/municipios?q=oeste').expect(200);
      expect(body as Sugestao[]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            nome: "Santa Bárbara d'Oeste",
            uf: expect.objectContaining({ sigla: 'SP' }),
          }),
        ]),
      );
    });

    it('q com mais de 100 caracteres devolve 400', async () => {
      const { body } = await get(`/api/municipios?q=${'a'.repeat(101)}`).expect(400);
      expect(body.message).toMatch(/máximo 100/);
      await get(`/api/municipios?q=${'a'.repeat(100)}`).expect(200);
    });

    it.each(['?q=a', '', '?q=%20', '?q=%25', '?q=a&q=b'])(
      'q curto, ausente ou inválido (%s) devolve 400 JSON com mensagem',
      async (query) => {
        const { body } = await get(`/api/municipios${query}`).expect(400);
        expect(body.statusCode).toBe(400);
        expect(body.message).toMatch(/q/);
      },
    );

    it('q=xyzxyz devolve [] com 200', async () => {
      const { body } = await get('/api/municipios?q=xyzxyz').expect(200);
      expect(body).toEqual([]);
    });

    it('q=sa_ trata o sublinhado como literal e não casa "sao"', async () => {
      const { body } = await get('/api/municipios?q=sa_').expect(200);
      expect(body).toEqual([]);
    });
  });

  describe('GET /api/municipios/:cdMun', () => {
    it('3550308 devolve os agregados de São Paulo capital', async () => {
      const { body } = await get('/api/municipios/3550308').expect(200);

      expect(body).toEqual({
        cdMun: '3550308',
        nome: 'São Paulo',
        uf: { cdUf: '35', sigla: 'SP', nome: 'São Paulo' },
        populacao: 11451999,
        areaKm2: 1521.2,
        densidade: 7528.26,
        setores: { total: 27301, urbanos: 27037, rurais: 254, naoInformados: 10 },
        sexo: {
          homens: 5380188,
          mulheres: 6060887,
          comDado: 11441079,
          cobertura: 0.999,
        },
      });
    });

    it.each(['0000000', '.', 'abc'])(
      '%s devolve 404 JSON',
      async (cdMun) => {
        const { body } = await get(`/api/municipios/${cdMun}`).expect(404);
        expect(body.statusCode).toBe(404);
        expect(body.message).toMatch(/não encontrado/);
      },
    );
  });
});
