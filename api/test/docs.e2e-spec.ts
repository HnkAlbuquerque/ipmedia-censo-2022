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
  `censo.work.e2e-docs-${process.pid}-${Date.now()}.sqlite`,
);
process.env.DB_WORK_PATH = caminhoTrabalho;

/** Só o que os testes leem do documento OpenAPI. */
interface Esquema {
  $ref?: string;
  allOf?: Esquema[];
  type?: string;
  items?: Esquema;
  description?: string;
  example?: unknown;
  properties?: Record<string, Esquema>;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

interface Parametro {
  name: string;
  in: string;
  required: boolean;
  schema: Esquema;
}

interface Resposta {
  description: string;
  content?: { 'application/json'?: { schema: Esquema } };
}

interface Operacao {
  tags: string[];
  summary?: string;
  parameters: Parametro[];
  responses: Record<string, Resposta>;
}

interface Documento {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, Operacao>>;
  components: { schemas: Record<string, Esquema> };
}

const ROTAS = [
  '/api/health',
  '/api/municipios',
  '/api/municipios/{cdMun}',
  '/api/ufs',
  '/api/ufs/{cdUf}',
  '/api/ufs/{cdUf}/municipios',
];

const ESQUEMAS = [
  'UfResumo',
  'Sugestao',
  'MunicipioDetalhe',
  'UfAgregado',
  'RankingItem',
  'RankingPagina',
  'HealthResposta',
  'ErroResposta',
];

const ref = (nome: string) => `#/components/schemas/${nome}`;

/**
 * Nome do esquema referenciado. Propriedade com descrição sai como
 * `allOf: [{ $ref }]`, porque o OpenAPI 3.0 ignora irmãos de `$ref`.
 */
const referencia = (esquema?: Esquema): string | undefined =>
  esquema?.$ref ?? esquema?.allOf?.[0]?.$ref;

/**
 * Linhas da matriz da story 6 que tocam `/api/docs` e `/api/docs-json`
 * (CAP-9). O documento é gerado a partir dos controllers e das classes de
 * resposta; aqui se confere que o contrato publicado é o da API.
 */
describe('Documentação da API (e2e)', () => {
  let app: INestApplication | undefined;
  let documento: Documento;

  const get = (url: string) => request(app!.getHttpServer()).get(url);

  const operacao = (rota: string): Operacao => documento.paths[rota].get;

  const parametro = (rota: string, nome: string): Parametro | undefined =>
    operacao(rota).parameters.find((p) => p.name === nome);

  const esquemaDaResposta = (rota: string, status: string): Esquema | undefined =>
    operacao(rota).responses[status]?.content?.['application/json']?.schema;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configurarApp(modulo.createNestApplication());
    await app.init();

    const resposta = await get('/api/docs-json').expect(200);
    documento = resposta.body as Documento;
  });

  afterAll(async () => {
    await app?.close();
    rmSync(caminhoTrabalho, { force: true });
  });

