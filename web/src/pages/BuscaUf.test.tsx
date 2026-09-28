import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RankingItem, RankingPagina, Uf, UfAgregado } from '../api/tipos';
import BuscaUf from './BuscaUf';

/** As 27 UFs em ordem alfabética, como a API devolve. */
const ufs: Uf[] = [
  ['12', 'AC', 'Acre'], ['27', 'AL', 'Alagoas'], ['16', 'AP', 'Amapá'], ['13', 'AM', 'Amazonas'],
  ['29', 'BA', 'Bahia'], ['23', 'CE', 'Ceará'], ['53', 'DF', 'Distrito Federal'],
  ['32', 'ES', 'Espírito Santo'], ['52', 'GO', 'Goiás'], ['21', 'MA', 'Maranhão'],
  ['51', 'MT', 'Mato Grosso'], ['50', 'MS', 'Mato Grosso do Sul'], ['31', 'MG', 'Minas Gerais'],
  ['15', 'PA', 'Pará'], ['25', 'PB', 'Paraíba'], ['41', 'PR', 'Paraná'], ['26', 'PE', 'Pernambuco'],
  ['22', 'PI', 'Piauí'], ['33', 'RJ', 'Rio de Janeiro'], ['24', 'RN', 'Rio Grande do Norte'],
  ['43', 'RS', 'Rio Grande do Sul'], ['11', 'RO', 'Rondônia'], ['14', 'RR', 'Roraima'],
  ['42', 'SC', 'Santa Catarina'], ['35', 'SP', 'São Paulo'], ['28', 'SE', 'Sergipe'],
  ['17', 'TO', 'Tocantins'],
].map(([cdUf, sigla, nome]) => ({ cdUf, sigla, nome }));

const agregadoSp: UfAgregado = {
  cdUf: '35', sigla: 'SP', nome: 'São Paulo',
  populacao: 44411238, areaKm2: 248219.49, densidade: 178.92, totalMunicipios: 645,
};
const agregadoDf: UfAgregado = {
  cdUf: '53', sigla: 'DF', nome: 'Distrito Federal',
  populacao: 2817381, areaKm2: 5760.78, densidade: 489.06, totalMunicipios: 1,
};
const agregadoRr: UfAgregado = {
  cdUf: '14', sigla: 'RR', nome: 'Roraima',
  populacao: 636707, areaKm2: 223644.31, densidade: 2.85, totalMunicipios: 15,
};

/** Página de ranking sintética: `posicao` contínua, densidade decrescente. */
function pagina(cdUf: string, total: number, page: number, pageSize = 50): RankingPagina {
  const inicio = (page - 1) * pageSize;
  const quantidade = Math.max(0, Math.min(pageSize, total - inicio));
  const itens: RankingItem[] = Array.from({ length: quantidade }, (_, i) => {
    const posicao = inicio + i + 1;
    return {
      posicao,
      cdMun: `${cdUf}${String(posicao).padStart(5, '0')}`,
      nome: posicao === 1 && cdUf === '35' ? 'Taboão da Serra' : `Município ${posicao}`,
      populacao: 1000000 - (posicao - 1) * 1000,
      areaKm2: 20.39 + (posicao - 1),
      densidade: 13416.96 - (posicao - 1) * 10,
    };
  });
  return { total, page, pageSize, itens };
}

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** `fetch` falso roteado por URL; cada teste sobrescreve o que precisa. */
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

/** Roteamento padrão: lista, agregados e ranking de SP (645) e RR (15). */
async function rotearPadrao(url: string): Promise<Response> {
  if (url === '/api/ufs') return respostaJson(ufs);
  if (url === '/api/ufs/35') return respostaJson(agregadoSp);
  if (url === '/api/ufs/14') return respostaJson(agregadoRr);
  if (url === '/api/ufs/53') return respostaJson(agregadoDf);
  const ranking = url.match(/^\/api\/ufs\/(\d\d)\/municipios\?page=(\d+)&pageSize=(\d+)$/);
  if (ranking) {
    const [, cdUf, page, pageSize] = ranking;
    const total = cdUf === '35' ? 645 : cdUf === '14' ? 15 : cdUf === '53' ? 1 : 0;
    return respostaJson(pagina(cdUf, total, Number(page), Number(pageSize)));
  }
  return respostaJson({ statusCode: 404, message: 'não encontrada' }, 404);
}

