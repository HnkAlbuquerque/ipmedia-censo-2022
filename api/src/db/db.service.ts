import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Database from 'better-sqlite3';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { normalizar } from '../common/normalizar';

/**
 * Conexão com a cópia de trabalho do censo.sqlite.
 *
 * O arquivo entregue nunca é aberto para escrita: a cada subida ele é copiado
 * para `DB_WORK_PATH` e é nessa cópia que nascem os índices, a coluna
 * `nm_mun_busca` e a tabela `mun_agg`. Tudo acontece de forma síncrona em
 * `onModuleInit`, então o Nest só abre a porta com os dados prontos e o
 * healthcheck do compose não mente.
 */
@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  private conexao?: Database.Database;

  /** Caminho do arquivo entregue (só leitura). */
  readonly caminhoOrigem: string;
  /** Caminho da cópia de trabalho, sobrescrita a cada bootstrap. */
  readonly caminhoTrabalho: string;

  constructor() {
    // Defaults pensados para `npm run start:dev` dentro de api/; na imagem
    // Docker as duas variáveis vêm do ENV do Dockerfile.
    this.caminhoOrigem = resolve(
      process.env.DB_SOURCE_PATH ?? join(process.cwd(), '..', 'censo.sqlite'),
    );
    this.caminhoTrabalho = resolve(
      process.env.DB_WORK_PATH ??
        join(process.cwd(), '.data', 'censo.work.sqlite'),
    );
  }

  /** Conexão aberta; lança se o bootstrap ainda não rodou. */
  get db(): Database.Database {
    if (!this.conexao) {
      throw new Error('Banco ainda não inicializado: bootstrap não executou');
    }
    return this.conexao;
  }

  onModuleInit(): void {
    this.bootstrap();
  }

  onModuleDestroy(): void {
    this.fechar();
  }

  /**
   * Copia a origem para o caminho de trabalho e cria os dados derivados.
   * Idempotente: pode ser chamado de novo e o resultado é o mesmo.
   */
  bootstrap(): void {
    const inicio = performance.now();

    // Valida antes de fechar a conexão atual: numa reexecução com origem
    // ausente, a conexão viva continua servindo.
    if (!statSync(this.caminhoOrigem, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(
        `Banco de origem não encontrado em ${this.caminhoOrigem} ` +
          '(defina DB_SOURCE_PATH ou rode a partir de api/)',
      );
    }
    if (this.caminhoOrigem === this.caminhoTrabalho) {
      throw new Error(
        `DB_WORK_PATH não pode ser o próprio arquivo de origem (${this.caminhoOrigem}): ` +
          'o censo.sqlite entregue nunca é aberto para escrita',
      );
    }

    this.fechar();
    mkdirSync(dirname(this.caminhoTrabalho), { recursive: true });
    // Restos de uma execução anterior interrompida não podem ser aplicados
    // sobre a cópia nova: um journal antigo "desfaria" transações que não
    // pertencem a este arquivo.
    for (const sufixo of ['-journal', '-wal', '-shm']) {
      rmSync(this.caminhoTrabalho + sufixo, { force: true });
    }
    copyFileSync(this.caminhoOrigem, this.caminhoTrabalho);

    const db = new Database(this.caminhoTrabalho);
    try {
      // Arquivo efêmero, recriado a cada subida: sem WAL e sem fsync.
      db.pragma('journal_mode = MEMORY');
      db.pragma('synchronous = OFF');

      this.criarColunaBusca(db);
      db.exec(readFileSync(join(__dirname, 'bootstrap.sql'), 'utf8'));
    } catch (erro) {
      db.close();
      throw erro;
    }

    this.conexao = db;
    const duracaoMs = Math.round(performance.now() - inicio);
    this.logger.log(
      `Bootstrap concluído em ${duracaoMs} ms: ${this.caminhoTrabalho}`,
    );
  }

  /**
   * Adiciona `municipio.nm_mun_busca` se ainda não existir e preenche com
   * `normalizar(nm_mun)`. Feito em JS porque o SQLite não remove acentos;
   * a mesma função serve a busca, então bootstrap e consulta nunca divergem.
   * A linha `cd_mun = '.'` tem nome vazio e recebe `nm_mun_busca = ''` (não
   * NULL): a story 3 a exclui por `cd_mun <> '.'`, nunca por teste de NULL.
   */
  private criarColunaBusca(db: Database.Database): void {
    const colunas = db.pragma('table_info(municipio)') as { name: string }[];
    if (!colunas.some((c) => c.name === 'nm_mun_busca')) {
      db.exec('ALTER TABLE municipio ADD COLUMN nm_mun_busca TEXT');
    }

    const linhas = db
      .prepare('SELECT cd_mun, nm_mun FROM municipio')
      .all() as { cd_mun: string; nm_mun: string }[];
    const atualizar = db.prepare(
      'UPDATE municipio SET nm_mun_busca = ? WHERE cd_mun = ?',
    );
    db.transaction((lista: typeof linhas) => {
      for (const linha of lista) {
        atualizar.run(normalizar(linha.nm_mun), linha.cd_mun);
      }
    })(linhas);
  }

  private fechar(): void {
    if (this.conexao) {
      this.conexao.close();
      this.conexao = undefined;
    }
  }
}
