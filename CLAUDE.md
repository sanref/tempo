# Tempo

App de planes de entrenamiento de gimnasio. Dos roles: **alumno** (sigue un plan
y registra series desde el móvil) y **entrenador** (crea rutinas, las asigna,
vigila adherencia). Next.js 16 App Router + TypeScript + Drizzle sobre Postgres.

El diseño viene de un handoff de alta fidelidad (sistema *Modernist*) y está
implementado fielmente. **La UI no se rediseña sobre la marcha**: si algo no
encaja, preguntá antes de inventar una variante.

## Entorno

```bash
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run build
npm run db:create    # db/01_schema.sql
npm run db:migrate   # db/02_… 03_… en orden, sobre una base que ya tiene datos
npm run db:seed      # db/99_seed.sql — 12 semanas de historial relativas a now()
npm run db:reset     # 00 + 01 + 99, destructivo
```

Requiere Postgres local y un `.env` con `DATABASE_URL` y `MOCK_USER_ID`
(ver `.env.example`). Todo el esquema vive en el schema `tempo`, no en `public`.

Usuarios del seed:
- `11111111-…1111` Marco Duarte (alumno)
- `22222222-…2222` Laura Ferrán (entrenadora) — cambiá `MOCK_USER_ID` para ver `/coach`

## Invariantes

Estas reglas ya están aplicadas en todo el código. Romperlas es un bug, no una
preferencia de estilo.

**El SQL manda.** `db/01_schema.sql` es la fuente de la verdad;
`src/db/schema.ts` es su espejo en Drizzle. Si tocás uno, tocá el otro en el
mismo commit.

**Un cambio de esquema son dos archivos.** Se edita `01_schema.sql` —que es
como queda una base nueva— y además se escribe una migración numerada
(`02_…`, `03_…`) que lleve una base con datos hasta ahí. `db:reset` no pasa por
las migraciones; `db:migrate` sí, y por eso **tienen que ser idempotentes**:
`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`, y los `UPDATE` acotados a las
filas que aún no se convirtieron. Correr una dos veces no puede romper nada.

**Las mutaciones nunca cuelgan de un GET.** Empezar un entrenamiento, crear o
duplicar una rutina son `POST` vía `<form action={serverAction}>`. Next
prefetchea los `<Link>` al pasar el ratón: una página que inserta filas al
renderizar crea registros fantasma. Ya pasó una vez con `/entrenar`.

**Los cronómetros se derivan de marcas absolutas.** El reloj de la sesión es
`now() - started_at`; el descanso guarda su hora de fin en `localStorage`.
Nunca acumular ticks del cliente — la pantalla se apaga a mitad de serie.

**La pantalla de sesión escribe primero en local.** Cambio → estado local
inmediato → cola en `localStorage` (última escritura gana por serie) → flush con
debounce. Si falla, la cola se queda y reintenta al volver la red o la pestaña.
En el gimnasio no hay cobertura; la interfaz no espera al servidor jamás.

**Lo agregable pesado va en la base.** No traigas `set_logs` a Node para
sumarlos. Ya existen: `session_summaries`, `volumen_semanal()`,
`ultimas_series()`, `adherencia()`, `registrar_prs()`.

**Los ejercicios son un catálogo, no texto.** `set_logs.exercise_id` apunta a
`exercises`. Sin eso no hay progreso por ejercicio a través de rutinas.

**El catálogo tiene una parte común y una privada.** Lo que da de alta un
usuario nace con `es_publico = false` y `created_by = él`; el índice único de
nombres es parcial (`... WHERE es_publico`), así que dos personas pueden tener
su propio "Remo con banda" sin chocar. Por eso `getEjercicios()` exige un
`userId` y filtra por *público o mío*: si alguna vez volvés a filtrar solo por
`es_publico`, los ejercicios propios desaparecen de la biblioteca y del editor
sin dar ningún error.

**Una plancha no son repeticiones.** `routine_exercises.tipo` distingue `reps`
de `tiempo`. En los bloques por tiempo, `set_logs.reps` se queda en 0 y lo que
se registra son `set_logs.segundos` — hay un CHECK que lo obliga. Así el
volumen (`kg * reps`) da 0 y `registrar_prs()` los deja fuera, que es lo
correcto: sumar isométricos a una curva de kilos la falsea.

**El texto de `reps` se traduce en dos sitios y tienen que decir lo mismo.**
`reps` es texto libre del plan (`'8'`, `'8-12'`, `'45 s'`). Lo convierten a
número `reps_planificadas()` / `segundos_planificados()` en el SQL y
`repsPlanificadas()` / `segundosPlanificados()` en `src/lib/format.ts`. Un
rango se resuelve por el extremo bajo. Nunca quitar los no-dígitos a pelo:
`'8-12'` se convierte en 812 y revienta contra el CHECK de `set_logs.reps`.

**Un ejercicio en uso no se borra.** `routine_exercises.exercise_id` y
`set_logs.exercise_id` son ON DELETE RESTRICT: la base ya lo impide, y
`borrarEjercicio()` lo comprueba antes solo para poder decir en qué está metido
en vez de soltar una violación de clave ajena. Renombrarlo sí se permite
siempre — todo apunta por id, así que corregir una errata la arregla en las
rutinas y en el historial a la vez.

**Solo una sesión en curso por usuario**, garantizado por un índice único
parcial. "Empezar" reanuda si hay una abierta, no duplica.

