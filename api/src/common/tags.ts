/**
 * Nomes dos grupos da documentação (`/api/docs`). Ficam em um lugar só
 * porque o `addTag` (descrição do grupo) e o `@ApiTags` (rotas do grupo) se
 * ligam pelo texto: um nome digitado diferente manteria o grupo e perderia
 * a descrição, sem erro nenhum.
 */
export const TAG_MUNICIPIOS = 'Municípios';
export const TAG_UFS = 'UFs';
export const TAG_HEALTH = 'Healthcheck';
