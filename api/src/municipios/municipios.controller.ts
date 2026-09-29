import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ErroResposta } from '../common/erro.types';
import { normalizar } from '../common/normalizar';
import { TAG_MUNICIPIOS } from '../common/tags';
import { MunicipiosService } from './municipios.service';
import { MunicipioDetalhe, Sugestao } from './municipios.types';

/** Códigos de município do IBGE têm 7 dígitos; `'.'` e qualquer outra coisa não são município. */
const CD_MUN = /^\d{7}$/;
/** O maior nome de município tem 32 caracteres; acima disso não é busca, é abuso. */
const Q_MAXIMO = 100;
/** Mínimo contado depois de normalizar: uma letra só casaria com metade do país. */
const Q_MINIMO = 2;

@ApiTags(TAG_MUNICIPIOS)
@Controller('municipios')
export class MunicipiosController {
  constructor(private readonly service: MunicipiosService) {}

  /**
   * `GET /api/municipios?q=` -- autocomplete. Validação à mão, sem
   * class-validator: `q` precisa ser uma string com pelo menos 2 caracteres
   * depois de normalizar (então `" a "`, `"%20"` e `"%"` são curtos) e no
   * máximo 100 caracteres crus.
   */
  @Get()
  @ApiOperation({
    summary: 'Autocomplete de municípios',
    description:
      'Busca por prefixo de palavra, sem acento e sem diferença de caixa. Devolve até 10 sugestões: nome exato primeiro, depois população decrescente. Toda sugestão carrega a UF, porque há nomes repetidos entre estados.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description:
      'Parte do nome do município. O mínimo é contado depois de normalizar (acentos removidos, espaços colapsados), então o minLength do esquema é condição necessária, não suficiente: "  a " tem 4 caracteres e devolve 400. O máximo é contado no texto cru. Repetir o parâmetro devolve 400.',
    schema: {
      type: 'string',
      minLength: Q_MINIMO,
      maxLength: Q_MAXIMO,
      example: 'sao',
    },
  })
  @ApiOkResponse({
    description: 'Sugestões, no máximo 10; lista vazia se nada casar',
    type: [Sugestao],
  })
  @ApiBadRequestResponse({
    description: 'Parâmetro q ausente, repetido, curto demais ou longo demais',
    type: ErroResposta,
    example: {
      statusCode: 400,
      message: `Parâmetro q obrigatório com pelo menos ${Q_MINIMO} caracteres`,
      error: 'Bad Request',
    },
  })
  buscar(@Query('q') q?: unknown): Sugestao[] {
    if (typeof q !== 'string' || normalizar(q).length < Q_MINIMO) {
      throw new BadRequestException(
        `Parâmetro q obrigatório com pelo menos ${Q_MINIMO} caracteres`,
      );
    }
    if (q.length > Q_MAXIMO) {
      throw new BadRequestException(
        `Parâmetro q deve ter no máximo ${Q_MAXIMO} caracteres`,
      );
    }
    return this.service.buscar(q);
  }

  /**
   * `GET /api/municipios/:cdMun` -- agregados. Código fora do formato do IBGE
   * (inclusive `'.'`) ou inexistente devolve 404: não há esse município.
   */
  @Get(':cdMun')
  @ApiOperation({
    summary: 'Agregados de um município',
    description:
      'População, área, densidade, setores censitários por situação e população por sexo com a cobertura do dado.',
  })
  @ApiParam({
    name: 'cdMun',
    description: 'Código do município no IBGE, 7 dígitos',
    schema: { type: 'string', pattern: CD_MUN.source, example: '3550308' },
  })
  @ApiOkResponse({
    description: 'Agregados do município',
    type: MunicipioDetalhe,
  })
  @ApiNotFoundResponse({
    description: 'Código fora do formato ou município inexistente',
    type: ErroResposta,
    example: {
      statusCode: 404,
      message: 'Município 9999999 não encontrado',
      error: 'Not Found',
    },
  })
  obter(@Param('cdMun') cdMun: string): MunicipioDetalhe {
    const municipio = CD_MUN.test(cdMun)
      ? this.service.obter(cdMun)
      : undefined;
    if (!municipio) {
      throw new NotFoundException(`Município ${cdMun} não encontrado`);
    }
    return municipio;
  }
}
