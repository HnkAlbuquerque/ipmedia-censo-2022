import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { normalizar } from '../common/normalizar';
import { MunicipiosService } from './municipios.service';
import { MunicipioDetalhe, Sugestao } from './municipios.types';

/** Códigos de município do IBGE têm 7 dígitos; `'.'` e qualquer outra coisa não são município. */
const CD_MUN = /^\d{7}$/;
/** O maior nome de município tem 32 caracteres; acima disso não é busca, é abuso. */
const Q_MAXIMO = 100;

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
  buscar(@Query('q') q?: unknown): Sugestao[] {
    if (typeof q !== 'string' || normalizar(q).length < 2) {
      throw new BadRequestException(
        'Parâmetro q obrigatório com pelo menos 2 caracteres',
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
