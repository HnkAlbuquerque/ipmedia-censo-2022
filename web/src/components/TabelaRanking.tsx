import type { RankingItem } from '../api/tipos';
import { formatarDecimal, formatarInteiro } from '../utils/formatar';

interface Props {
  itens: RankingItem[];
  /** Complemento do rótulo acessível, ex.: "de São Paulo (SP)". */
  descricaoUf: string;
}

/** Tabela do ranking de densidade, do mais denso ao menos denso; a posição vem do servidor. */
export default function TabelaRanking({ itens, descricaoUf }: Props) {
  return (
    <div className="tabela-rolagem">
      <table className="tabela" aria-label={`Municípios ${descricaoUf} por densidade demográfica`}>
        <thead>
          <tr>
            <th scope="col" className="tabela__numero">Posição</th>
            <th scope="col">Município</th>
            <th scope="col" className="tabela__numero">População</th>
            <th scope="col" className="tabela__numero">Área (km²)</th>
            <th scope="col" className="tabela__numero">Densidade (hab/km²)</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((m) => (
            <tr key={m.cdMun}>
              <td className="tabela__numero">{formatarInteiro(m.posicao)}</td>
              <td>{m.nome}</td>
              <td className="tabela__numero">{formatarInteiro(m.populacao)}</td>
              <td className="tabela__numero">{formatarDecimal(m.areaKm2)}</td>
              <td className="tabela__numero">{formatarDecimal(m.densidade)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
