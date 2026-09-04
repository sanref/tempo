# Reemplazar el catálogo por free-exercise-db

> Plan, no implementación. Escrito el 2026-08-20; nada de esto está hecho todavía.
> Las cifras son medidas contra el dataset y contra la base real, no estimadas.

## Contexto

El catálogo son 69 ejercicios escritos a mano en `db/99_seed.sql`, en español, de
los que 65 se enlazaron a free-exercise-db con una tabla curada a mano
(`db/enlaces-fedb.tsv`). Funciona, pero es un catálogo de prototipo: cubre lo que
alguien tecleó una tarde, no lo que hay en un gimnasio.

La idea es tirarlo y montar el catálogo directamente desde free-exercise-db, que
ya es la fuente de las fotos. Con eso el enlace deja de ser un matcheo curado y
pasa a ser **el mismo registro**: nombre, foto, músculos y equipamiento salen
todos de la misma fila, sin posibilidad de descuadre.

### wger no aporta registros, y no conviene mezclarlo

Medido, no supuesto: wger tiene 860 ejercicios, 644 con nombre en español. Pero
**cruzarlo con free-exercise-db no es fiable** — son dos datasets independientes
sin id común. Puntuando los 644 por nombre en inglés, solo 355 dan match
«fuerte», y revisándolos fallan:

| wger (es) | wger (en) | lo que casa en fedb | veredicto |
|---|---|---|---|
| Rueda abdominal | Ab wheel | **Conan's Wheel** | otro ejercicio (strongman) |
| Remo alto en polea alternado | Alternating High Cable Row | Alternating **Kettlebell** Row | otro equipamiento |
| Curl alterno de martillo | Alternating dumbbell hammer curl | **Preacher** Hammer Curl | otro movimiento |

Importar eso llenaría el catálogo de ejercicios que enseñan el movimiento
equivocado, que es exactamente lo que se evitó curando a mano. **wger se queda
solo como lo que ya es: los SVG de músculos**, que se pintan a partir del
vocabulario de 17 músculos de free-exercise-db. No hay nada que importar de él.

### Decisiones tomadas

1. **Nombres en inglés**, tal como vienen. Sin traducir.
2. **654 ejercicios**: `strength` + `powerlifting` + `olympic weightlifting`.
   Fuera 123 estiramientos, 61 de pliometría, 21 strongman y 14 de cardio.
3. **Reset completo**, asumiendo la pérdida de las 4 rutinas y las 3 sesiones
   reales — pero **con un paso que reconstruye los perfiles** para no quedarte
   fuera de la app (ver abajo, es un problema real).
4. **Paginar la biblioteca.**

---

## Dos bugs que aparecieron por el camino

**1. El seed pierde un ejercicio en silencio, ahora mismo.**
`db/99_seed.sql:190` pide `'Remo en punta'` y el catálogo tiene `'Remo en T'`
(`db/99_seed.sql:47`). El `JOIN exercises e ON e.nombre = v.ejercicio` es un
INNER JOIN: la fila no casa y desaparece sin error. **Confirmado contra la base
real** — el Día D tiene 3 ejercicios en vez de 4:

```
 codigo | ejercicios
 A      |          5
 B      |          5
 C      |          5
 D      |          3   ← deberían ser 4
 E      |          4
```

No basta con corregir la errata: el patrón tiene que dejar de fallar callado.

**2. `ExercisePhoto` precarga las dos fotos al montar** (`src/components/exercise-photo.tsx:60-86`)
con `new Image()`, lo que **salta el `loading="lazy"`** del `<img>`. Hoy con 69
tarjetas se nota poco; con 654 serían 1.746 peticiones y ~92 MB de golpe.

> Paginar y arreglar la precarga **no son alternativas**, aunque la pregunta que
> se hizo al decidir los presentó así. Aun paginando a 48 por página son 96 fotos
> ≈ 7 MB por página. El plan hace las dos cosas.

---

## Pipeline de importación

**`db/fedb-catalogo.json` hay que regenerarlo.** Se recortó a
`id/name/primarios/secundarios` y **no trae `equipment` ni `category`**, que son
justo lo que hace falta ahora. Se vuelve a bajar de jsDelivr y se guarda con esos
dos campos añadidos.

**`scripts/generar-catalogo.mjs`** (nuevo, `.mjs` plano como los otros): lee el
catálogo, filtra, mapea y escribe el bloque de `INSERT` entre marcas en
`db/99_seed.sql` y en la migración — mismo mecanismo que
`scripts/generar-enlaces-fedb.mjs`, que se conserva como referencia pero deja de
usarse.

**Los dos mapeos son deterministas**, no hay matcheo difuso:

`grupo` ← `primaryMuscles[0]`, contra el enum de 8 valores que ya existe:

```
chest                                    → Pecho
lats · middle back · lower back          → Espalda
quadriceps · hamstrings · glutes ·
  calves · adductors · abductors         → Pierna
shoulders                                → Hombro
biceps · triceps                         → Brazo
abdominals                               → Core
traps · neck                             → Trapecio
forearms                                 → Antebrazo
```

