import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync, rmSync } from 'node:fs';
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
  tags: { name: string; description?: string }[];
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

/** Versão declarada em `api/package.json`, a mesma que o setup publica. */
const versaoDoPacote = (
  JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
  ) as { version: string }
).version;

const chaves = (objeto: object): string[] => Object.keys(objeto).sort();

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

  /** Esquema de `components.schemas` apontado por um `$ref` ou `allOf`. */
  const resolver = (esquema?: Esquema): Esquema => {
    const alvo = referencia(esquema);
    if (!alvo) {
      throw new Error('Esquema sem referência a components.schemas');
    }
    return documento.components.schemas[alvo.replace(ref(''), '')];
  };

  /** Esquema do corpo 200 da rota; em rota que devolve lista, o do item. */
  const esquemaDoCorpo = (rota: string): Esquema => {
    const esquema = esquemaDaResposta(rota, '200');
    return resolver(esquema?.type === 'array' ? esquema.items : esquema);
  };

  const campos = (esquema: Esquema): string[] => chaves(esquema.properties ?? {});

  /** Esquema de um campo aninhado (`uf`, `setores`, `sexo`, `itens`). */
  const aninhado = (esquema: Esquema, campo: string): Esquema => {
    const propriedade = esquema.properties?.[campo];
    return resolver(
      propriedade?.type === 'array' ? propriedade.items : propriedade,
    );
  };

  /** Os `example` de um esquema, só dos campos que têm exemplo próprio. */
  const exemplos = (nome: string): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(documento.components.schemas[nome].properties ?? {})
        .filter(([, propriedade]) => propriedade.example !== undefined)
        .map(([campo, propriedade]) => [campo, propriedade.example]),
    );

  /** Do corpo real, só os campos que o esquema documenta com exemplo. */
  const valores = (
    nome: string,
    corpo: Record<string, unknown>,
  ): Record<string, unknown> =>
    Object.fromEntries(
      Object.keys(exemplos(nome)).map((campo) => [campo, corpo[campo]]),
    );

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
      expect(resposta.body.info.version).toBe(versaoDoPacote);
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
      // Grupo usado em rota e grupo descrito no documento são os mesmos.
      expect([...grupos].sort()).toEqual(
        documento.tags.map((tag) => tag.name).sort(),
      );
      for (const tag of documento.tags) {
        expect(tag.description).toBeTruthy();
      }
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
        schema: { type: 'string', pattern: '^\\d{7}$', example: '3550308' },
      });
      for (const rota of ['/api/ufs/{cdUf}', '/api/ufs/{cdUf}/municipios']) {
        expect(parametro(rota, 'cdUf')).toMatchObject({
          in: 'path',
          required: true,
          schema: { type: 'string', pattern: '^\\d{2}$', example: '35' },
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

    it('os exemplos de município são os valores reais de São Paulo capital', async () => {
      const { body } = await get('/api/municipios/3550308').expect(200);

      expect(exemplos('MunicipioDetalhe')).toEqual(
        valores('MunicipioDetalhe', body),
      );
      expect(exemplos('SetoresResumo')).toEqual(body.setores);
      expect(exemplos('SexoResumo')).toEqual(body.sexo);
      expect(exemplos('UfResumo')).toEqual(body.uf);
    });

    it('os exemplos de UF são os valores reais de São Paulo', async () => {
      const { body } = await get('/api/ufs/35').expect(200);

      expect(exemplos('UfAgregado')).toEqual(body);
    });

    it('os exemplos do ranking são os do primeiro município de São Paulo', async () => {
      const { body } = await get('/api/ufs/35/municipios').expect(200);

      expect(exemplos('RankingItem')).toEqual(body.itens[0]);
    });
  });

  // O contrato publicado e o corpo que a API devolve de verdade: um campo
  // novo no service sem @ApiProperty, ou o contrário, falha aqui.
  describe('contrato e código', () => {
    it('GET /api/health devolve os campos de HealthResposta', async () => {
      const { body } = await get('/api/health').expect(200);

      expect(chaves(body)).toEqual(campos(esquemaDoCorpo('/api/health')));
    });

    it('GET /api/municipios?q= devolve itens com os campos de Sugestao', async () => {
      const { body } = await get('/api/municipios?q=sao').expect(200);
      const sugestao = esquemaDoCorpo('/api/municipios');

      expect(chaves(body[0])).toEqual(campos(sugestao));
      expect(chaves(body[0].uf)).toEqual(campos(aninhado(sugestao, 'uf')));
    });

    it('GET /api/municipios/:cdMun devolve os campos de MunicipioDetalhe e dos aninhados', async () => {
      const { body } = await get('/api/municipios/3550308').expect(200);
      const detalhe = esquemaDoCorpo('/api/municipios/{cdMun}');

      expect(chaves(body)).toEqual(campos(detalhe));
      expect(chaves(body.uf)).toEqual(campos(aninhado(detalhe, 'uf')));
      expect(chaves(body.setores)).toEqual(campos(aninhado(detalhe, 'setores')));
      expect(chaves(body.sexo)).toEqual(campos(aninhado(detalhe, 'sexo')));
    });

    it('GET /api/ufs devolve itens com os campos de UfResumo', async () => {
      const { body } = await get('/api/ufs').expect(200);

      expect(chaves(body[0])).toEqual(campos(esquemaDoCorpo('/api/ufs')));
    });

    it('GET /api/ufs/:cdUf devolve os campos de UfAgregado', async () => {
      const { body } = await get('/api/ufs/35').expect(200);

      expect(chaves(body)).toEqual(campos(esquemaDoCorpo('/api/ufs/{cdUf}')));
    });

    it('GET /api/ufs/:cdUf/municipios devolve os campos de RankingPagina e RankingItem', async () => {
      const { body } = await get('/api/ufs/35/municipios').expect(200);
      const pagina = esquemaDoCorpo('/api/ufs/{cdUf}/municipios');

      expect(chaves(body)).toEqual(campos(pagina));
      expect(chaves(body.itens[0])).toEqual(campos(aninhado(pagina, 'itens')));
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

    it('serve o script que carrega o contrato na interface', async () => {
      const resposta = await get('/api/docs/swagger-ui-init.js')
        .buffer(true)
        .parse((res, fim) => {
          let texto = '';
          res.setEncoding('utf8');
          res.on('data', (parte: string) => (texto += parte));
          res.on('end', () => fim(null, texto));
        })
        .expect(200)
        .expect('Content-Type', /javascript/);

      expect(resposta.body).toContain('/api/ufs/{cdUf}/municipios');
    });

    it('serve o pacote da interface', async () => {
      await get('/api/docs/swagger-ui-bundle.js').expect(200);
    });

    it('não publica o contrato em YAML', async () => {
      await get('/api/docs-yaml').expect(404);
    });

    it('sem o prefixo /api a documentação não existe', async () => {
      await get('/docs').expect(404);
      await get('/docs-json').expect(404);
    });
  });
});