**Corregir un entrenamiento rehace sus marcas desde cero.**
`registrar_prs()` solo inserta cuando se supera lo anterior, así que volver a
llamarlo tras una corrección a la baja deja puesta la marca vieja. Por eso
`guardarCorreccion()` borra las marcas de esa sesión y recalcula. Lo que no
rehace es la progresión lineal: ya se aplicó al cerrar, y repetirla subiría la
carga dos veces. Lo mismo al borrar un entrenamiento — se van sus series y sus
marcas, la carga de la rutina se queda.

**Un alumno, un plan vivo.** `asignarRutina()` cierra la asignación anterior
(`ended_on = current_date`) e inserta la nueva en la misma transacción. El
índice único solo impide repetir la *misma* rutina viva, así que sin ese cierre
el alumno acabaría con dos planes abiertos y `getPlanActivo()` eligiendo por
`started_on` — arbitrariamente si coinciden el mismo día. Cerrar no borra nada:
el historial cuelga de las sesiones, no de la asignación.

**El editor va a dos velocidades.** La estructura (añadir y quitar ejercicios,
crear y borrar días) escribe en el servidor al instante, porque necesita los
ids que genera la base; los ajustes (nombre, orden, series, descanso,
progresión, notas) se editan en local y salen con "Guardar". Por eso `dias`
vive en estado dentro de `editor-client.tsx` y se actualiza con lo que
devuelven las acciones: nada de `router.refresh()`, que borraría lo que hubiera
a medio ajustar.

**El service worker nunca toca lo que no sea GET.** Las mutaciones tienen que
llegar al servidor o fallar de verdad, que es como se entera la cola de la
sesión. Tampoco cachea payloads RSC: comparten URL con el documento.

**Todo el usuario final en es-ES.** Coma decimal, punto de millar, textos en
español. Las cifras pasan por `src/lib/format.ts`; no llames a `toLocaleString`
suelto por ahí.

## Estilos

Dos capas, en ese orden:

- `src/app/design-system.css` — Modernist portado tal cual. **No editar valores
  sueltos**: si hay que cambiar el aspecto, se retoca un token de `:root`.
- `src/app/app.css` — capa de Tempo. Solo `var(--…)`, ni un hex ni un px que ya
  lleve token.

Reglas del sistema que se rompen fácil sin querer: **radio de borde 0 en todas
partes**, reglas de 2px entre secciones y 1px entre filas, todo alineado a la
izquierda (incluidas las etiquetas de botones anchos), rojo `--color-accent`
solo para acción primaria y énfasis pequeño, nada flota (sin sombras). Iconos de
Lucide. Fuente Archivo vía `next/font/google`.

Móvil es un breakpoint (`max-width: 640px`), no un modo: aparece la barra de
pestañas inferior y desaparece la navegación de la cabecera.

## Mapa

```
db/01_schema.sql              tablas, tipos, índices, vistas, funciones
db/02_….sql                   migraciones, numeradas de 02 a 98
db/99_seed.sql                datos del prototipo
src/app/actions.ts            TODAS las mutaciones
src/app/*/page.tsx            una pantalla por ruta, Server Components
src/app/*/loading.tsx         esqueleto de esa pantalla, con su misma rejilla
src/app/offline/page.tsx      último recurso del service worker (estática)
src/app/entrenar/[sesionId]/session-client.tsx   la pieza compleja: cola offline
src/components/skeleton.tsx   piezas de los loading.tsx
src/components/exercise-form.tsx  alta de ejercicio, compartida por biblioteca y editor
src/components/sw-register.tsx  registra el SW (solo en producción)
public/sw.js                  caché de shell, sin build step
src/db/queries.ts             una función de lectura por bloque de pantalla
src/lib/auth.ts               punto único de acoplamiento con la autenticación
src/lib/format.ts             formato es-ES
```

## Auth

Sin autenticación todavía. `getCurrentUser()` en `src/lib/auth.ts` devuelve el
usuario de `MOCK_USER_ID`. **Ninguna pantalla lee el usuario de otro sitio**, así
que enchufar Better Auth o Supabase es cambiar esa función y añadir
`users.auth_id`. Mantené esa propiedad: si necesitás el usuario, importalo de
ahí.

Las server actions ya verifican que la fila pertenece al usuario actual aunque
la sesión sea falsa. Seguí haciéndolo en las nuevas.

## Pendiente

Por orden de valor:

1. **Fotos de ejercicios.** Hoy se pinta el placeholder "Imagen pendiente" del
   diseño; las reales van envueltas en `.grayscale`. El alta de ejercicio
   todavía no pide imagen: `imagen_url` se queda a NULL.
2. **Filtros de rutinas por tipo** (Fuerza / Hipertrofia): hace falta una
   columna de etiquetas, hoy el filtro es por estado.
3. **Navegación offline entre pantallas.** El service worker guarda documentos,
   pero los payloads RSC van siempre a red: sin cobertura, tocar un enlace cae
   en navegación completa contra el caché. Funciona, pero parpadea.

## Al terminar un cambio

Corré `npm run typecheck` y `npm run build`. Si tocaste SQL, corré también
`npm run db:reset` y comprobá que el seed entra limpio. Si el cambio lleva
migración, probala además contra una copia con datos —`pg_dump` a una base
desechable y `db:migrate` encima— y corrésela dos veces seguidas.