`equipo` ← `equipment`, traducido y reusando el vocabulario actual (`Barra`,
`Mancuernas`, `Polea`, `Máquina`, `Peso corporal`, `Barra Z`) más los nuevos
(`Pesa rusa`, `Banda elástica`, `Balón medicinal`, `Fitball`, `Rodillo`, `Otro`).
Se traduce aunque los nombres queden en inglés: `equipo` es una etiqueta de UI
—se lee como «Pecho · Barra»— y alimenta los filtros.

**Dos ejercicios se incluyen fuera del filtro**, por lista explícita:
`Mountain_Climbers` (pliometría) y `Farmers_Walk` (strongman). Están en uso hoy
y dejarlos fuera sería una regresión. Total: **656**.

**Los 4 locales sobreviven**: `Bridge 3 apoyo inferior`,
`AMI - Glúteos 1 pierna 3 apoyos`, `Elevación de pierna alternativa en plancha`
y `Flexión de cadera en plancha lateral` no existen en ningún dataset — son
tuyos. Se quedan en el seed, en español y sin foto, que es lo correcto.

---

## Esquema

Un solo cambio, y por tanto **dos archivos** (regla del proyecto):

```sql
CREATE UNIQUE INDEX exercises_fedb_id_key
  ON exercises (fedb_id) WHERE fedb_id IS NOT NULL AND es_publico;
```

Hoy **no hay nada que impida dos filas públicas apuntando al mismo `fedb_id`**,
y sin esto una importación repetida duplica el catálogo entero sin quejarse.

- `db/01_schema.sql` — el índice, junto a `exercises_nombre_publico_key`.
- `db/10_catalogo_fedb.sql` — **nueva**, siguiente número libre (la última es la
  09). Índice + el bloque generado de INSERTs, idempotente.
- `src/db/schema.ts` — el espejo Drizzle ya declara los índices en el tercer
  argumento de `pgTable`; se añade ahí.

`db/08_ejercicios_externos.sql` se queda como está: sus 65 `UPDATE` van contra
`lower(nombre)` en español, así que tras el cambio no casan con nada y quedan en
no-op. Es correcto y no hace falta tocarlo.

---

## El seed

`db/99_seed.sql` es donde está casi todo el trabajo.

1. **El `INSERT` de 69 ejercicios** se sustituye por el bloque generado de 656 +
   los 4 locales.
2. **El bloque de 65 `UPDATE`** (líneas ~357-821, la copia de la migración 08)
   **se borra**: el import ya escribe `fedb_id`, `nombre_en` y los músculos en
   el propio INSERT.
3. **`routine_exercises` pasa a enlazar por `fedb_id`**, no por nombre:

```sql
FROM (VALUES
  ('A', 'Barbell_Deadlift',                 0, 4, 'reps', '5',   132.5, NULL,       180),
  ('A', 'Weighted_Pull_Ups',                1, 4, 'reps', '6',    17.5, '+17,5 kg', 150),
  ...
) AS v (codigo, fedb, orden, series, tipo, reps, carga_kg, carga_texto, descanso_s)
JOIN routine_days d ON d.routine_id = '…0001' AND d.codigo = v.codigo
JOIN exercises e ON e.fedb_id = v.fedb;
```

   Los 23 tramos se reapuntan usando `db/enlaces-fedb.tsv`, que sigue siendo la
   traducción correcta de esos nombres. **Se corrige de paso `'Remo en punta'`**.

4. **El JOIN deja de fallar callado.** Después del `INSERT`, una comprobación que
   revienta si faltan filas:

```sql
IF (SELECT count(*) FROM routine_exercises WHERE routine_day_id IN (…)) <> 23 THEN
  RAISE EXCEPTION 'El seed perdió ejercicios: algún fedb_id no existe en el catálogo.';
END IF;
```

   Esto es lo que habría cazado el bug del Día D hace semanas.

El resto del seed no se toca: las 12 semanas de historial (`DO $$` en
`db/99_seed.sql:238-317`) recorren `routine_exercises` y no nombran ningún
ejercicio, así que siguen funcionando igual.

---

## No quedarte fuera de la app

`db/00_reset.sql` borra `public.users` y **no toca `auth.users`**. Las dos
cuentas reales seguirían existiendo en Supabase Auth pero sin perfil, y como el
trigger `on_auth_user_created` solo dispara al *registrarse*, entrar no lo
recrearía: `getCurrentUser()` no encontraría fila y rebotaría a `/login` en
bucle.

**`db/perfiles-desde-auth.sql`** (nueva; sin prefijo numérico a propósito, para
que `migraciones()` en `scripts/db.mjs:45-53` no la recoja) reconstruye los
perfiles:

