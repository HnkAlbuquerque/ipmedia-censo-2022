import type { MunicipioDetalhe } from '../api/tipos';
import { formatarDecimal, formatarInteiro, formatarPercentual } from '../utils/formatar';

interface Props {
  municipio: MunicipioDetalhe;
}

interface Fatia {
  rotulo: string;
  valor: number;
  classe: string;
}

/** Barra horizontal empilhada com legenda; `total` é a base do percentual. */
function Barras({ fatias, total }: { fatias: Fatia[]; total: number }) {
  const percentual = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  return (
    <>
      <div className="barras" aria-hidden="true">
        {fatias.map((f) => (
          <span
            key={f.rotulo}
            className={`barras__fatia ${f.classe}`}
            style={{ width: `${percentual(f.valor)}%` }}
            title={`${f.rotulo}: ${formatarInteiro(f.valor)}`}
          />
        ))}
      </div>
      <dl className="legenda">
        {fatias.map((f) => (
          <div key={f.rotulo} className="legenda__item">
            <dt>
              <span className={`legenda__cor ${f.classe}`} aria-hidden="true" />
              {f.rotulo}
            </dt>
            <dd>
              {formatarInteiro(f.valor)}
              <span className="legenda__percentual"> ({formatarDecimal(percentual(f.valor), 1)}%)</span>
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** Cartões com os agregados de um município; só apresentação, sem contas além de percentuais de barra. */
export default function CartoesMunicipio({ municipio: m }: Props) {
  return (
    <section className="cartoes" aria-label={`Dados de ${m.nome} - ${m.uf.sigla}`}>
      <h3 className="cartoes__titulo">
        {m.nome} <span className="cartoes__uf">{m.uf.nome} ({m.uf.sigla})</span>
      </h3>
      <div className="cartoes__grade">
        <article className="cartao">
          <h4>População</h4>
          <p className="cartao__valor">{formatarInteiro(m.populacao)}</p>
          <p className="cartao__unidade">habitantes</p>
        </article>

        <article className="cartao">
          <h4>Área</h4>
          <p className="cartao__valor">{formatarDecimal(m.areaKm2)} km²</p>
        </article>

        <article className="cartao">
          <h4>Densidade demográfica</h4>
          <p className="cartao__valor">{formatarDecimal(m.densidade)} hab/km²</p>
        </article>

        <article className="cartao cartao--largo">
          <h4>Setores censitários</h4>
          <p className="cartao__valor">{formatarInteiro(m.setores.total)}</p>
          <p className="cartao__unidade">setores</p>
          <Barras
            total={m.setores.total}
            fatias={[
              { rotulo: 'Urbanos', valor: m.setores.urbanos, classe: 'cor-urbano' },
              { rotulo: 'Rurais', valor: m.setores.rurais, classe: 'cor-rural' },
              { rotulo: 'Não informados', valor: m.setores.naoInformados, classe: 'cor-nao-informado' },
            ]}
          />
        </article>

        <article className="cartao cartao--largo">
          <h4>População por sexo</h4>
          <Barras
            total={m.sexo.comDado}
            fatias={[
              { rotulo: 'Homens', valor: m.sexo.homens, classe: 'cor-homens' },
              { rotulo: 'Mulheres', valor: m.sexo.mulheres, classe: 'cor-mulheres' },
            ]}
          />
          <p className="cartao__nota">
            Dado por sexo disponível para {formatarPercentual(m.sexo.cobertura)} da população
            ({formatarInteiro(m.sexo.comDado)} de {formatarInteiro(m.populacao)} habitantes).
          </p>
        </article>
      </div>
    </section>
  );
}
