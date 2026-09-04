/**
 * Cómo se busca en el catálogo de free-exercise-db: el glosario de gimnasio y
 * el criterio de puntuación.
 *
 * Está separado de `catalogo-externo.ts` a propósito, y no por gusto: aquel
 * importa el JSON del catálogo y esa importación solo la entiende el bundler de
 * Next — Node, que es quien corre `scripts/generar-enlaces-fedb.mjs`, exige
 * `with { type: "json" }`. Aquí no hay datos, solo funciones, así que lo pueden
 * importar los dos sin pelearse. La entrada del catálogo se pasa por parámetro.
 *
 * Que lo compartan importa: si el script sugiriera con un criterio y el
 * buscador del formulario con otro, quien curó el TSV vería una lista y quien
 * enlaza desde la app vería otra.
 */

export type Entrada = { id: string; name: string };

/**
 * Términos de gimnasio, español → inglés. No es un traductor: solo acerca lo
 * suficiente para que el ranking ponga arriba el candidato bueno. Ampliarlo
 * mejora las búsquedas y no rompe nada.
 */
export const GLOSARIO: Record<string, string> = {
  press: "press",
  banca: "bench",
  inclinado: "incline",
  inclinadas: "incline",
  declinado: "decline",
  militar: "military",
  frances: "lying triceps",
  sentadilla: "squat",
  trasera: "back",
  frontal: "front",
  bulgara: "bulgarian split",
  prensa: "leg press",
  peso: "deadlift",
  muerto: "deadlift",
  rumano: "romanian",
  sumo: "sumo",
  dominadas: "pullups",
  remo: "row",
  jalon: "pulldown",
  curl: "curl",
  biceps: "biceps",
  triceps: "triceps",
  martillo: "hammer",
  concentrado: "concentration",
  extension: "extension",
  cuadriceps: "leg extension",
  femoral: "leg curl",
  gemelo: "calf raise",
  gemelos: "calf raise",
  zancadas: "lunge",
  elevaciones: "raise",
  elevacion: "raise",
  laterales: "lateral",
  lateral: "lateral",
  posterior: "rear",
  aperturas: "flyes",
  cruce: "crossover",
  poleas: "cable",
  fondos: "dips",
  paralelas: "parallel bars",
  encogimientos: "shrug",
  encogimiento: "crunch",
  plancha: "plank",
  rueda: "ab roller",
  abdominal: "crunch",
  abdominales: "crunch",
  crunch: "crunch",
  piernas: "leg",
  pierna: "leg",
  colgado: "hanging",
  cadera: "hip",
  abduccion: "abduction",
  aduccion: "adduction",
  muneca: "wrist",
  escalador: "mountain climber",
  pajaros: "rear delt",
  mancuernas: "dumbbell",
  mancuerna: "dumbbell",
  barra: "barbell",
  polea: "cable",
  maquina: "machine",
  lastradas: "weighted",
  lastrado: "weighted",
  lastre: "weighted",
  corporal: "bodyweight",
  banco: "bench",
  scott: "preacher",
  patada: "kickback",
  gluteos: "glute",
  gluteo: "glute",
  hombro: "shoulder",
  hombros: "shoulder",
  sentado: "seated",
  sentada: "seated",
  tumbado: "lying",
  alternativa: "alternating",
  alterna: "alternating",
  cabeza: "overhead",
  pecho: "chest",
  espalda: "back",
  dorsales: "lats",
  antebrazo: "forearm",
  trapecio: "traps",
};

/** Sin tildes, en minúsculas y partido en palabras de 3+ letras. */
export function palabras(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3);
}

/** Aplica el glosario palabra a palabra; lo que no está, se deja igual. */
export function traducir(texto: string): string[] {
  return palabras(texto).flatMap((p) => palabras(GLOSARIO[p] ?? p));
}

/**
 * Ordena las entradas por parecido al término, que puede venir en español o en
 * inglés. Se divide por la raíz del tamaño para que no ganen los nombres largos
 * por acumulación: con "squat", `Barbell Squat` tiene que ir antes que un
 * nombre de ocho palabras que casualmente lo incluya.
 */
export function puntuar<T extends Entrada>(entradas: T[], termino: string, limite = 8): T[] {
  const buscadas = traducir(termino);
  if (buscadas.length === 0) return [];

  return entradas
    .map((e) => {
      const pal = new Set(palabras(e.name));
      return { e, punto: buscadas.filter((p) => pal.has(p)).length / Math.sqrt(pal.size) };
    })
    .filter((x) => x.punto > 0)
    .sort((a, b) => b.punto - a.punto || a.e.name.length - b.e.name.length)
    .slice(0, limite)
    .map((x) => x.e);
}
