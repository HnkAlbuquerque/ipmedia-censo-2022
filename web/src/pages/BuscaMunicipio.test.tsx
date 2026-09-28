import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MunicipioDetalhe, Sugestao } from '../api/tipos';
import BuscaMunicipio from './BuscaMunicipio';

const saoPaulo: Sugestao = {
  cdMun: '3550308',
  nome: 'São Paulo',
  uf: { cdUf: '35', sigla: 'SP', nome: 'São Paulo' },
};
const saoLuis: Sugestao = {
  cdMun: '2111300',
  nome: 'São Luís',
  uf: { cdUf: '21', sigla: 'MA', nome: 'Maranhão' },
};
const detalheSp: MunicipioDetalhe = {
  ...saoPaulo,
  populacao: 11451999,
  areaKm2: 1521.2,
  densidade: 7528.26,
  setores: { total: 27301, urbanos: 27037, rurais: 254, naoInformados: 10 },
  sexo: { homens: 5380188, mulheres: 6060887, comDado: 11441079, cobertura: 0.999 },
};

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** `fetch` falso roteado por URL; cada teste sobrescreve o que precisa. */
const fetchMock = vi.fn<(url: string) => Promise<Response>>();

function digitar(texto: string) {
  fireEvent.change(screen.getByRole('combobox', { name: 'Município' }), {
    target: { value: texto },
  });
}

/** Avança o debounce (300 ms) e deixa as promessas do fetch resolverem. */
async function esperarDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}

