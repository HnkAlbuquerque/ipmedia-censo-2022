import { formatarInteiro } from '../utils/formatar';

interface Props {
  page: number;
  totalPaginas: number;
  /** Total de itens em todas as páginas. */
  total: number;
  aoMudar: (page: number) => void;
  /** Próxima página a caminho: botões desabilitados, mas continuam montados (foco não se perde). */
  carregando?: boolean;
}

/** Anterior / Próxima com "Página X de Y" e o total de municípios; sem biblioteca. */
export default function Paginacao({ page, totalPaginas, total, aoMudar, carregando = false }: Props) {
  return (
    <nav className="paginacao" aria-label="Paginação do ranking">
      <button
        type="button"
        className="paginacao__botao"
        onClick={() => aoMudar(page - 1)}
        disabled={carregando || page <= 1}
      >
        Anterior
      </button>
      <span className="paginacao__texto" role="status">
        Página {formatarInteiro(page)} de {formatarInteiro(totalPaginas)}
      </span>
      <button
        type="button"
        className="paginacao__botao"
        onClick={() => aoMudar(page + 1)}
        disabled={carregando || page >= totalPaginas}
      >
        Próxima
      </button>
      <span className="paginacao__total">
        {formatarInteiro(total)} {total === 1 ? 'município' : 'municípios'}
      </span>
    </nav>
  );
}