const select = () => screen.getByRole('combobox', { name: 'Estado' });

async function escolher(cdUf: string) {
  await act(async () => {
    fireEvent.change(select(), { target: { value: cdUf } });
  });
}

/** Linhas do corpo da tabela (sem o cabeçalho). */
function linhas(): HTMLElement[] {
  const tabela = screen.getByRole('table');
  return within(tabela).getAllByRole('row').slice(1);
}

describe('BuscaUf', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(rotearPadrao);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra a linha de contexto e carrega as 27 UFs no select', async () => {
    render(<BuscaUf />);

    expect(screen.getByRole('heading', { level: 2, name: 'Busca por estado' })).toBeInTheDocument();
    expect(screen.getByText(/Escolha um estado/)).toBeInTheDocument();
    expect(select()).toBeDisabled();

    expect(await screen.findByRole('option', { name: 'São Paulo (SP)' })).toBeInTheDocument();
    expect(select()).toBeEnabled();
    expect(select()).toHaveValue('');
    // 27 UFs mais a opção vazia.
    expect(screen.getAllByRole('option')).toHaveLength(28);
    expect(screen.getAllByRole('option')[1]).toHaveTextContent('Acre (AC)');
    expect(screen.getAllByRole('option')[27]).toHaveTextContent('Tocantins (TO)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/ufs');
  });

  it('escolher São Paulo mostra o agregado, 50 linhas e "página 1 de 13" em pt-BR', async () => {
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'São Paulo (SP)' });

    await escolher('35');

    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toContain('/api/ufs/35');
    expect(urls).toContain('/api/ufs/35/municipios?page=1&pageSize=50');

    const cartoes = await screen.findByRole('region', { name: 'Dados de São Paulo (SP)' });
    expect(cartoes).toHaveTextContent('44.411.238');
    expect(cartoes).toHaveTextContent('248.219,49 km²');
    expect(cartoes).toHaveTextContent('178,92 hab/km²');
    expect(cartoes).toHaveTextContent('645');
    expect(cartoes).toHaveTextContent('municípios');

    await screen.findByRole('table');
    expect(linhas()).toHaveLength(50);
    expect(linhas()[0]).toHaveTextContent('Taboão da Serra');
    expect(within(linhas()[0]).getAllByRole('cell')[0]).toHaveTextContent('1');
    expect(linhas()[0]).toHaveTextContent('13.416,96');
    expect(linhas()[0]).toHaveTextContent('1.000.000');
    expect(linhas()[0]).toHaveTextContent('20,39');

    expect(screen.getByText(/página 1 de 13/i)).toBeInTheDocument();
    expect(screen.getByText('645 municípios')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeEnabled();
    expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument();
    // "Página X de Y" é anunciado ao mudar.
    expect(screen.getByRole('status')).toHaveTextContent('Página 1 de 13');
  });

  it('"Próxima" pede a página 2 e a primeira linha fica com posição 51', async () => {
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'São Paulo (SP)' });
    await escolher('35');
    await screen.findByRole('table');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/ufs/35/municipios?page=2&pageSize=50',
      expect.anything(),
    );
    await screen.findByText(/página 2 de 13/i);
    expect(within(linhas()[0]).getAllByRole('cell')[0]).toHaveTextContent('51');
    expect(linhas()).toHaveLength(50);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
    // O agregado não é pedido de novo ao trocar de página.
    expect(fetchMock.mock.calls.filter((c) => c[0] === '/api/ufs/35')).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    });
    await screen.findByText(/página 1 de 13/i);
    expect(within(linhas()[0]).getAllByRole('cell')[0]).toHaveTextContent('1');
  });

  it('trocar para Roraima volta à página 1, mostra 15 linhas e desabilita os botões', async () => {
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'Roraima (RR)' });
    await escolher('35');
    await screen.findByRole('table');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    });
    await screen.findByText(/página 2 de 13/i);

    await escolher('14');

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/ufs/14/municipios?page=1&pageSize=50',
      expect.anything(),
    );
    await screen.findByRole('region', { name: 'Dados de Roraima (RR)' });
    await screen.findByText(/página 1 de 1/i);
    expect(linhas()).toHaveLength(15);
    expect(within(linhas()[14]).getAllByRole('cell')[0]).toHaveTextContent('15');
    expect(screen.getByText('15 municípios')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
    expect(screen.queryByRole('region', { name: 'Dados de São Paulo (SP)' })).not.toBeInTheDocument();
  });

  it('voltar para a opção vazia limpa agregado e tabela', async () => {
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'São Paulo (SP)' });
    await escolher('35');
    await screen.findByRole('table');

    await escolher('');

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('mostra carregando enquanto agregado e ranking não chegam', async () => {
    const pendentes = new Map<string, (r: Response) => void>();
    fetchMock.mockImplementation((url) =>
      url === '/api/ufs'
        ? Promise.resolve(respostaJson(ufs))
        : new Promise<Response>((r) => pendentes.set(url, r)),
    );
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'São Paulo (SP)' });

    await escolher('35');

    const status = screen.getAllByRole('status');
    expect(status[0]).toHaveTextContent('Carregando dados de São Paulo (SP)...');
    expect(status[1]).toHaveTextContent('Carregando municípios de São Paulo (SP)...');

    await act(async () => {
      pendentes.get('/api/ufs/35')!(respostaJson(agregadoSp));
      pendentes.get('/api/ufs/35/municipios?page=1&pageSize=50')!(respostaJson(pagina('35', 645, 1)));
    });
    expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('erro de rede na lista de UFs mostra alerta sem a mensagem crua', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    render(<BuscaUf />);

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(
      'Não foi possível carregar a lista de estados. Não foi possível falar com a API. Verifique a conexão e tente de novo.',
    );
    expect(alerta).not.toHaveTextContent('Failed to fetch');
    expect(select()).toBeDisabled();
  });

  it('erro de rede no agregado e no ranking mostra um alerta para cada', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url === '/api/ufs') return respostaJson(ufs);
      throw new TypeError('Failed to fetch');
    });
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'São Paulo (SP)' });

    await escolher('35');

    const alertas = await screen.findAllByRole('alert');
    expect(alertas).toHaveLength(2);
    expect(alertas[0]).toHaveTextContent('Não foi possível carregar os dados de São Paulo (SP).');
    expect(alertas[0]).toHaveTextContent('Não foi possível falar com a API.');
    expect(alertas[1]).toHaveTextContent('Não foi possível carregar os municípios de São Paulo (SP).');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('erro HTTP mostra o status e a mensagem da API', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url === '/api/ufs') return respostaJson(ufs);
      if (url === '/api/ufs/35') return respostaJson(agregadoSp);
      return respostaJson({ statusCode: 500, message: 'Internal server error' }, 500);
    });
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'São Paulo (SP)' });

    await escolher('35');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(
      'Não foi possível carregar os municípios de São Paulo (SP). A API respondeu com erro 500 (Internal server error).',
    );
    // O agregado, que respondeu bem, continua na tela.
    expect(screen.getByRole('region', { name: 'Dados de São Paulo (SP)' })).toBeInTheDocument();
  });

  it('404 mostra "Estado não encontrado." sem a mensagem crua', async () => {
    fetchMock.mockImplementation(async (url) =>
      url === '/api/ufs'
        ? respostaJson(ufs)
        : respostaJson({ statusCode: 404, message: 'UF 35 não encontrada' }, 404),
    );
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'São Paulo (SP)' });

    await escolher('35');

    const alertas = await screen.findAllByRole('alert');
    expect(alertas[0]).toHaveTextContent('Estado não encontrado.');
    expect(alertas[0]).not.toHaveTextContent('UF 35');
  });

  it('ranking vazio mostra o estado vazio em vez da tabela', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url.includes('/municipios?')) return respostaJson(pagina('35', 0, 1));
      return rotearPadrao(url);
    });
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'São Paulo (SP)' });

    await escolher('35');

    expect(await screen.findByText('Nenhum município encontrado para São Paulo (SP).')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Próxima' })).not.toBeInTheDocument();
  });

  it('descarta a resposta atrasada da UF anterior', async () => {
    const pendentes = new Map<string, (r: Response) => void>();
    fetchMock.mockImplementation((url, init) =>
      url === '/api/ufs'
        ? Promise.resolve(respostaJson(ufs))
        : new Promise<Response>((resolver, rejeitar) => {
            pendentes.set(url, resolver);
            init?.signal?.addEventListener('abort', () =>
              rejeitar(new DOMException('Requisição abortada', 'AbortError')),
            );
          }),
    );
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'São Paulo (SP)' });

    await escolher('35');
    await escolher('14');

    // Roraima responde primeiro; São Paulo, atrasado, não pode sobrescrever.
    await act(async () => {
      pendentes.get('/api/ufs/14')!(respostaJson(agregadoRr));
      pendentes.get('/api/ufs/14/municipios?page=1&pageSize=50')!(respostaJson(pagina('14', 15, 1)));
    });
    await act(async () => {
      pendentes.get('/api/ufs/35')!(respostaJson(agregadoSp));
      pendentes.get('/api/ufs/35/municipios?page=1&pageSize=50')!(respostaJson(pagina('35', 645, 1)));
    });

    expect(screen.getByRole('region', { name: 'Dados de Roraima (RR)' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Dados de São Paulo (SP)' })).not.toBeInTheDocument();
    expect(linhas()).toHaveLength(15);
    expect(screen.getByText(/página 1 de 1/i)).toBeInTheDocument();
  });
  it('ao paginar, a tabela e os botões continuam montados (ocupados) até a próxima página chegar', async () => {
    const pendentes = new Map<string, (r: Response) => void>();
    fetchMock.mockImplementation((url) => {
      if (url === '/api/ufs') return Promise.resolve(respostaJson(ufs));
      if (url === '/api/ufs/35') return Promise.resolve(respostaJson(agregadoSp));
      return new Promise<Response>((r) => pendentes.set(url, r));
    });
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'São Paulo (SP)' });
    await escolher('35');
    await act(async () => {
      pendentes.get('/api/ufs/35/municipios?page=1&pageSize=50')!(respostaJson(pagina('35', 645, 1)));
    });
    const proxima = screen.getByRole('button', { name: 'Próxima' });
    proxima.focus();

    await act(async () => {
      fireEvent.click(proxima);
    });

    // Carregando a página 2: tabela da 1 ainda na tela, botões desabilitados, foco preservado.
    expect(screen.getByRole('button', { name: 'Próxima' })).toBe(proxima);
    expect(proxima).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(document.activeElement).toBe(proxima);
    expect(screen.getByRole('region', { name: 'Ranking de densidade de São Paulo (SP)' })).toHaveAttribute('aria-busy', 'true');
    expect(linhas()).toHaveLength(50);
    expect(within(linhas()[0]).getAllByRole('cell')[0]).toHaveTextContent('1');
    expect(screen.getByText('Carregando municípios de São Paulo (SP)...')).toBeInTheDocument();

    await act(async () => {
      pendentes.get('/api/ufs/35/municipios?page=2&pageSize=50')!(respostaJson(pagina('35', 645, 2)));
    });
    expect(screen.getByRole('region', { name: 'Ranking de densidade de São Paulo (SP)' })).toHaveAttribute('aria-busy', 'false');
    expect(proxima).toBeEnabled();
    expect(within(linhas()[0]).getAllByRole('cell')[0]).toHaveTextContent('51');
    expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument();
  });

  it('trocar de UF não deixa a tabela da anterior na tela enquanto a nova carrega', async () => {
    const pendentes = new Map<string, (r: Response) => void>();
    fetchMock.mockImplementation((url) =>
      url === '/api/ufs'
        ? Promise.resolve(respostaJson(ufs))
        : new Promise<Response>((r) => pendentes.set(url, r)),
    );
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'São Paulo (SP)' });
    await escolher('35');
    await act(async () => {
      pendentes.get('/api/ufs/35/municipios?page=1&pageSize=50')!(respostaJson(pagina('35', 645, 1)));
    });
    expect(screen.getByRole('table')).toBeInTheDocument();

    await escolher('14');

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Carregando municípios de Roraima (RR)...')).toBeInTheDocument();
  });

  it('descarta a resposta atrasada da UF anterior mesmo quando o fetch ignora o abort', async () => {
    const pendentes = new Map<string, (r: Response) => void>();
    // Este mock não escuta o signal: a promessa da UF anterior resolve com sucesso,
    // e só a guarda `signal.aborted` no caminho de sucesso impede a sobrescrita.
    fetchMock.mockImplementation((url) =>
      url === '/api/ufs'
        ? Promise.resolve(respostaJson(ufs))
        : new Promise<Response>((r) => pendentes.set(url, r)),
    );
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'São Paulo (SP)' });

    await escolher('35');
    await escolher('14');

    await act(async () => {
      pendentes.get('/api/ufs/14')!(respostaJson(agregadoRr));
      pendentes.get('/api/ufs/14/municipios?page=1&pageSize=50')!(respostaJson(pagina('14', 15, 1)));
    });
    await act(async () => {
      pendentes.get('/api/ufs/35')!(respostaJson(agregadoSp));
      pendentes.get('/api/ufs/35/municipios?page=1&pageSize=50')!(respostaJson(pagina('35', 645, 1)));
    });

    expect(screen.getByRole('region', { name: 'Dados de Roraima (RR)' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Dados de São Paulo (SP)' })).not.toBeInTheDocument();
    expect(linhas()).toHaveLength(15);
    expect(screen.getByText('15 municípios')).toBeInTheDocument();
  });

  it('Distrito Federal usa o singular: "1 município" nos cartões e no rodapé', async () => {
    render(<BuscaUf />);
    await screen.findByRole('option', { name: 'Distrito Federal (DF)' });

    await escolher('53');

    const cartoes = await screen.findByRole('region', { name: 'Dados de Distrito Federal (DF)' });
    // Valor e unidade ficam em elementos separados no cartão.
    expect(within(cartoes).getByText('município')).toBeInTheDocument();
    expect(within(cartoes).queryByText('municípios')).not.toBeInTheDocument();
    await screen.findByRole('table');
    expect(linhas()).toHaveLength(1);
    expect(screen.getByText('1 município', { selector: '.paginacao__total' })).toBeInTheDocument();
    expect(screen.getByText(/página 1 de 1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  });

  it('404 na lista de UFs cai na mensagem genérica, não em "Estado não encontrado."', async () => {
    fetchMock.mockImplementation(async () =>
      respostaJson({ statusCode: 404, message: 'Cannot GET /api/ufs' }, 404),
    );
    render(<BuscaUf />);

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('A API respondeu com erro 404 (Cannot GET /api/ufs).');
    expect(alerta).not.toHaveTextContent('Estado não encontrado.');
  });
});