describe('BuscaMunicipio', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url) => {
      if (url.startsWith('/api/municipios?q=')) return respostaJson([saoPaulo, saoLuis]);
      if (url === '/api/municipios/3550308') return respostaJson(detalheSp);
      return respostaJson({ statusCode: 404, message: 'não encontrado' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('mostra a linha de contexto e o campo de busca', () => {
    render(<BuscaMunicipio />);

    expect(screen.getByRole('heading', { level: 2, name: 'Busca de município' })).toBeInTheDocument();
    expect(screen.getByText(/Digite parte do nome de um município/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Município' })).toHaveValue('');
  });

  it('não faz requisição com 1 letra', async () => {
    render(<BuscaMunicipio />);

    digitar('s');
    await esperarDebounce();
    await esperarDebounce();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Digite pelo menos 2 caracteres.')).toBeInTheDocument();
  });

  it('só chama a API após 300 ms sem digitar, uma vez para o termo final', async () => {
    render(<BuscaMunicipio />);

    digitar('sa');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    digitar('sao');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/municipios?q=sao');
  });

  it('digitar "sao" lista "São Paulo - SP" no topo', async () => {
    render(<BuscaMunicipio />);

    digitar('sao');
    await esperarDebounce();

    const opcoes = screen.getAllByRole('option');
    expect(opcoes[0]).toHaveTextContent('São Paulo - SP');
    expect(opcoes[1]).toHaveTextContent('São Luís - MA');
  });

  it('mostra "Buscando..." enquanto a resposta não chega', async () => {
    let resolver!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => (resolver = r)));
    render(<BuscaMunicipio />);

    digitar('sao');
    await esperarDebounce();
    expect(screen.getByText('Buscando...')).toBeInTheDocument();

    await act(async () => {
      resolver(respostaJson([saoPaulo]));
    });
    expect(screen.queryByText('Buscando...')).not.toBeInTheDocument();
    expect(screen.getByRole('option')).toHaveTextContent('São Paulo - SP');
  });

  it('mostra "Nenhum município encontrado." para lista vazia', async () => {
    fetchMock.mockImplementation(async () => respostaJson([]));
    render(<BuscaMunicipio />);

    digitar('xyzxyz');
    await esperarDebounce();

    expect(screen.getByText('Nenhum município encontrado.')).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('erro de rede na busca mostra mensagem', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    render(<BuscaMunicipio />);

    digitar('sao');
    await esperarDebounce();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível falar com a API. Verifique a conexão e tente de novo.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('Failed to fetch');
  });

  it('erro HTTP na busca mostra o status e a mensagem da API', async () => {
    fetchMock.mockImplementation(async () =>
      respostaJson({ statusCode: 500, message: 'Internal server error' }, 500),
    );
    render(<BuscaMunicipio />);

    digitar('sao');
    await esperarDebounce();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'A API respondeu com erro 500 (Internal server error).',
    );
  });

  it('selecionar "São Paulo - SP" com clique mostra os cartões formatados em pt-BR', async () => {
    render(<BuscaMunicipio />);

    digitar('sao');
    await esperarDebounce();
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'São Paulo - SP' }));
    });

    expect(fetchMock).toHaveBeenLastCalledWith('/api/municipios/3550308', expect.anything());
    expect(screen.getByRole('combobox', { name: 'Município' })).toHaveValue('São Paulo - SP');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    const cartoes = screen.getByRole('region', { name: 'Dados de São Paulo - SP' });
    expect(cartoes).toHaveTextContent('11.451.999');
    expect(cartoes).toHaveTextContent('27.301');
    expect(cartoes).toHaveTextContent('27.037');
    expect(cartoes).toHaveTextContent('254');
    expect(cartoes).toHaveTextContent('10');
    expect(cartoes).toHaveTextContent('1.521,20 km²');
    expect(cartoes).toHaveTextContent('7.528,26 hab/km²');
    expect(cartoes).toHaveTextContent('5.380.188');
    expect(cartoes).toHaveTextContent('6.060.887');
    expect(cartoes).toHaveTextContent('Dado por sexo disponível para 99,9% da população');
    // Percentuais das barras: setores 27.037/254/10 de 27.301; sexo sobre os 11.441.079 com dado.
    expect(cartoes).toHaveTextContent('27.037 (99,0%)');
    expect(cartoes).toHaveTextContent('254 (0,9%)');
    expect(cartoes).toHaveTextContent('10 (0,0%)');
    expect(cartoes).toHaveTextContent('5.380.188 (47,0%)');
    expect(cartoes).toHaveTextContent('6.060.887 (53,0%)');

    // O campo recebeu "São Paulo - SP": não deve disparar uma nova busca.
    await esperarDebounce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('seleciona com as setas e Enter', async () => {
    render(<BuscaMunicipio />);
    const campo = screen.getByRole('combobox', { name: 'Município' });

    digitar('sao');
    await esperarDebounce();
    fireEvent.keyDown(campo, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'São Paulo - SP' })).toHaveAttribute('aria-selected', 'true');
    // ArrowUp na primeira dá a volta para a última.
    fireEvent.keyDown(campo, { key: 'ArrowUp' });
    expect(screen.getByRole('option', { name: 'São Luís - MA' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(campo, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.keyDown(campo, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'São Luís - MA' })).toHaveAttribute('aria-selected', 'true');

    fetchMock.mockImplementation(async (url) =>
      url === '/api/municipios/2111300'
        ? respostaJson({ ...detalheSp, ...saoLuis, populacao: 1037775 })
        : respostaJson([], 500),
    );
    await act(async () => {
      fireEvent.keyDown(campo, { key: 'Enter' });
    });

    expect(campo).toHaveValue('São Luís - MA');
    expect(screen.getByRole('region', { name: 'Dados de São Luís - MA' })).toHaveTextContent('1.037.775');
  });

  it('mostra carregando e depois erro quando o detalhe falha', async () => {
    let rejeitar!: (e: Error) => void;
    fetchMock.mockImplementation((url) =>
      url.startsWith('/api/municipios?q=')
        ? Promise.resolve(respostaJson([saoPaulo]))
        : new Promise<Response>((_, r) => (rejeitar = r)),
    );
    render(<BuscaMunicipio />);

    digitar('sao');
    await esperarDebounce();
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'São Paulo - SP' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Carregando dados de São Paulo - SP');

    await act(async () => {
      rejeitar(new TypeError('Failed to fetch'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os dados de São Paulo - SP');
  });

  it('descarta resposta atrasada de um termo anterior', async () => {
    const pendentes = new Map<string, (r: Response) => void>();
    fetchMock.mockImplementation(
      (url) => new Promise<Response>((r) => pendentes.set(url, r)),
    );
    render(<BuscaMunicipio />);

    digitar('sao');
    await esperarDebounce();
    digitar('sao l');
    await esperarDebounce();

    // A resposta de "sao l" chega primeiro; a de "sao", atrasada, deve ser ignorada.
    await act(async () => {
      pendentes.get('/api/municipios?q=sao%20l')!(respostaJson([saoLuis]));
    });
    await act(async () => {
      pendentes.get('/api/municipios?q=sao')?.(respostaJson([saoPaulo, saoLuis]));
    });

    const opcoes = screen.getAllByRole('option');
    expect(opcoes).toHaveLength(1);
    expect(opcoes[0]).toHaveTextContent('São Luís - MA');
  });

  it('esconde a lista anterior enquanto o novo termo espera o debounce', async () => {
    render(<BuscaMunicipio />);

    digitar('sao');
    await esperarDebounce();
    expect(screen.getAllByRole('option')).toHaveLength(2);

    digitar('sao l');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhum município encontrado.')).not.toBeInTheDocument();
  });

  it('resposta que chega depois de Escape não reabre a lista', async () => {
    let resolver!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => (resolver = r)));
    render(<BuscaMunicipio />);
    const campo = screen.getByRole('combobox', { name: 'Município' });

    digitar('sao');
    await esperarDebounce();
    fireEvent.keyDown(campo, { key: 'Escape' });
    await act(async () => {
      resolver(respostaJson([saoPaulo]));
    });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.keyDown(campo, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'São Paulo - SP' })).toBeInTheDocument();
  });

  it('perder o foco fecha a lista', async () => {
    render(<BuscaMunicipio />);
    const campo = screen.getByRole('combobox', { name: 'Município' });

    digitar('sao');
    await esperarDebounce();
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.blur(campo);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('detalhe com 404 mostra "Município não encontrado." sem a mensagem crua', async () => {
    fetchMock.mockImplementation(async (url) =>
      url.startsWith('/api/municipios?q=')
        ? respostaJson([saoPaulo])
        : respostaJson({ statusCode: 404, message: 'Município 3550308 não encontrado' }, 404),
    );
    render(<BuscaMunicipio />);

    digitar('sao');
    await esperarDebounce();
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'São Paulo - SP' }));
    });

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent(
      'Não foi possível carregar os dados de São Paulo - SP. Município não encontrado.',
    );
    expect(alerta).not.toHaveTextContent('3550308');
  });

  it('trocar a seleção com o detalhe pendente mostra só a última', async () => {
    const pendentes = new Map<string, (r: Response) => void>();
    fetchMock.mockImplementation(
      (url: string, init?: RequestInit) =>
        new Promise<Response>((resolver, rejeitar) => {
          pendentes.set(url, resolver);
          init?.signal?.addEventListener('abort', () =>
            rejeitar(new DOMException('Requisição abortada', 'AbortError')),
          );
        }),
    );
    render(<BuscaMunicipio />);

    digitar('sao');
    await esperarDebounce();
    await act(async () => {
      pendentes.get('/api/municipios?q=sao')!(respostaJson([saoPaulo, saoLuis]));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'São Paulo - SP' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('São Paulo - SP');

    digitar('sao');
    await esperarDebounce();
    await act(async () => {
      pendentes.get('/api/municipios?q=sao')!(respostaJson([saoPaulo, saoLuis]));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'São Luís - MA' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('São Luís - MA');

    // São Luís responde primeiro; São Paulo, atrasado, não pode sobrescrever.
    await act(async () => {
      pendentes.get('/api/municipios/2111300')!(
        respostaJson({ ...detalheSp, ...saoLuis, populacao: 1037775 }),
      );
    });
    await act(async () => {
      pendentes.get('/api/municipios/3550308')!(respostaJson(detalheSp));
    });

    expect(screen.getByRole('region', { name: 'Dados de São Luís - MA' })).toHaveTextContent('1.037.775');
    expect(screen.queryByRole('region', { name: 'Dados de São Paulo - SP' })).not.toBeInTheDocument();
  });
});
