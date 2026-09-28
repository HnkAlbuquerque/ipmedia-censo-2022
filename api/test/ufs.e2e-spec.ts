import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';
import { RankingPagina, UfAgregado, UfItem } from '../src/ufs/ufs.types';

// Cópia de trabalho em um arquivo temporário, um por arquivo de teste,
// para não tocar em .data/ nem colidir com outra suíte rodando em paralelo.
const caminhoTrabalho = join(
  tmpdir(),
  `censo.work.e2e-ufs-${process.pid}-${Date.now()}.sqlite`,
);
process.env.DB_WORK_PATH = caminhoTrabalho;

/**
 * Linhas de API da matriz da story 4 contra o censo.sqlite real (CAP-3, CAP-4).
 * Valores de referência em regras-de-dados.md; área e densidade já com as
 * 2 casas do servidor, então a comparação é exata (R7).
 */
describe('UFs (e2e)', () => {
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

  describe('GET /api/ufs', () => {
    it('devolve as 27 UFs em ordem alfabética, de Acre a Tocantins', async () => {
      const { body } = await get('/api/ufs').expect(200);
      const ufs = body as UfItem[];

      expect(ufs).toHaveLength(27);
      expect(ufs[0]).toEqual({ cdUf: '12', sigla: 'AC', nome: 'Acre' });
      expect(ufs[26]).toEqual({ cdUf: '17', sigla: 'TO', nome: 'Tocantins' });
      expect(new Set(ufs.map((u) => u.cdUf)).size).toBe(27);
      expect(ufs.map((u) => u.nome)).toEqual(
        expect.arrayContaining(['São Paulo', 'Rio Grande do Sul', 'Pará']),
      );
    });
  });

  describe('GET /api/ufs/:cdUf', () => {
    it('35 devolve o agregado de São Paulo com 645 municípios', async () => {
      const { body } = await get('/api/ufs/35').expect(200);
      expect(body).toEqual({
        cdUf: '35',
        sigla: 'SP',
        nome: 'São Paulo',
        populacao: 44411238,
        areaKm2: 248219.49,
        densidade: 178.92,
        totalMunicipios: 645,
      });
    });

    it('43 inclui as lagoas na área do RS e conta 497 municípios (R1)', async () => {
      const { body } = await get('/api/ufs/43').expect(200);
      const rs = body as UfAgregado;
      expect(rs.sigla).toBe('RS');
      expect(rs.totalMunicipios).toBe(497);
      // 281.707,2 km² em regras-de-dados.md é a referência a 1 casa; com as
      // 2 casas de R7 o valor é 281.707,15. Sem a linha '.', seria 268.621,2.
      expect(rs.areaKm2).toBe(281707.15);
      expect(Math.round(rs.areaKm2 * 10) / 10).toBe(281707.2);
      expect(rs.populacao).toBe(10882965);
    });

    it('a soma das 27 UFs fecha a população e a área do Brasil', async () => {
      const { body: ufs } = await get('/api/ufs').expect(200);
      let populacao = 0;
      let areaKm2 = 0;
      for (const uf of ufs as UfItem[]) {
        const { body } = await get(`/api/ufs/${uf.cdUf}`).expect(200);
        const agregado = body as UfAgregado;
        expect(agregado.cdUf).toBe(uf.cdUf);
        populacao += agregado.populacao;
        areaKm2 += agregado.areaKm2;
      }
      expect(populacao).toBe(203080756);
      // Soma de 27 valores já arredondados a 2 casas: tolerância 0,5.
      expect(Math.abs(areaKm2 - 8510417.25)).toBeLessThan(0.5);
    });

    it.each(['99', 'abc', '3', '350', '.'])('%s devolve 404 JSON', async (cdUf) => {
      const { body } = await get(`/api/ufs/${cdUf}`).expect(404);
      expect(body.statusCode).toBe(404);
      expect(body.message).toMatch(/não encontrada/);
    });
  });

  describe('GET /api/ufs/:cdUf/municipios', () => {
    it('SP página 1: 50 itens com Taboão da Serra em primeiro', async () => {
      const { body } = await get('/api/ufs/35/municipios').expect(200);
      const pagina = body as RankingPagina;

      expect(pagina.total).toBe(645);
      expect(pagina.page).toBe(1);
      expect(pagina.pageSize).toBe(50);
      expect(pagina.itens).toHaveLength(50);
      // 13.417 hab/km² em regras-de-dados.md é a referência inteira; com as
      // 2 casas de R7 o valor é 13.416,96.
      expect(pagina.itens[0]).toEqual({
        posicao: 1,
        cdMun: '3552809',
        nome: 'Taboão da Serra',
        populacao: 273542,
        areaKm2: 20.39,
        densidade: 13416.96,
      });
      expect(Math.round(pagina.itens[0].densidade)).toBe(13417);
      expect(pagina.itens.map((i) => i.posicao)).toEqual(
        Array.from({ length: 50 }, (_, i) => i + 1),
      );
      for (let i = 1; i < pagina.itens.length; i++) {
        expect(pagina.itens[i].densidade).toBeLessThanOrEqual(pagina.itens[i - 1].densidade);
      }
    });

    it('SP página 2 começa na posição 51 e não repete município da página 1', async () => {
      const { body: p1 } = await get('/api/ufs/35/municipios').expect(200);
      const { body: p2 } = await get('/api/ufs/35/municipios?page=2').expect(200);
      const pagina2 = p2 as RankingPagina;

      expect(pagina2.page).toBe(2);
      expect(pagina2.total).toBe(645);
      expect(pagina2.itens).toHaveLength(50);
      expect(pagina2.itens[0].posicao).toBe(51);
      const codigos1 = new Set((p1 as RankingPagina).itens.map((i) => i.cdMun));
      expect(pagina2.itens.some((i) => codigos1.has(i.cdMun))).toBe(false);
    });

    it('RR devolve os 15 municípios nas posições 1 a 15', async () => {
      const { body } = await get('/api/ufs/14/municipios').expect(200);
      const pagina = body as RankingPagina;

      expect(pagina.total).toBe(15);
      expect(pagina.itens).toHaveLength(15);
      expect(pagina.itens.map((i) => i.posicao)).toEqual(
        Array.from({ length: 15 }, (_, i) => i + 1),
      );
      expect(pagina.itens[0].nome).toBe('Boa Vista');
    });

    it('página além do fim devolve itens vazios com o total certo', async () => {
      const { body } = await get('/api/ufs/35/municipios?page=99').expect(200);
      expect(body).toEqual({ total: 645, page: 99, pageSize: 50, itens: [] });
    });

    it('respeita pageSize até 100', async () => {
      const { body } = await get('/api/ufs/35/municipios?pageSize=100&page=7').expect(200);
      const pagina = body as RankingPagina;
      expect(pagina.pageSize).toBe(100);
      expect(pagina.itens).toHaveLength(45); // 645 - 6 * 100
      expect(pagina.itens[0].posicao).toBe(601);
      expect(pagina.itens[44].posicao).toBe(645);
    });

    it.each([
      ['?page=0', /\bpage\b/],
      ['?page=abc', /\bpage\b/],
      ['?page=1.5', /\bpage\b/],
      ['?page=-1', /\bpage\b/],
      ['?page=', /\bpage\b/],
      ['?page=1&page=2', /\bpage\b/],
      // Fora da faixa segura: sem a guarda, o OFFSET estoura e o SQLite responde 500.
      ['?page=99999999999999999999', /\bpage\b/],
      ['?page=100001', /\bpage\b.*100000/],
      ['?pageSize=101', /pageSize.*100/],
      ['?pageSize=-1', /pageSize/],
      ['?pageSize=0', /pageSize/],
      ['?pageSize=abc', /pageSize/],
      ['?pageSize=99999999999999999999', /pageSize/],
    ])('parâmetro inválido (%s) devolve 400 JSON com mensagem', async (query, mensagem) => {
      const { body } = await get(`/api/ufs/35/municipios${query}`).expect(400);
      expect(body.statusCode).toBe(400);
      expect(body.message).toMatch(mensagem);
    });

    it('aceita page até 100000, devolvendo itens vazios', async () => {
      const { body } = await get('/api/ufs/35/municipios?page=100000').expect(200);
      expect(body).toEqual({ total: 645, page: 100000, pageSize: 50, itens: [] });
    });

    it('RS não lista as lagoas: nenhum nome vazio e total 497 (R1)', async () => {
      const { body } = await get('/api/ufs/43/municipios?pageSize=100&page=5').expect(200);
      const pagina = body as RankingPagina;

      expect(pagina.total).toBe(497);
      expect(pagina.itens).toHaveLength(97);
      expect(pagina.itens.every((i) => i.nome !== '' && i.cdMun !== '.')).toBe(true);
    });

    it.each(['99', 'abc', '.'])('UF %s devolve 404 JSON', async (cdUf) => {
      const { body } = await get(`/api/ufs/${cdUf}/municipios`).expect(404);
      expect(body.statusCode).toBe(404);
    });
  });
});
