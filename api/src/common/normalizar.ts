/**
 * Normaliza texto para busca: decompõe em NFD, remove diacríticos, passa para
 * minúsculas, colapsa espaços repetidos e apara as pontas. Hífens e apóstrofos
 * são preservados ("Mogi-Guaçu" -> "mogi-guacu").
 *
 * É a única implementação da normalização: o bootstrap a usa para preencher
 * `municipio.nm_mun_busca` e a busca a usa para tratar o `q` do usuário.
 * Se as duas divergissem, o autocomplete deixaria de encontrar nomes com acento.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    // \p{M}: marcas combinantes que o NFD separou das letras (acentos, til, cedilha).
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
