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
    description:
      'Mensagem do erro: em português nas validações da API; o texto padrão do framework, em inglês, para rota desconhecida',
    example: 'Município 9999999 não encontrado',
  })
  message!: string;

  @ApiProperty({
    description: 'Nome do status HTTP',
    example: 'Not Found',
  })
  error!: string;
}
