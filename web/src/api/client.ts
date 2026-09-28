import type { MunicipioDetalhe, RankingPagina, Sugestao, Uf, UfAgregado } from './tipos';

/** Erro HTTP da API, com o status para a tela decidir a mensagem. */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

/**
 * Texto para a tela a partir de qualquer erro do cliente. Só o `message` de um
 * `ErroApi` (a `message` do JSON do Nest) chega ao usuário; mensagens cruas do
 * navegador ("Failed to fetch") ou de exceções inesperadas nunca são exibidas.
 * `naoEncontrado` é o texto do 404, que depende do que a tela pediu; `null`
 * quando um 404 não tem leitura especial (lista) e cai na mensagem genérica.
 */
export function descreverErro(
  e: unknown,
  naoEncontrado: string | null = 'Município não encontrado.',
): string {
  if (e instanceof ErroApi) {
    if (e.status === 404 && naoEncontrado !== null) {
      return naoEncontrado;
    }
    return `A API respondeu com erro ${e.status} (${e.message}).`;
  }
  if (e instanceof TypeError) {
    // `fetch` rejeita com TypeError quando a rede ou o servidor não respondem.
    return 'Não foi possível falar com a API. Verifique a conexão e tente de novo.';
  }
  return 'Erro inesperado ao consultar a API.';
}

/**
 * Único ponto de acesso à API. Chama só caminhos relativos em `/api/...`:
 * em dev o proxy do Vite e em produção o nginx levam até o Nest, então o
 * front nunca conhece a URL da API.
 */
async function obterJson<T>(caminho: string, signal?: AbortSignal): Promise<T> {
  const resposta = await fetch(caminho, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!resposta.ok) {
    throw new ErroApi(resposta.status, await extrairMensagem(resposta));
  }
  return (await resposta.json()) as T;
}

/** Usa a `message` do JSON de erro do Nest quando existir; senão, o status HTTP. */
async function extrairMensagem(resposta: Response): Promise<string> {
  try {
    const corpo = (await resposta.json()) as { message?: unknown };
    if (typeof corpo.message === 'string') {
      return corpo.message;
    }
  } catch {
    // Corpo vazio ou não JSON: cai na mensagem genérica.
  }
  return `Erro ${resposta.status} da API`;
}

/** Autocomplete: até 10 sugestões para o termo. */
export function buscarMunicipios(q: string, signal?: AbortSignal): Promise<Sugestao[]> {
  return obterJson<Sugestao[]>(`/api/municipios?q=${encodeURIComponent(q)}`, signal);
}

/** Agregados de um município pelo código do IBGE. */
export function obterMunicipio(cdMun: string, signal?: AbortSignal): Promise<MunicipioDetalhe> {
  return obterJson<MunicipioDetalhe>(`/api/municipios/${encodeURIComponent(cdMun)}`, signal);
}

/** As 27 UFs em ordem alfabética de nome. */
export function listarUfs(signal?: AbortSignal): Promise<Uf[]> {
  return obterJson<Uf[]>('/api/ufs', signal);
}

/** Agregados de um estado pelo código do IBGE. */
export function obterUf(cdUf: string, signal?: AbortSignal): Promise<UfAgregado> {
  return obterJson<UfAgregado>(`/api/ufs/${encodeURIComponent(cdUf)}`, signal);
}

/** Uma página do ranking de densidade dos municípios do estado. */
export function listarMunicipiosDaUf(
  cdUf: string,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<RankingPagina> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return obterJson<RankingPagina>(`/api/ufs/${encodeURIComponent(cdUf)}/municipios?${query}`, signal);
}
