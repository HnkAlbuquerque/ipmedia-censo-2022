import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DbService } from '../db/db.service';
import { HealthResposta } from './health.types';

@ApiTags('Healthcheck')
@Controller('health')
export class HealthController {
  constructor(private readonly dbService: DbService) {}

  /**
   * Responde a partir da cópia de trabalho já bootstrapada. Como o Nest só
   * escuta após `onModuleInit`, uma resposta 200 aqui garante dados prontos.
   */
  @Get()
  @ApiOperation({
    summary: 'Prontidão da API',
    description:
      'Responde a partir da cópia de trabalho do banco. Como a API só abre a porta depois do bootstrap, um 200 aqui garante dados prontos. Usado pelo healthcheck do Docker Compose.',
  })
  @ApiOkResponse({
    description: 'API no ar e dados derivados prontos',
    type: HealthResposta,
  })
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
