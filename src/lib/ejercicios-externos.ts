/**
 * Catálogos externos: de dónde salen las fotos y los diagramas.
 *
 * Este es el único sitio que sabe en qué servidor viven las imágenes. Las
 * pantallas piden URLs y no preguntan de dónde vienen, así que mudar las fotos
 * a Supabase Storage es cambiar `BASE_FOTOS` y nada más.
 *
 * Dos fuentes, porque ninguna sirve sola:
 *
 *   · **free-exercise-db** (dominio público) pone las fotos: 873 ejercicios con
 *     dos cada uno, inicio y final del movimiento. No dibuja músculos.
 *   · **wger** (CC-BY-SA 3.0) pone los SVG de músculos. Le faltan fotos en más
 *     de la mitad del catálogo, por eso no se usa para eso.
 *
 * El puente entre las dos no es una búsqueda de texto: free-exercise-db etiqueta
 * cada ejercicio con un léxico cerrado de 17 músculos, y esa tabla de 17
 * entradas los lleva a los SVG de wger. El único matcheo difuso del sistema —
 * nuestros nombres en español contra los suyos en inglés — está resuelto a mano
 * en `db/enlaces-fedb.tsv` y horneado en la base, no se hace en caliente.
 */

/**
 * Las fotos van hotlinkeadas al CDN mientras no estén en Storage. Ojo con lo
 * que implica: el service worker ignora lo que no es del propio origen
 * (`public/sw.js`), así que **estas fotos no se cachean y en el gimnasio sin
 * cobertura no cargan**. Los componentes caen al placeholder cuando falla.
 * Los SVG de músculos no tienen ese problema porque están en `public/`.
 */
const BASE_FOTOS = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises";

/** Los SVG de wger, copiados a `public/` para que el service worker los cachee. */
const BASE_MUSCULOS = "/musculos";

/**
 * Las dos fotos de un ejercicio: posición inicial y final. Las rutas de
 * free-exercise-db son siempre `{id}/0.jpg` y `{id}/1.jpg` — comprobado sobre
 * las 873 entradas del catálogo, sin excepciones — así que se arman en vez de
 * guardarse.
 */
export function fotosEjercicio(fedbId: string | null): [string, string] | null {
  if (!fedbId) return null;
  return [`${BASE_FOTOS}/${fedbId}/0.jpg`, `${BASE_FOTOS}/${fedbId}/1.jpg`];
}

/** Silueta de fondo del diagrama. */
export function siluetaUrl(cara: "frente" | "espalda"): string {
  return `${BASE_MUSCULOS}/cuerpo-${cara}.svg`;
}

/**
 * Capa de un músculo. Se usa como **máscara** CSS, no como imagen: el SVG de
 * wger trae su propio rojo y el nuestro tiene que ser `--color-accent`. Con
 * `mask-image` la forma la pone el archivo y el color lo pone el token, así que
 * el asset se queda intacto (que además es lo cómodo con una licencia
 * share-alike).
 */
export function capaUrl(wgerId: number, principal: boolean): string {
  return `${BASE_MUSCULOS}/musculo-${wgerId}-${principal ? "principal" : "secundario"}.svg`;
}

/**
 * El léxico de 17 músculos de free-exercise-db, traducido a dos cosas: cómo se
 * dice en español y qué SVG de wger le corresponde.
 *
 * **Cinco no tienen dibujo** (`wger: null`): wger solo publica 15 músculos y
 * entre ellos no están abductores, aductores, antebrazos, lumbares ni cuello.
 * Esos siguen apareciendo por su nombre en la lista de texto —que es lo que
 * más se lee— y solo se caen del dibujo. Por eso el mapa guarda el nombre
 * aunque no haya SVG: media respuesta es mejor que ninguna.
 *
 * `frente` decide en cuál de las dos siluetas se pinta la capa.
 */
const MUSCULOS: Record<string, { es: string; wger: number | null; frente: boolean }> = {
  abdominals: { es: "Abdominales", wger: 6, frente: true },
  abductors: { es: "Abductores", wger: null, frente: true },
  adductors: { es: "Aductores", wger: null, frente: true },
  biceps: { es: "Bíceps", wger: 1, frente: true },
  calves: { es: "Gemelos", wger: 7, frente: false },
  chest: { es: "Pecho", wger: 4, frente: true },
  forearms: { es: "Antebrazos", wger: null, frente: true },
  glutes: { es: "Glúteos", wger: 8, frente: false },
  hamstrings: { es: "Isquiotibiales", wger: 11, frente: false },
  lats: { es: "Dorsales", wger: 12, frente: false },
  "lower back": { es: "Lumbares", wger: null, frente: false },
  // El trapecio es lo que wger dibuja para toda la espalda alta y media, así
  // que 'middle back' y 'traps' comparten capa. Se deduplica más abajo.
  "middle back": { es: "Espalda media", wger: 9, frente: false },
  neck: { es: "Cuello", wger: null, frente: false },
  quadriceps: { es: "Cuádriceps", wger: 10, frente: true },
  shoulders: { es: "Hombros", wger: 2, frente: true },
  traps: { es: "Trapecios", wger: 9, frente: false },
  triceps: { es: "Tríceps", wger: 5, frente: false },
};

export type Capa = { wgerId: number; principal: boolean };

export type Musculos = {
  /** Nombres en español, primarios primero. Para leer, no para dibujar. */
  primarios: string[];
  secundarios: string[];
  /** Capas a apilar sobre cada silueta. Vacío ⇒ esa silueta no se pinta. */
  frente: Capa[];
  espalda: Capa[];
  /** Si no hay ninguna capa no hay diagrama que enseñar. */
  hayDiagrama: boolean;
};

/**
 * Traduce las etiquetas de free-exercise-db a lo que necesita el diagrama.
 *
 * Un músculo primario tapa al mismo músculo secundario —pasa cuando dos
 * etiquetas caen en el mismo SVG, como 'traps' y 'middle back'— porque pintar
 * la capa tenue encima de la fuerte lo dejaría a medio color.
 */
export function resolverMusculos(
  primarios: string[] | null,
  secundarios: string[] | null,
): Musculos {
  const nombres = (claves: string[] | null) =>
    (claves ?? []).map((c) => MUSCULOS[c]?.es).filter((n): n is string => Boolean(n));

  const capas = new Map<number, Capa>();
  const anotar = (claves: string[] | null, principal: boolean) => {
    for (const clave of claves ?? []) {
      const m = MUSCULOS[clave];
      if (!m?.wger) continue;
      // El primario manda: si ya está puesto, un secundario no lo rebaja.
      const previo = capas.get(m.wger);
      if (previo?.principal) continue;
      capas.set(m.wger, { wgerId: m.wger, principal });
    }
  };
  anotar(primarios, true);
  anotar(secundarios, false);

  const enCara = (frente: boolean) =>
    [...capas.values()].filter((c) => caraDe(c.wgerId) === frente);

  const frente = enCara(true);
  const espalda = enCara(false);

  return {
    primarios: nombres(primarios),
    secundarios: nombres(secundarios),
    frente,
    espalda,
    hayDiagrama: frente.length > 0 || espalda.length > 0,
  };
}

/** En qué silueta vive un id de wger. */
function caraDe(wgerId: number): boolean {
  for (const m of Object.values(MUSCULOS)) if (m.wger === wgerId) return m.frente;
  return true;
}
