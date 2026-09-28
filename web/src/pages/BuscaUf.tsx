import { useEffect, useId, useState } from 'react';
import { descreverErro, listarMunicipiosDaUf, listarUfs, obterUf } from '../api/client';
import type { RankingPagina, Uf, UfAgregado } from '../api/tipos';
import AgregadoUf from '../components/AgregadoUf';
import Paginacao from '../components/Paginacao';
import TabelaRanking from '../components/TabelaRanking';

/** Tamanho fixo de página do ranking (o default da API, R6). */
const PAGE_SIZE = 50;

type Lista =
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; ufs: Uf[] };

type Agregado =
  | { estado: 'inicial' }
  | { estado: 'carregando' }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; uf: UfAgregado };

type Ranking =
  | { estado: 'inicial' }
  /** `anterior`: página da mesma UF que fica na tela enquanto a próxima carrega. */
  | { estado: 'carregando'; cdUf: string; anterior?: RankingPagina }
  | { estado: 'erro'; mensagem: string }
  | { estado: 'pronto'; cdUf: string; pagina: RankingPagina };

const NAO_ENCONTRADO = 'Estado não encontrado.';

/** Página exibível do ranking, só se for da UF pedida: trocar de UF não deixa a tabela antiga. */
function paginaDa(ranking: Ranking, cdUf: string): RankingPagina | undefined {
  if (ranking.estado === 'pronto' && ranking.cdUf === cdUf) return ranking.pagina;
  if (ranking.estado === 'carregando' && ranking.cdUf === cdUf) return ranking.anterior;
  return undefined;
}

/** Tela 2: seleção de UF, agregados do estado e ranking de densidade paginado. */
export default function BuscaUf() {
  const [lista, setLista] = useState<Lista>({ estado: 'carregando' });
  const [cdUf, setCdUf] = useState('');
  const [page, setPage] = useState(1);
  const [agregado, setAgregado] = useState<Agregado>({ estado: 'inicial' });
  const [ranking, setRanking] = useState<Ranking>({ estado: 'inicial' });
  const idSelect = useId();

  // As 27 UFs, uma vez, ao montar. Um 404 aqui não tem leitura especial.
  useEffect(() => {
    const controle = new AbortController();
    listarUfs(controle.signal).then(
      (ufs) => {
        if (controle.signal.aborted) return;
        setLista({ estado: 'pronto', ufs });
      },
      (e: unknown) => {
        if (controle.signal.aborted) return;
        setLista({ estado: 'erro', mensagem: descreverErro(e, null) });
      },
    );
    return () => controle.abort();
  }, []);

  // Agregado do estado: só quando a UF muda.
  useEffect(() => {
    if (!cdUf) {
      setAgregado({ estado: 'inicial' });
      return;
    }
    const controle = new AbortController();
    setAgregado({ estado: 'carregando' });
    obterUf(cdUf, controle.signal).then(
      (uf) => {
        // UF trocada antes da resposta: a anterior não pode sobrescrever a nova.
        if (controle.signal.aborted) return;
        setAgregado({ estado: 'pronto', uf });
      },
      (e: unknown) => {
        if (controle.signal.aborted) return;
        setAgregado({ estado: 'erro', mensagem: descreverErro(e, NAO_ENCONTRADO) });
      },
    );
    return () => controle.abort();
  }, [cdUf]);

  // Ranking: quando a UF ou a página muda. Ao paginar, a tabela atual fica
  // montada (com aria-busy) até a próxima chegar: foco e layout não pulam.
  useEffect(() => {
    if (!cdUf) {
      setRanking({ estado: 'inicial' });
      return;
    }
    const controle = new AbortController();
    setRanking((atual) => ({ estado: 'carregando', cdUf, anterior: paginaDa(atual, cdUf) }));
    listarMunicipiosDaUf(cdUf, page, PAGE_SIZE, controle.signal).then(
      (pagina) => {
        if (controle.signal.aborted) return;
        setRanking({ estado: 'pronto', cdUf, pagina });
      },
      (e: unknown) => {
        if (controle.signal.aborted) return;
        setRanking({ estado: 'erro', mensagem: descreverErro(e, NAO_ENCONTRADO) });
      },
    );
    return () => controle.abort();
  }, [cdUf, page]);

  const ufs = lista.estado === 'pronto' ? lista.ufs : [];
  const selecionada = ufs.find((u) => u.cdUf === cdUf);
  const nomeUf = selecionada ? `${selecionada.nome} (${selecionada.sigla})` : '';
  // Complementos já com a preposição, para o fallback ler certo ("do estado").
  const deUf = selecionada ? `de ${nomeUf}` : 'do estado';
  const paraUf = selecionada ? `para ${nomeUf}` : 'para o estado';

  const paginaMostrada = paginaDa(ranking, cdUf);
  const carregandoRanking = ranking.estado === 'carregando';

  return (
    <>
      <h2>Busca por estado</h2>
      <p className="contexto">
        Escolha um estado para ver população, área, densidade e quantidade de municípios do
        Censo 2022, com os municípios ordenados do mais denso ao menos denso.
      </p>

      <div className="selecao-uf">
        <label className="selecao-uf__rotulo" htmlFor={idSelect}>
          Estado
        </label>
        <select
          id={idSelect}
          className="selecao-uf__campo"
          value={cdUf}
          disabled={lista.estado !== 'pronto'}
          onChange={(e) => {
            // Trocar de UF sempre volta para a página 1.
            setCdUf(e.target.value);
            setPage(1);
          }}
        >
          <option value="">
            {lista.estado === 'carregando' ? 'Carregando estados...' : 'Selecione um estado'}
          </option>
          {ufs.map((u) => (
            <option key={u.cdUf} value={u.cdUf}>
              {u.nome} ({u.sigla})
            </option>
          ))}
        </select>
      </div>

      {lista.estado === 'erro' && (
        <p className="estado estado--erro" role="alert">
          Não foi possível carregar a lista de estados. {lista.mensagem}
        </p>
      )}

      {agregado.estado === 'carregando' && (
        <p className="estado" role="status">
          Carregando dados {deUf}...
        </p>
      )}
      {agregado.estado === 'erro' && (
        <p className="estado estado--erro" role="alert">
          Não foi possível carregar os dados {deUf}. {agregado.mensagem}
        </p>
      )}
      {agregado.estado === 'pronto' && <AgregadoUf uf={agregado.uf} />}

      {carregandoRanking && (
        <p className="estado" role="status">
          Carregando municípios {deUf}...
        </p>
      )}
      {ranking.estado === 'erro' && (
        <p className="estado estado--erro" role="alert">
          Não foi possível carregar os municípios {deUf}. {ranking.mensagem}
        </p>
      )}
      {ranking.estado === 'pronto' && ranking.pagina.total === 0 && (
        <p className="estado" role="status">
          Nenhum município encontrado {paraUf}.
        </p>
      )}
      {paginaMostrada && paginaMostrada.total > 0 && (
        <section
          className="ranking"
          aria-label={`Ranking de densidade ${deUf}`}
          aria-busy={carregandoRanking}
        >
          <h3 className="ranking__titulo">Municípios por densidade demográfica</h3>
          <TabelaRanking itens={paginaMostrada.itens} descricaoUf={deUf} />
          <Paginacao
            page={paginaMostrada.page}
            totalPaginas={Math.max(1, Math.ceil(paginaMostrada.total / paginaMostrada.pageSize))}
            total={paginaMostrada.total}
            aoMudar={setPage}
            carregando={carregandoRanking}
          />
        </section>
      )}
    </>
  );
}
