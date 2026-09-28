import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { descreverErro } from '../api/client';
import type { Sugestao } from '../api/tipos';

interface Props {
  /** Função que consulta a API; injetada para a página e os testes controlarem. */
  buscar: (q: string, signal: AbortSignal) => Promise<Sugestao[]>;
  aoSelecionar: (sugestao: Sugestao) => void;
  rotulo: string;
  placeholder?: string;
}

/** Espera entre a última tecla e a requisição. */
const DEBOUNCE_MS = 300;
/** Termos mais curtos não vão à API (que também devolve 400 abaixo disso). */
const MINIMO = 2;

/** Rótulo de uma sugestão, igual ao que a lista mostra e ao que o campo recebe. */
export function rotuloDe(s: Sugestao): string {
  return `${s.nome} - ${s.uf.sigla}`;
}

/**
 * Mesma normalização que a API aplica antes de contar o mínimo (sem acentos,
 * minúsculas, espaços colapsados, aparado), só para decidir se vale pedir:
 * o termo enviado é o que o usuário digitou.
 */
function normalizarParaContar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Campo de busca com sugestões, sem biblioteca: input controlado, debounce de
 * 300 ms, mínimo de 2 caracteres, navegação por setas/Enter/Escape e clique,
 * papéis ARIA de combobox/listbox.
 */
export default function Autocomplete({ buscar, aoSelecionar, rotulo, placeholder }: Props) {
  const [termo, setTermo] = useState('');
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  /** Última busca respondeu (com lista, vazia ou erro): habilita "Nenhum...". */
  const [respondeu, setRespondeu] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [carregando, setCarregando] = useState(false);
  /** Mensagem pronta para exibir; `null` sem erro. */
  const [erro, setErro] = useState<string | null>(null);

  // Último termo efetivamente pedido: respostas de termos anteriores que
  // cheguem depois (fora de ordem) são descartadas.
  const ultimoPedido = useRef<string | null>(null);
  // Rótulo da última seleção: o campo recebe esse texto e não deve rebuscar.
  const selecionado = useRef<string | null>(null);
  // Painel fechado pelo usuário (Escape ou blur): uma resposta que chegue
  // depois não o reabre; digitar ou focar de novo libera.
  const fechadoRef = useRef(false);

  const id = useId();
  const idCampo = `${id}-campo`;
  const idPainel = `${id}-painel`;
  const idOpcao = (i: number) => `${id}-opcao-${i}`;

  useEffect(() => {
    const q = termo.trim();
    if (normalizarParaContar(q).length < MINIMO || q === selecionado.current) {
      ultimoPedido.current = null;
      setSugestoes([]);
      setRespondeu(false);
      setCarregando(false);
      setErro(null);
      return;
    }

    const controle = new AbortController();
    const temporizador = setTimeout(() => {
      ultimoPedido.current = q;
      setCarregando(true);
      setErro(null);
      buscar(q, controle.signal).then(
        (lista) => {
          if (controle.signal.aborted || ultimoPedido.current !== q) return;
          setSugestoes(lista);
          setRespondeu(true);
          setAtivo(-1);
          setCarregando(false);
          if (!fechadoRef.current) setAberto(true);
        },
        (e: unknown) => {
          if (controle.signal.aborted || ultimoPedido.current !== q) return;
          setSugestoes([]);
          setRespondeu(true);
          setCarregando(false);
          setErro(descreverErro(e));
          if (!fechadoRef.current) setAberto(true);
        },
      );
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(temporizador);
      controle.abort();
    };
  }, [termo, buscar]);

  function selecionar(s: Sugestao) {
    selecionado.current = rotuloDe(s);
    setTermo(rotuloDe(s));
    setSugestoes([]);
    setRespondeu(false);
    setAberto(false);
    setAtivo(-1);
    aoSelecionar(s);
  }

  function fechar() {
    fechadoRef.current = true;
    setAberto(false);
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      fechar();
      return;
    }
    const seta = e.key === 'ArrowDown' || e.key === 'ArrowUp';
    if (seta && !aberto && sugestoes.length > 0) {
      // Painel fechado por Escape/blur com sugestões guardadas: a seta só reabre.
      e.preventDefault();
      fechadoRef.current = false;
      setAberto(true);
      return;
    }
    if (!aberto || sugestoes.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAtivo((i) => (i + 1) % sugestoes.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((i) => (i <= 0 ? sugestoes.length - 1 : i - 1));
    } else if (e.key === 'Enter' && ativo >= 0) {
      e.preventDefault();
      selecionar(sugestoes[ativo]);
    }
  }

  const termoCurto = normalizarParaContar(termo).length < MINIMO;
  const mostrarLista = aberto && !termoCurto && termo.trim() !== selecionado.current;
  const semResultado = respondeu && !carregando && !erro && sugestoes.length === 0;

  return (
    <div className="autocomplete">
      <label className="autocomplete__rotulo" htmlFor={idCampo}>
        {rotulo}
      </label>
      <input
        id={idCampo}
        className="autocomplete__campo"
        type="text"
        role="combobox"
        autoComplete="off"
        placeholder={placeholder}
        value={termo}
        aria-autocomplete="list"
        aria-expanded={mostrarLista}
        aria-controls={idPainel}
        aria-activedescendant={mostrarLista && ativo >= 0 ? idOpcao(ativo) : undefined}
        onChange={(e) => {
          // Termo novo: a lista anterior deixa de valer enquanto o debounce espera.
          setTermo(e.target.value);
          setSugestoes([]);
          setRespondeu(false);
          setAtivo(-1);
          setErro(null);
          fechadoRef.current = false;
          setAberto(true);
        }}
        onFocus={() => {
          fechadoRef.current = false;
          setAberto(true);
        }}
        onBlur={fechar}
        onKeyDown={aoTeclar}
      />
      {termoCurto && termo.length > 0 && (
        <p className="autocomplete__dica">Digite pelo menos {MINIMO} caracteres.</p>
      )}
      <div id={idPainel} className="autocomplete__painel" hidden={!mostrarLista}>
        {mostrarLista && carregando && (
          <p className="autocomplete__estado" aria-live="polite">
            Buscando...
          </p>
        )}
        {mostrarLista && !carregando && erro && (
          <p className="autocomplete__estado autocomplete__estado--erro" role="alert">
            {erro}
          </p>
        )}
        {mostrarLista && semResultado && (
          <p className="autocomplete__estado" aria-live="polite">
            Nenhum município encontrado.
          </p>
        )}
        {mostrarLista && !carregando && !erro && sugestoes.length > 0 && (
          <ul className="autocomplete__lista" role="listbox">
            {sugestoes.map((s, i) => (
              <li
                key={s.cdMun}
                id={idOpcao(i)}
                role="option"
                aria-selected={i === ativo}
                className={
                  'autocomplete__opcao' + (i === ativo ? ' autocomplete__opcao--ativa' : '')
                }
                // preventDefault evita o blur do campo, então o clique ainda seleciona.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setAtivo(i)}
                onClick={() => selecionar(s)}
              >
                {rotuloDe(s)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
