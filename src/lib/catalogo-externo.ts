/**
 * El catálogo de free-exercise-db cargado en memoria, del lado del servidor.
 *
 * **Este módulo no puede acabar en el navegador.** El JSON son 139 KB y no le
 * sirve de nada al cliente: quien busca es una server action y lo que viaja de
 * vuelta son los pocos resultados. Importarlo desde un componente `"use client"`
 * metería el catálogo entero en el bundle sin dar ningún error.
 *
 * El cómo se busca no está aquí sino en `catalogo-glosario.ts`, que también usa
 * `scripts/generar-enlaces-fedb.mjs` — ver allí por qué están separados.
 */
// Lo de arriba no es un ruego: `server-only` rompe el build si alguien importa
// esto desde un componente de cliente, que es la única forma de asegurarlo.
// Sin él, meter el catálogo en el bundle del navegador no daría ningún error.
import "server-only";

import catalogo from "../../db/fedb-catalogo.json";

import { puntuar } from "./catalogo-glosario";

export type EntradaCatalogo = {
  id: string;
  name: string;
  primarios: string[];
  secundarios: string[];
};

const ENTRADAS = catalogo as EntradaCatalogo[];
const POR_ID = new Map(ENTRADAS.map((e) => [e.id, e]));

/** Busca en el catálogo. Acepta español o inglés (pasa por el glosario). */
export function buscarEnCatalogo(termino: string, limite = 8): EntradaCatalogo[] {
  return puntuar(ENTRADAS, termino, limite);
}

/** La entrada, para copiar nombre y músculos al enlazar. */
export function entradaDeCatalogo(fedbId: string): EntradaCatalogo | null {
  return POR_ID.get(fedbId) ?? null;
}
