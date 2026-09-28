import { Controller, Get } from '@nestjs/common';
import { DbService } from '../db/db.service';

export interface HealthResposta {
  status: 'ok';
  sqlite: string;
  /** Linhas de `mun_agg`: prova que o bootstrap terminou (5.571 no arquivo). */
  municipios: number;
}

@Controller('health')
export class HealthController {
  constructor(private readonly dbService: DbService) {}

  /**
   * Responde a partir da cópia de trabalho já bootstrapada. Como o Nest só
   * escuta após `onModuleInit`, uma resposta 200 aqui garante dados prontos.
   */
  @Get()
  health(): HealthResposta {
    const db = this.dbService.db;
    const versao = db.prepare('SELECT sqlite_version() AS versao').get() as {
      versao: string;
    };
    const contagem = db.prepare('SELECT count(*) AS total FROM mun_agg').get() as {
      total: number;
    };
    return { status: 'ok', sqlite: versao.versao, municipios: contagem.total };
  }
}
