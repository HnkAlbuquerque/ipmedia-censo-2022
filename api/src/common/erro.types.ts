import { ApiProperty } from '@nestjs/swagger';

/**
 * Corpo de erro no formato padrão do Nest (`HttpException`). Só documenta:
 * quem monta o corpo continua sendo o filtro de exceções do framework.
 */
export class ErroResposta {
  @ApiProperty({
    description: 'Código de status HTTP da resposta',
    type: 'integer',
    example: 404,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Motivo do erro, em português',
    example: 'Município 9999999 não encontrado',
  })
  message!: string;

  @ApiProperty({
    description: 'Nome do status HTTP',
    example: 'Not Found',
  })
  error!: string;
}
