import Database from 'better-sqlite3';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { UFS } from '../common/ufs';
import { DbService } from './db.service';

/**
 * Sobe o DbService real contra o censo.sqlite entregue e confere os valores
 * de referência de regras-de-dados.md (R1, R2, R3, R5, R7). Roda no `npm test`
 * junto com os unit; custa um bootstrap (~1 s).
 */
describe('DbService (integração com censo.sqlite)', () => {
  const caminhoTrabalho = join(
    tmpdir(),
    `censo.work.integration-${process.pid}-${Date.now()}.sqlite`,
  );
  let service: DbService;

  beforeAll(() => {
    process.env.DB_WORK_PATH = caminhoTrabalho;
    delete process.env.DB_SOURCE_PATH; // default: ../censo.sqlite a partir de api/
    service = new DbService();
    service.onModuleInit();
  });

  afterAll(() => {
    service.onModuleDestroy();
    rmSync(caminhoTrabalho, { force: true });
  });

  const um = <T>(sql: string, ...params: unknown[]): T =>
    service.db.prepare(sql).get(...params) as T;

  it('cria a cópia de trabalho no caminho configurado', () => {
    expect(service.caminhoTrabalho).toBe(caminhoTrabalho);
    expect(existsSync(caminhoTrabalho)).toBe(true);
  });

  it('cria os três índices', () => {
    const indices = service.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((l) => (l as { name: string }).name);
    expect(indices).toEqual(
      expect.arrayContaining(['idx_setor_mun', 'idx_mun_uf', 'idx_mun_busca']),
    );
    // Nome certo em coluna errada passaria só pelo nome.
    const colunaDo = (indice: string) =>
      (service.db.pragma(`index_info(${indice})`) as { name: string }[]).map(
        (c) => c.name,
      );
    expect(colunaDo('idx_setor_mun')).toEqual(['cd_mun']);
    expect(colunaDo('idx_mun_uf')).toEqual(['cd_uf']);
    expect(colunaDo('idx_mun_busca')).toEqual(['nm_mun_busca']);
  });

  it('o censo.sqlite de origem continua sem derivados', () => {
    const origem = new Database(service.caminhoOrigem, { readonly: true });
    try {
      const nomes = origem
        .prepare(
          "SELECT name FROM sqlite_master WHERE name = 'mun_agg' OR name LIKE 'idx_%'",
        )
        .all();
      expect(nomes).toEqual([]);
      const colunas = (
        origem.pragma('table_info(municipio)') as { name: string }[]
      ).map((c) => c.name);
      expect(colunas).not.toContain('nm_mun_busca');
    } finally {
      origem.close();
    }
  });

  it('mun_agg tem 5.571 linhas, 5.570 sem o cd_mun "." (R1)', () => {
    expect(um<{ n: number }>('SELECT count(*) AS n FROM mun_agg').n).toBe(5571);
    expect(
      um<{ n: number }>("SELECT count(*) AS n FROM mun_agg WHERE cd_mun <> '.'")
        .n,
    ).toBe(5570);
  });

  it('a linha "." existe, com população 0 e 2 setores (R1)', () => {
    const lagoas = um<{ populacao: number; setores_total: number }>(
      "SELECT populacao, setores_total FROM mun_agg WHERE cd_mun = '.'",
    );
    expect(lagoas.populacao).toBe(0);
    expect(lagoas.setores_total).toBe(2);
  });

  it('a soma da população bate com o IBGE (R2)', () => {
    expect(
      um<{ total: number }>('SELECT sum(populacao) AS total FROM mun_agg').total,
    ).toBe(203080756);
  });

  it('a soma da área bate com tolerância de 0,01 km² (R7)', () => {
    const { total } = um<{ total: number }>(
      'SELECT sum(area_km2) AS total FROM mun_agg',
    );
    expect(Math.abs(total - 8510417.25)).toBeLessThan(0.01);
  });

  it('as três situações somam o total em todas as linhas (R3)', () => {
    const { n } = um<{ n: number }>(
      `SELECT count(*) AS n FROM mun_agg
       WHERE setores_urbanos + setores_rurais + setores_nao_informados <> setores_total`,
    );
    expect(n).toBe(0);
  });

  it('São Paulo capital (3550308) bate com os valores de referência (R2, R3, R5, R7)', () => {
    const sp = um<{
      setores_total: number;
      setores_urbanos: number;
      setores_rurais: number;
      setores_nao_informados: number;
      populacao: number;
      area_km2: number;
      homens: number;
      mulheres: number;
      moradores: number;
    }>("SELECT * FROM mun_agg WHERE cd_mun = '3550308'");

    expect(sp.setores_total).toBe(27301);
    expect(sp.setores_urbanos).toBe(27037);
    expect(sp.setores_rurais).toBe(254);
    expect(sp.setores_nao_informados).toBe(10);
    expect(sp.populacao).toBe(11451999);
    // Área crua, sem arredondar: quem responde arredonda (R7).
    expect(Math.abs(sp.area_km2 - 1521.2015839)).toBeLessThan(0.01);
    expect(sp.homens).toBe(5380188);
    expect(sp.mulheres).toBe(6060887);
    expect(sp.moradores).toBe(11441079);
  });

  it('nm_mun_busca é preenchida com normalizar() (R4)', () => {
    expect(
      um<{ b: string }>(
        "SELECT nm_mun_busca AS b FROM municipio WHERE cd_mun = '3550308'",
      ).b,
    ).toBe('sao paulo');
    expect(
      um<{ n: number }>(
        'SELECT count(*) AS n FROM municipio WHERE nm_mun_busca IS NULL',
      ).n,
    ).toBe(0);
    // A linha '.' tem nome vazio: fica '' e não NULL; a story 3 a exclui por cd_mun.
    expect(
      um<{ b: string }>("SELECT nm_mun_busca AS b FROM municipio WHERE cd_mun = '.'")
        .b,
    ).toBe('');
  });

  it('o mapa de UFs cobre exatamente os códigos da tabela uf', () => {
    const linhas = service.db
      .prepare('SELECT cd_uf, nm_uf FROM uf ORDER BY cd_uf')
      .all() as { cd_uf: string; nm_uf: string }[];
    expect(linhas.map((l) => l.cd_uf)).toEqual(Object.keys(UFS).sort());
    for (const { cd_uf, nm_uf } of linhas) {
      expect(UFS[cd_uf].nome).toBe(nm_uf);
    }
  });

  it('usa os defaults ../censo.sqlite e .data/censo.work.sqlite a partir do cwd', () => {
    const trabalhoAnterior = process.env.DB_WORK_PATH;
    delete process.env.DB_WORK_PATH;
    delete process.env.DB_SOURCE_PATH;
    try {
      const padrao = new DbService(); // sem bootstrap: só resolve caminhos
      expect(padrao.caminhoOrigem).toBe(
        resolve(process.cwd(), '..', 'censo.sqlite'),
      );
      expect(padrao.caminhoTrabalho).toBe(
        resolve(process.cwd(), '.data', 'censo.work.sqlite'),
      );
    } finally {
      process.env.DB_WORK_PATH = trabalhoAnterior;
    }
  });

  it('cria o diretório de trabalho quando ele não existe', () => {
    const pasta = join(tmpdir(), `censo-dir-${process.pid}-${Date.now()}`);
    const arquivo = join(pasta, 'sub', 'censo.work.sqlite');
    process.env.DB_WORK_PATH = arquivo;
    try {
      const outro = new DbService();
      outro.onModuleInit();
      outro.onModuleDestroy();
      expect(existsSync(arquivo)).toBe(true);
    } finally {
      process.env.DB_WORK_PATH = caminhoTrabalho;
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  it('rodar o bootstrap de novo não duplica nada (idempotência)', () => {
    service.bootstrap();

    expect(um<{ n: number }>('SELECT count(*) AS n FROM mun_agg').n).toBe(5571);
    const colunas = (
      service.db.pragma('table_info(municipio)') as { name: string }[]
    ).filter((c) => c.name === 'nm_mun_busca');
    expect(colunas).toHaveLength(1);
    const indices = service.db
      .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
      .get() as { n: number };
    expect(indices.n).toBe(3);
  });

  it('falha com erro claro quando a origem não existe', () => {
    process.env.DB_SOURCE_PATH = '/caminho/que/nao/existe/censo.sqlite';
    process.env.DB_WORK_PATH = join(tmpdir(), `censo.work.ausente-${process.pid}.sqlite`);
    try {
      const semOrigem = new DbService();
      expect(() => semOrigem.onModuleInit()).toThrow(
        /Banco de origem não encontrado em \/caminho\/que\/nao\/existe\/censo\.sqlite/,
      );
    } finally {
      delete process.env.DB_SOURCE_PATH;
      process.env.DB_WORK_PATH = caminhoTrabalho;
    }
  });
});
