import { ApiProperty } from '@nestjs/swagger';

/** Resposta do healthcheck (`GET /api/health`). */
export class HealthResposta {
  @ApiProperty({
    description: 'Sempre "ok": a API só responde depois do bootstrap do banco',
    enum: ['ok'],
    example: 'ok',
  })
  status!: 'ok';

  @ApiProperty({
    description: 'Versão do SQLite embutido no driver',
    example: '3.53.0',
  })
  sqlite!: string;

  /** Linhas de `mun_agg`: prova que o bootstrap terminou (5.571 no arquivo). */
  @ApiProperty({
    description:
      "Linhas de mun_agg, incluindo a linha '.' (R1): prova de que o bootstrap terminou",
    type: 'integer',
    example: 5571,
  })
  municipios!: number;
}