  describe('GET /api/docs-json', () => {
    it('devolve JSON OpenAPI 3 com o título da API e a versão do package.json', async () => {
      const resposta = await get('/api/docs-json')
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(resposta.body.openapi).toMatch(/^3\./);
      expect(resposta.body.info.title).toBe('Censo 2022 API');
      expect(resposta.body.info.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('documenta exatamente as seis rotas, todas e só com GET', () => {
      expect(Object.keys(documento.paths).sort()).toEqual([...ROTAS].sort());
      for (const rota of ROTAS) {
        expect(Object.keys(documento.paths[rota])).toEqual(['get']);
      }
    });

    it('agrupa as seis rotas em três grupos', () => {
      const grupos = new Set(ROTAS.flatMap((rota) => operacao(rota).tags));

      expect(grupos.size).toBe(3);
      for (const rota of ROTAS) {
        expect(operacao(rota).tags).toHaveLength(1);
        expect(operacao(rota).summary).toBeTruthy();
      }
    });
  });

  describe('parâmetros', () => {
    it('q é obrigatório, de 2 a 100 caracteres', () => {
      const q = parametro('/api/municipios', 'q');

      expect(q).toMatchObject({
        in: 'query',
        required: true,
        schema: { type: 'string', minLength: 2, maxLength: 100 },
      });
    });

    it('page é opcional, de 1 a 100000, padrão 1', () => {
      const page = parametro('/api/ufs/{cdUf}/municipios', 'page');

      expect(page).toMatchObject({
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1 },
      });
    });

    it('pageSize é opcional, de 1 a 100, padrão 50', () => {
      const pageSize = parametro('/api/ufs/{cdUf}/municipios', 'pageSize');

      expect(pageSize).toMatchObject({
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      });
    });

    it('cdMun e cdUf são parâmetros de caminho obrigatórios', () => {
      expect(parametro('/api/municipios/{cdMun}', 'cdMun')).toMatchObject({
        in: 'path',
        required: true,
        schema: { type: 'string', example: '3550308' },
      });
      for (const rota of ['/api/ufs/{cdUf}', '/api/ufs/{cdUf}/municipios']) {
        expect(parametro(rota, 'cdUf')).toMatchObject({
          in: 'path',
          required: true,
          schema: { type: 'string', example: '35' },
        });
      }
    });
  });

  describe('esquemas', () => {
    it('publica os oito esquemas de resposta e os dois aninhados', () => {
      const nomes = Object.keys(documento.components.schemas);

      expect(nomes).toEqual(expect.arrayContaining(ESQUEMAS));
      expect(nomes).toEqual(
        expect.arrayContaining(['SetoresResumo', 'SexoResumo']),
      );
    });

    it('MunicipioDetalhe referencia SetoresResumo, SexoResumo e UfResumo', () => {
      const { properties } = documento.components.schemas.MunicipioDetalhe;

      expect(referencia(properties?.setores)).toBe(ref('SetoresResumo'));
      expect(referencia(properties?.sexo)).toBe(ref('SexoResumo'));
      expect(referencia(properties?.uf)).toBe(ref('UfResumo'));
    });

    it('RankingPagina.itens é uma lista de RankingItem', () => {
      const { itens } = documento.components.schemas.RankingPagina.properties!;

      expect(itens.type).toBe('array');
      expect(referencia(itens.items)).toBe(ref('RankingItem'));
    });

    it('UfAgregado herda os campos de UfResumo', () => {
      const campos = Object.keys(
        documento.components.schemas.UfAgregado.properties!,
      );

      expect(campos.sort()).toEqual(
        [
          'areaKm2',
          'cdUf',
          'densidade',
          'nome',
          'populacao',
          'sigla',
          'totalMunicipios',
        ].sort(),
      );
    });

    it('todo campo tem descrição e exemplo (ou é referência a outro esquema)', () => {
      for (const [nome, esquema] of Object.entries(documento.components.schemas)) {
        const campos = Object.entries(esquema.properties ?? {});
        // Esquema sem campo é o sintoma de @ApiProperty faltando.
        expect([nome, campos.length > 0]).toEqual([nome, true]);

        for (const [campo, propriedade] of campos) {
          const documentado =
            Boolean(propriedade.description) &&
            (propriedade.example !== undefined ||
              referencia(propriedade) !== undefined ||
              referencia(propriedade.items) !== undefined);
          expect([`${nome}.${campo}`, documentado]).toEqual([
            `${nome}.${campo}`,
            true,
          ]);
        }
      }
    });

    it('os exemplos são os valores reais de São Paulo', () => {
      const { schemas } = documento.components;

      expect(schemas.MunicipioDetalhe.properties?.cdMun.example).toBe('3550308');
      expect(schemas.MunicipioDetalhe.properties?.populacao.example).toBe(11451999);
      expect(schemas.MunicipioDetalhe.properties?.densidade.example).toBe(7528.26);
      expect(schemas.UfResumo.properties?.cdUf.example).toBe('35');
      expect(schemas.UfAgregado.properties?.totalMunicipios.example).toBe(645);
    });
  });

  describe('respostas', () => {
    it('cada rota documenta o 200 com o seu esquema', () => {
      expect(referencia(esquemaDaResposta('/api/health', '200'))).toBe(
        ref('HealthResposta'),
      );
      expect(
        referencia(esquemaDaResposta('/api/municipios/{cdMun}', '200')),
      ).toBe(ref('MunicipioDetalhe'));
      expect(referencia(esquemaDaResposta('/api/ufs/{cdUf}', '200'))).toBe(
        ref('UfAgregado'),
      );
      expect(
        referencia(esquemaDaResposta('/api/ufs/{cdUf}/municipios', '200')),
      ).toBe(ref('RankingPagina'));
    });

    it('autocomplete e lista de UFs devolvem listas', () => {
      const sugestoes = esquemaDaResposta('/api/municipios', '200');
      const ufs = esquemaDaResposta('/api/ufs', '200');

      expect(sugestoes?.type).toBe('array');
      expect(referencia(sugestoes?.items)).toBe(ref('Sugestao'));
      expect(ufs?.type).toBe('array');
      expect(referencia(ufs?.items)).toBe(ref('UfResumo'));
    });

    it('400 no autocomplete e no ranking, com ErroResposta', () => {
      for (const rota of ['/api/municipios', '/api/ufs/{cdUf}/municipios']) {
        expect(referencia(esquemaDaResposta(rota, '400'))).toBe(
          ref('ErroResposta'),
        );
      }
    });

    it('404 no município, na UF e no ranking, com ErroResposta', () => {
      for (const rota of [
        '/api/municipios/{cdMun}',
        '/api/ufs/{cdUf}',
        '/api/ufs/{cdUf}/municipios',
      ]) {
        expect(referencia(esquemaDaResposta(rota, '404'))).toBe(
          ref('ErroResposta'),
        );
      }
    });

    it('não documenta erro que a rota não devolve', () => {
      const status = (rota: string) =>
        Object.keys(operacao(rota).responses).sort();

      expect(status('/api/health')).toEqual(['200']);
      expect(status('/api/ufs')).toEqual(['200']);
      expect(status('/api/municipios')).toEqual(['200', '400']);
      expect(status('/api/municipios/{cdMun}')).toEqual(['200', '404']);
      expect(status('/api/ufs/{cdUf}')).toEqual(['200', '404']);
      expect(status('/api/ufs/{cdUf}/municipios')).toEqual(['200', '400', '404']);
    });

    it('o corpo de erro real tem os campos de ErroResposta', async () => {
      const campos = Object.keys(
        documento.components.schemas.ErroResposta.properties!,
      ).sort();

      const naoEncontrado = await get('/api/municipios/9999999').expect(404);
      const invalido = await get('/api/municipios?q=a').expect(400);

      expect(Object.keys(naoEncontrado.body).sort()).toEqual(campos);
      expect(Object.keys(invalido.body).sort()).toEqual(campos);
    });
  });

  describe('GET /api/docs', () => {
    it('devolve a interface do Swagger em HTML', async () => {
      const resposta = await get('/api/docs')
        .expect(200)
        .expect('Content-Type', /text\/html/);

      expect(resposta.text).toContain('swagger-ui');
    });

    it('sem o prefixo /api a documentação não existe', async () => {
      await get('/docs').expect(404);
      await get('/docs-json').expect(404);
    });
  });
});
