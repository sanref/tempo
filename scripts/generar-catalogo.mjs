/**
 * ── Catálogo de ejercicios desde free-exercise-db ──────────────────────────
 *
 *   node scripts/generar-catalogo.mjs             emite el INSERT del seed por stdout
 *   node scripts/generar-catalogo.mjs --escribir  lo mete en los dos SQL
 *
 * A diferencia de `scripts/generar-enlaces-fedb.mjs` (que sigue vivo solo
 * como referencia, para los 65 UPDATE de `db/08_ejercicios_externos.sql`),
 * aquí no hay nada que curar a mano: el catálogo entero —nombre incluido—
 * sale de free-exercise-db, así que el mapeo es determinista. Ver
 * `docs/plan-catalogo-free-exercise-db.md` para el porqué de cada decisión.
 *
 * Dos destinos, con dos bloques distintos generados de la misma selección:
 *
 *   · `db/99_seed.sql` — el INSERT completo (656 de free-exercise-db + los 4
 *     locales que no existen en ningún dataset), porque `db:reset` trunca la
 *     tabla antes: no hay nada con lo que chocar.
 *   · `db/10_catalogo_fedb.sql` — solo los 656, con `ON CONFLICT` contra
 *     `exercises_fedb_id_key`: es la migración para una base que ya tiene
 *     datos, y tiene que poder correrse dos veces sin duplicar.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

const CATALOGO = join(raiz, "db", "fedb-catalogo.json");
const SEED = join(raiz, "db", "99_seed.sql");
const MIGRACION = join(raiz, "db", "10_catalogo_fedb.sql");

const MARCA_INICIO = "-- >>> generado por scripts/generar-catalogo.mjs";
const MARCA_FIN = "-- <<< generado";

// Categorías que entran: fuerza y sus primas olímpicas. Fuera estiramientos,
// pliometría, strongman y cardio — medido y decidido en el plan.
const CATEGORIAS = new Set(["strength", "powerlifting", "olympic weightlifting"]);

// Dos excepciones por lista explícita: están en uso hoy (Mountain_Climbers en
// el seed, como "Escalador") y sacarlas del catálogo sería una regresión
// aunque su categoría real quede fuera del filtro de arriba.
const EXTRA = ["Mountain_Climbers", "Farmers_Walk"];

// primaryMuscles[0] → el grupo grueso del enum `muscle_group`. Determinista:
// medido contra los 656 candidatos, ningún primario queda sin mapear (y el
// script revienta si algún día deja de ser cierto).
const GRUPOS = {
  chest: "Pecho",
  lats: "Espalda",
  "middle back": "Espalda",
  "lower back": "Espalda",
  quadriceps: "Pierna",
  hamstrings: "Pierna",
  glutes: "Pierna",
  calves: "Pierna",
  adductors: "Pierna",
  abductors: "Pierna",
  shoulders: "Hombro",
  biceps: "Brazo",
  triceps: "Brazo",
  abdominals: "Core",
  traps: "Trapecio",
  neck: "Trapecio",
  forearms: "Antebrazo",
};

// `equipment` de free-exercise-db → el vocabulario que ya usa la UI, más los
// nuevos que trae el dataset. Sin entrada (incluido `null`) cae en 'Otro'.
const EQUIPOS = {
  barbell: "Barra",
  dumbbell: "Mancuernas",
  cable: "Polea",
  machine: "Máquina",
  "body only": "Peso corporal",
  "e-z curl bar": "Barra Z",
  kettlebells: "Pesa rusa",
  bands: "Banda elástica",
  "medicine ball": "Balón medicinal",
  "exercise ball": "Fitball",
  "foam roll": "Rodillo",
};

/**
 * Los que no existen en ningún dataset — ni free-exercise-db ni wger—: son
 * movimientos propios. Se quedan en español y sin foto, que es lo correcto.
 * Si algún día cambian, se editan aquí; no hay TSV que los gobierne porque no
 * hay nada que enlazar.
 */
const LOCALES = [
  { nombre: "Bridge 3 apoyo inferior", grupo: "Pierna", equipo: "Peso corporal" },
  { nombre: "AMI - Glúteos 1 pierna 3 apoyos", grupo: "Pierna", equipo: "Máquina" },
  { nombre: "Elevación de pierna alternativa en plancha", grupo: "Core", equipo: "Peso corporal" },
  { nombre: "Flexión de cadera en plancha lateral", grupo: "Core", equipo: "Peso corporal" },
];

