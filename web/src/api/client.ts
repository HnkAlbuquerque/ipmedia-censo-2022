import type { MunicipioDetalhe, Sugestao } from './tipos';

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
 */
export function descreverErro(e: unknown): string {
  if (e instanceof ErroApi) {
    if (e.status === 404) {
      return 'Município não encontrado.';
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
