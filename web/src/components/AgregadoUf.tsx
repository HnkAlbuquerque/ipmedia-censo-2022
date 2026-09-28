import type { UfAgregado } from '../api/tipos';
import { formatarDecimal, formatarInteiro } from '../utils/formatar';

interface Props {
  uf: UfAgregado;
}

/** Cartões com os agregados de um estado; só apresentação, os números vêm prontos da API. */
export default function AgregadoUf({ uf }: Props) {
  return (
    <section className="cartoes" aria-label={`Dados de ${uf.nome} (${uf.sigla})`}>
      <h3 className="cartoes__titulo">
        {uf.nome} <span className="cartoes__uf">({uf.sigla})</span>
      </h3>
      <div className="cartoes__grade">
        <article className="cartao">
          <h4>População</h4>
          <p className="cartao__valor">{formatarInteiro(uf.populacao)}</p>
          <p className="cartao__unidade">habitantes</p>
        </article>

        <article className="cartao">
          <h4>Área</h4>
          <p className="cartao__valor">{formatarDecimal(uf.areaKm2)} km²</p>
        </article>

        <article className="cartao">
          <h4>Densidade demográfica</h4>
          <p className="cartao__valor">{formatarDecimal(uf.densidade)} hab/km²</p>
        </article>

        <article className="cartao">
          <h4>Municípios</h4>
          <p className="cartao__valor">{formatarInteiro(uf.totalMunicipios)}</p>
          <p className="cartao__unidade">{uf.totalMunicipios === 1 ? 'município' : 'municípios'}</p>
        </article>
      </div>
    </section>
  );
}
