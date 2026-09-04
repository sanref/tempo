/**
 * ── Enlaces al catálogo de free-exercise-db ────────────────────────────────
 *
 *   node scripts/generar-enlaces-fedb.mjs --sugerir   propone candidatos
 *   node scripts/generar-enlaces-fedb.mjs             emite el SQL por stdout
 *   node scripts/generar-enlaces-fedb.mjs --escribir  lo mete en los dos SQL
 *
 * Nuestro catálogo está en español y free-exercise-db en inglés, así que el
 * enlace entre los dos no se puede deducir: se cura a mano una vez y queda
 * escrito en `db/enlaces-fedb.tsv`. Este script hace las dos mitades mecánicas
 * de ese trabajo.
 *
 * `--sugerir` traduce cada nombre con un glosario de términos de gimnasio y
 * puntúa los candidatos por palabras en común. **Propone, no decide**: acierta
 * en los ejercicios de libro y falla en los inventados o muy locales, que es
 * justo donde hace falta una persona. Su salida se pega en el TSV y se corrige.
 *
 * Sin `--sugerir` lee el TSV ya curado y escupe los UPDATE de la migración,
 * con los músculos ya resueltos desde el catálogo. Se genera SQL en vez de
 * importar en caliente para que el enlace quede commiteado y determinista, y
 * para que `tempo_mobile` lo herede sin hacer nada.
 *
 * El TSV es la fuente: si un ejercicio no tiene equivalente en inglés se deja
 * la segunda columna vacía y se queda sin foto, que es lo correcto. Inventar un
 * enlace parecido sería peor — enseñaría el movimiento equivocado.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

const CATALOGO = join(raiz, "db", "fedb-catalogo.json");
const ENLACES = join(raiz, "db", "enlaces-fedb.tsv");

/**
 * Los enlaces tienen que estar en los dos sitios, y no es duplicación
 * gratuita: `db:migrate` corre las migraciones y `db:reset` **no** —hace
 * 00 + 01 + 99— así que una base recién creada solo pasa por el seed. Si el
 * bloque viviera únicamente en la migración, `db:reset` dejaría un catálogo
 * con las columnas puestas y sin una sola foto.
 *
 * Los dos se generan de la misma fuente (el TSV) y se reemplazan entre marcas,
 * así que no pueden desincronizarse a mano.
 */
const DESTINOS = [
  join(raiz, "db", "08_ejercicios_externos.sql"),
  join(raiz, "db", "99_seed.sql"),
];

const MARCA_INICIO = "-- >>> generado por scripts/generar-enlaces-fedb.mjs";
const MARCA_FIN = "-- <<< generado";

// El glosario y la puntuación se importan del mismo módulo que usa el buscador
// del formulario de admin, en vez de copiarse aquí: son la misma pregunta
// ("cómo se dice esto en inglés") y dos copias se separan a la primera palabra
// que se añada en una y no en la otra. Así lo que propone este script es
// exactamente lo que verá quien enlace desde la app.
//
// Se importa `catalogo-glosario` y no `catalogo-externo` porque ese otro
// importa el JSON, y esa importación solo la entiende el bundler de Next: Node
// exige `with { type: "json" }`. Aquí el catálogo lo lee `leerCatalogo()`.
//
// `pathToFileURL` no es adorno: en Windows un import dinámico con ruta absoluta
// se lee como el esquema 'c:' y falla.
const { puntuar } = await import(
  pathToFileURL(join(raiz, "src", "lib", "catalogo-glosario.ts")).href
);

function leerCatalogo() {
  return JSON.parse(readFileSync(CATALOGO, "utf8"));
}

/**
 * Lee el TSV curado. Formato: `nombre en español \t fedb_id`, `#` comenta.
 * Segunda columna vacía = sin equivalente, a propósito.
 */
function leerEnlaces() {
  return readFileSync(ENLACES, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [nombre, fedbId = ""] = l.split("\t").map((c) => c.trim());
      return { nombre, fedbId };
    });
}

/**
 * Propone candidatos con el mismo buscador que usa el formulario de admin, así
 * que lo que se ve aquí es exactamente lo que verá quien enlace desde la app.
 */
function sugerir() {
  const catalogo = leerCatalogo();
  for (const { nombre, fedbId } of leerEnlaces()) {
    const candidatos = puntuar(catalogo, nombre, 3);
    console.log(`\n${nombre}${fedbId ? `   [ya: ${fedbId}]` : ""}`);
    if (!candidatos.length) console.log("   (sin candidatos)");
    for (const c of candidatos) console.log(`   ${c.id}  — ${c.name}`);
  }
}

/** Literal de array de Postgres: {a,b}. Las comillas cubren los que llevan espacio. */
function arrayPg(valores) {
  if (!valores?.length) return null;
  return `'{${valores.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")}}'`;
}

function comillas(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

function generarSql() {
  const porId = new Map(leerCatalogo().map((e) => [e.id, e]));
  const enlaces = leerEnlaces();

  const lineas = [];
  let enlazados = 0;
  const sinEnlace = [];
  const rotos = [];

  for (const { nombre, fedbId } of enlaces) {
    if (!fedbId) {
      sinEnlace.push(nombre);
      continue;
    }
    const ext = porId.get(fedbId);
    if (!ext) {
      rotos.push(`${nombre} → ${fedbId}`);
      continue;
    }
    enlazados++;
    lineas.push(
      `UPDATE exercises SET fedb_id = ${comillas(ext.id)},\n` +
        `                     nombre_en = ${comillas(ext.name)},\n` +
        `                     musculos_primarios = ${arrayPg(ext.primarios)},\n` +
        `                     musculos_secundarios = ${arrayPg(ext.secundarios)}\n` +
        ` WHERE lower(nombre) = ${comillas(nombre.toLowerCase())}\n` +
        `   AND es_publico AND fedb_id IS NULL;`,
    );
  }

  if (rotos.length) {
    console.error("Ids que no existen en el catálogo:");
    for (const r of rotos) console.error(`  ${r}`);
    process.exit(1);
  }

  const resumen =
    `-- ${enlazados} enlazados; ${sinEnlace.length} sin equivalente en inglés,\n` +
    `-- que se quedan sin foto a propósito:\n` +
    sinEnlace.map((n) => `--   · ${n}`).join("\n");

  return { sql: `${resumen}\n\n${lineas.join("\n\n")}`, enlazados, sinEnlace };
}

/** Reemplaza el bloque entre marcas, dejando intacto todo lo demás. */
function escribir(sql) {
  for (const destino of DESTINOS) {
    const texto = readFileSync(destino, "utf8");
    const desde = texto.indexOf(MARCA_INICIO);
    const hasta = texto.indexOf(MARCA_FIN);

    if (desde === -1 || hasta === -1 || hasta < desde) {
      console.error(`Faltan las marcas en ${destino}. Se esperaban:\n  ${MARCA_INICIO}\n  ${MARCA_FIN}`);
      process.exit(1);
    }

    writeFileSync(
      destino,
      `${texto.slice(0, desde)}${MARCA_INICIO}\n\n${sql}\n\n${texto.slice(hasta)}`,
    );
    console.error(`escrito ${destino}`);
  }
}

if (process.argv.includes("--sugerir")) {
  sugerir();
} else {
  const { sql, enlazados, sinEnlace } = generarSql();
  if (process.argv.includes("--escribir")) {
    escribir(sql);
    console.error(`${enlazados} enlazados, ${sinEnlace.length} sin equivalente.`);
  } else {
    console.log(sql);
  }
}