function leerCatalogo() {
  return JSON.parse(readFileSync(CATALOGO, "utf8"));
}

function comillas(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

/** Literal de array de Postgres: {a,b}. Las comillas cubren los que llevan espacio. */
function arrayPg(valores) {
  if (!valores?.length) return "NULL";
  return `'{${valores.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")}}'`;
}

/** Filtra y valida. Revienta en vez de importar algo a medio mapear. */
function seleccionar() {
  const catalogo = leerCatalogo();
  const porId = new Map(catalogo.map((e) => [e.id, e]));

  const filtrados = catalogo.filter((e) => CATEGORIAS.has(e.category));
  const ids = new Set([...filtrados.map((e) => e.id), ...EXTRA]);

  const faltantes = EXTRA.filter((id) => !porId.has(id));
  if (faltantes.length) {
    console.error(`Ids de EXTRA que no existen en el catálogo: ${faltantes.join(", ")}`);
    process.exit(1);
  }

  const seleccionados = [...ids].map((id) => porId.get(id));

  const sinGrupo = seleccionados.filter((e) => !GRUPOS[e.primarios[0]]);
  if (sinGrupo.length) {
    console.error("Músculos primarios sin mapear a un grupo:");
    for (const e of sinGrupo) console.error(`  ${e.id}: ${e.primarios[0]}`);
    process.exit(1);
  }

  return seleccionados.sort((a, b) => a.name.localeCompare(b.name));
}

function fila(nombre, grupo, equipo, fedbId, primarios, secundarios) {
  return (
    `  (${comillas(nombre)}, ${comillas(grupo)}, ${comillas(equipo)}, ` +
    `${fedbId ? comillas(fedbId) : "NULL"}, ${arrayPg(primarios)}, ${arrayPg(secundarios)})`
  );
}

function generar() {
  const seleccionados = seleccionar();
  const columnas = "(nombre, grupo, equipo, fedb_id, musculos_primarios, musculos_secundarios)";

  const filasFedb = seleccionados.map((e) =>
    fila(e.name, GRUPOS[e.primarios[0]], EQUIPOS[e.equipment] ?? "Otro", e.id, e.primarios, e.secundarios),
  );
  const filasLocales = LOCALES.map((l) => fila(l.nombre, l.grupo, l.equipo, null, null, null));

  const seedSql =
    `-- ${seleccionados.length} de free-exercise-db (strength · powerlifting · olympic\n` +
    `-- weightlifting, más Mountain_Climbers y Farmers_Walk por lista explícita) +\n` +
    `-- ${LOCALES.length} locales sin equivalente en ningún dataset.\n` +
    `INSERT INTO exercises ${columnas} VALUES\n` +
    [...filasFedb, ...filasLocales].join(",\n") +
    ";";

  const migracionSql =
    `-- ${seleccionados.length} de free-exercise-db. Los 4 locales no van aquí: una base que\n` +
    `-- pasa por migraciones ya los tiene, del INSERT original de 69.\n` +
    `INSERT INTO exercises ${columnas} VALUES\n` +
    filasFedb.join(",\n") +
    `\nON CONFLICT (fedb_id) WHERE fedb_id IS NOT NULL AND es_publico DO NOTHING;`;

  return { seedSql, migracionSql, n: seleccionados.length };
}

/** Reemplaza el bloque entre marcas, dejando intacto todo lo demás. */
function escribir(destino, sql) {
  const texto = readFileSync(destino, "utf8");
  const desde = texto.indexOf(MARCA_INICIO);
  const hasta = texto.indexOf(MARCA_FIN);

  if (desde === -1 || hasta === -1 || hasta < desde) {
    console.error(`Faltan las marcas en ${destino}. Se esperaban:\n  ${MARCA_INICIO}\n  ${MARCA_FIN}`);
    process.exit(1);
  }

  writeFileSync(destino, `${texto.slice(0, desde)}${MARCA_INICIO}\n\n${sql}\n\n${texto.slice(hasta)}`);
  console.error(`escrito ${destino}`);
}

const { seedSql, migracionSql, n } = generar();

if (process.argv.includes("--escribir")) {
  escribir(SEED, seedSql);
  escribir(MIGRACION, migracionSql);
  console.error(`${n} ejercicios de free-exercise-db + ${LOCALES.length} locales.`);
} else {
  console.log(seedSql);
}