```sql
INSERT INTO public.users (email, nombre, role, auth_id)
SELECT au.email,
       coalesce(au.raw_user_meta_data->>'nombre', split_part(au.email, '@', 1)),
       'alumno', au.id
  FROM auth.users au
ON CONFLICT (email) DO UPDATE SET auth_id = EXCLUDED.auth_id;

-- El rol NO se lee de raw_user_meta_data: Supabase lo copia al registrarse y no
-- lo vuelve a tocar, así que restaurarlo de ahí degradaría al admin a alumno.
UPDATE users SET role = 'admin' WHERE email = :'admin_email';
```

`admin_email` sale de una variable nueva en `.env` (que está en `.gitignore`, así
que el correo no acaba en el repo). `scripts/db.mjs` la pasa con `-v` y añade el
archivo al final del paso `reset`, más un `db:perfiles` suelto.

---

## La UI a 656 ejercicios

**Paginar `/ejercicios`.** `getEjercicios()` gana `limite`/`offset` y una consulta
de total; la pantalla gana `?p=` y controles de página (~48 por página). Hay que
subir también los contadores de `src/app/(app)/ejercicios/loading.tsx`, que hoy
pinta 8 tarjetas y `SkFiltros n={6}` cuando los grupos son 8.

**Arreglar la precarga de `ExercisePhoto`**: la descarga de la segunda foto y la
alternancia se activan solo cuando la tarjeta entra en pantalla
(`IntersectionObserver`). La primera foto se queda con `loading="lazy"`, que
entonces sí sirve. Sin esto, 48 tarjetas son ~7 MB y 48 temporizadores.

**`getUsosEjerciciosPropios(userId, true)`** — el camino de admin. Hoy son dos
subconsultas correlacionadas por fila; a 656 filas son 1.312 ejecuciones, y el
lado de `set_logs` **no tiene índice usable** (el que hay es parcial,
`WHERE done_at IS NOT NULL`), así que son 656 recorridos secuenciales en cada
carga de una página `force-dynamic`. Se reescribe como dos agregados con
`GROUP BY` y `LEFT JOIN`.

**El picker del editor de rutinas.** El comentario de
`src/app/(app)/rutinas/[id]/editar/page.tsx:26-27` dice «son unas decenas de
filas», y eso deja de ser verdad. Dos arreglos pequeños: recortar el prop a los 6
campos que usa `EjercicioCatalogo` (hoy viaja la fila entera, músculos incluidos)
y **no listar los 656 con la búsqueda vacía** — mostrar los primeros N y pedir
que escriba.

---

## Verificación

1. `npm run typecheck` y `npm run build`. `/offline` tiene que seguir `○ (Static)`.
2. `npm run db:reset` seguido de `db:perfiles`, y comprobar:
   - `select count(*) from exercises` → **660** (656 + 4 locales)
   - los cinco días de la rutina con **5, 5, 5, 4, 4** ejercicios (el Día D
     arreglado), y que el seed reviente si no
   - historial generado: sesiones, series y marcas > 0
3. **Entrar con la cuenta admin** y confirmar que el perfil existe y sigue siendo
   `admin`. Es el paso que valida que el reset no dejó a nadie fuera.
4. `npm run db:migrate` dos veces seguidas sobre una copia con datos: la 10 tiene
   que ser idempotente y no duplicar el catálogo (para eso está el índice único).
5. En pantalla: la biblioteca pagina y no dispara cientos de peticiones (mirar la
   pestaña Red); un detalle `/ejercicios/[id]` con foto y diagrama; el picker del
   editor; y una sesión con la foto en grande.
6. Comprobar el reparto por grupo: que ningún grupo del enum quede vacío y que
   `Pierna`/`Hombro` no se coman el catálogo (medido: shoulders 109, quadriceps
   83, abdominals 81, chest 68, triceps 67, biceps 50).

---

## Lo que hay que tener presente

- **Se pierden las 4 rutinas y las 3 sesiones reales.** Es lo que se decidió,
  pero conviene releerlo antes de correr el reset.
- **La biblioteca queda en inglés** dentro de una app en español. `nombre_en` ya
  existe, así que traducir después es rellenar `nombre` sin perder nada.
- `db:reset` es destructivo para la base compartida con `tempo_mobile`, que se va
  a rehacer, así que no bloquea.
- `getEquipos()` (`src/db/queries.ts:769-775`) hace `SELECT DISTINCT` sin filtrar
  por visibilidad: enseña el `equipo` de ejercicios privados de otros. Es un
  detalle menor preexistente; se arregla de paso porque el import cambia justo
  ese vocabulario.

---

## Estado del catálogo antes de tocar nada

Medido el 2026-08-20 contra la base de Supabase, como referencia para comparar
después:

| | |
|---|---|
| ejercicios | 69 (65 enlazados, 4 locales) |
| rutinas | 10 (6 del seed + 4 creadas desde la app) |
| días de rutina | 29 |
| routine_exercises | 36 |
| sesiones | 7 (3 con series confirmadas) |
| set_logs | 171 |
| personal_records | 6 |
| usuarios | 4 (2 del seed + 2 reales) |
