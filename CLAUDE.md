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

Requiere Postgres (local o Supabase) y un `.env` con `DATABASE_URL`,
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ver
`.env.example`). Todo el esquema vive en `public`, sin schema propio: es donde
Supabase espera encontrarlo. Los scripts no crean ni borran `public` —trae
permisos y configuración del proyecto—, solo sus objetos.

El login exige Supabase: en un Postgres pelado el esquema `auth` no existe, el
trigger no se instala y no hay con qué entrar. `01_schema.sql` lo detecta y se
salta esa parte, así que la base levanta igual para trabajar el resto.

> ⚠ **La base de Supabase está compartida con `tempo_mobile`.** `db:reset` es
> destructivo para los dos y no sabe recrear los RPC del móvil (viven en
> `tempo_mobile/supabase/migrations/`). Resetear solo contra una base
> desechable.

Usuarios del seed (las contraseñas se ponen registrándolos, no vienen en el SQL):
- `11111111-…1111` Marco Duarte, `marco@tempo.gym` (alumno)
- `22222222-…2222` Laura Ferrán, `laura@tempo.gym` (entrenadora) — entrá con
  ella para ver `/coach`

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

**Un ejercicio tiene un nombre y puede tener un alias por persona.** El
nombre vive en `exercises` y es de todos; el alias, en `exercise_aliases`
(`user_id`, `exercise_id`) y es de uno. Hacía falta porque el catálogo viene de
free-exercise-db y está en inglés: "Wide-Grip Lat Pulldown" no es como nadie
llama al jalón, y renombrar la fila se lo cambia a todo el mundo.

Se resuelve `coalesce(el mío, el del autor de la rutina, exercises.nombre)`. El
segundo es lo que hace que el alumno vea el léxico de su entrenador dentro del
plan que él le escribió, y va por `routines.author_id` — **no** por
`users.coach_id`: en la biblioteca, el progreso y las marcas manda uno, y
desvincularse no renombra media app de golpe. Quien resuelve el par son
`cargarDias()` y `getSesion()`; el resto de lecturas solo miran el propio.

El alias es **presentación pura**: nada resuelve un id por él, y por eso
`guardarAlias()` no pasa por `ejercicioEditable()` —cualquiera le pone su
nombre a una fila del catálogo común— y el FK contra `exercises` es CASCADE, no
RESTRICT como los de `routine_exercises` y `set_logs`: un alias no puede
impedir borrar un ejercicio que no usa nadie.

**El nombre real nunca se esconde.** Con alias se pinta el alias y debajo, en
`.nombre-real`, el del catálogo — es el único ancla común entre dos personas
que llaman distinto al mismo movimiento, y el que sale en el buscador del
catálogo externo y en el SQL. Lo pinta `<ExerciseName>` y nadie más; donde solo
cabe una cadena (`aria-label`, `alt`, títulos de diálogo) va `nombreVisible()`.
En la cabecera de bloque de la sesión el nombre real se cuela en la línea del
equipamiento en vez de abrir una tercera: con siete a nueve bloques cada línea
de más alarga el scroll.

**El catálogo tiene una parte común y una privada.** Lo que da de alta un
usuario nace con `es_publico = false` y `created_by = él`; el índice único de
nombres es parcial (`... WHERE es_publico`), así que dos personas pueden tener
su propio "Remo con banda" sin chocar. Por eso `getEjercicios()` exige un
`userId` y filtra por *público o mío*: si alguna vez volvés a filtrar solo por
`es_publico`, los ejercicios propios desaparecen de la biblioteca y del editor
sin dar ningún error.

**El catálogo común lo arregla el admin, y solo él.** Cualquiera edita y borra
*lo suyo y privado*; un admin puede tocar cualquier ejercicio, públicos
incluidos, además de publicar y despublicar. La puerta única es
`ejercicioEditable()` en `actions.ts` — no la pantalla, que solo decide si
enseña los botones. Hacía falta porque todo lo que vino del seed tiene
`created_by` a NULL: no era de nadie, y una errata o una foto mal enlazada solo
se arreglaba entrando por SQL.

Se abren UPDATE y DELETE, **no SELECT**: un admin sigue viendo lo mismo que los
demás. Poder arreglar el catálogo compartido no es poder leer los ejercicios
privados de cada persona.

**Despublicar adopta lo que no tiene dueño.** `getEjercicios()` filtra por
público-o-mío, así que quitar del catálogo común una fila con `created_by` NULL
la dejaría invisible para todo el mundo, admin incluido — existiendo en la base
y sin ninguna pantalla desde la que volver. Por eso `editarEjercicio()` le pone
de dueño a quien la despublica. Y al revés, al publicar hay que comprobar el
nombre contra *todos* los públicos aunque la fila hoy sea privada: es el choque
que da el índice único parcial. Las dos cosas las hace `nombreRepetido()`, que
razona sobre **cómo va a quedar la fila**, no cómo está.

**Las fotos y los músculos vienen de fuera, y el enlace es lo que se guarda.**
`exercises.fedb_id` apunta al catálogo de free-exercise-db (dominio público) y
de él se arman las dos fotos del movimiento — sus rutas son siempre
`{fedb_id}/0.jpg` y `/1.jpg`. Los diagramas son de wger (CC-BY-SA 3.0, **la
atribución del pie de `/ejercicios` es parte de la licencia, no adorno**).
Quien arma todas esas URLs es `src/lib/ejercicios-externos.ts` y nadie más:
mudar las fotos de sitio tiene que ser tocar ese archivo solo.

El orden al pintar es `imagen_url` (foto propia) → fotos de `fedb_id` →
"Imagen pendiente". Y ojo con el léxico: `musculos_primarios` y
`musculos_secundarios` guardan las 17 etiquetas **en inglés y en minúsculas**
de free-exercise-db porque son la clave contra los SVG de wger, no texto para
enseñar; lo que se lee sale traducido de ese mismo módulo.

Cinco de las diecisiete (`abductors`, `adductors`, `forearms`, `lower back`,
`neck`) no tienen SVG en wger y solo aparecen como texto. Es a propósito: media
respuesta es mejor que ninguna.

**En la sesión la foto se ve a petición, no fija.** La cabecera de cada bloque
lleva la miniatura de 52 px y al tocarla se abre un diálogo con la foto grande
y los músculos. Fija y grande no: con siete a nueve ejercicios por sesión la
pantalla se convierte en un scroll largo, y entre serie y serie lo que se
quiere es llegar a los campos. El diálogo es **solo lectura** — esa pantalla
tiene una cola de escritura detrás y conviene que lo que se le añada no
escriba nada.

Si un ejercicio no tiene ni foto ni músculos no se pinta el botón: abrirlo
daría una caja vacía.

**El dibujo vive en `/ejercicios/[id]`, no en la rejilla.** `MuscleDiagram`
tiene un modo `compacto` que se salta las siluetas y deja solo los nombres, y
es el que usa la biblioteca: dos siluetas legibles piden más ancho del que da
una tarjeta de 230 px, y multiplicarlas por sesenta y nueve hace la página
inmanejable. Solo se pinta la silueta que tiene algo que enseñar — para un curl
de bíceps la espalda no aparece, porque una silueta en blanco parece un fallo
de carga.

Los SVG de wger se apilan como **máscaras** (`mask-image`), no como imágenes:
traen su propio rojo y el nuestro tiene que ser `--color-accent`. Así el color
sale del token y el asset se queda intacto, que con una licencia share-alike es
lo cómodo.

**Los ejercicios enlazados se generan, no se escriben.** El matcheo entre
nuestros nombres en español y los suyos en inglés está curado a mano en
`db/enlaces-fedb.tsv`, y de ahí sale el SQL con
`node scripts/generar-enlaces-fedb.mjs --escribir`. Lo escribe **en dos
sitios** —`db/08_ejercicios_externos.sql` y `db/99_seed.sql`, entre marcas—
porque `db:migrate` corre las migraciones y `db:reset` no: si el bloque
estuviera solo en la migración, una base recién creada se quedaría sin una sola
foto. Editar cualquiera de los dos a mano se pierde en la siguiente
regeneración; se edita el TSV.

**Una plancha no son repeticiones.** `routine_exercises.tipo` distingue `reps`
de `tiempo`. En los bloques por tiempo, `set_logs.reps` se queda en 0 y lo que
se registra son `set_logs.segundos` — hay un CHECK que lo obliga. Así el
volumen (`kg * reps`) da 0 y `registrar_prs()` los deja fuera, que es lo
correcto: sumar isométricos a una curva de kilos la falsea.

**El texto de `reps` se traduce en dos sitios y tienen que decir lo mismo.**
`reps` es texto libre del plan. Lo convierten a número `reps_planificadas()` /
`segundos_planificados()` en el SQL y `repsPlanificadas()` /
`segundosPlanificados()` en `src/lib/format.ts`. Nunca quitar los no-dígitos a
pelo: `'8-12'` se convierte en 812 y revienta contra el CHECK de
`set_logs.reps`.

**La barra separa series; el guion es un rango.**

```
10            todas las series a 10
8-12          un rango, todas las series → 8 (extremo bajo)
15/12/10/10   una serie por tramo → 15, 12, 10, 10
12-15/10-12/8 un rango por serie
45 s/30 s     lo mismo por tiempo
```

Los dos separadores significan cosas distintas y no se pueden intercambiar:
`'8-12'` ya era un rango antes de que existieran los tramos —y es lo que lee la
progresión doble—, así que si el guion separase series sería ambiguo. Si hay
menos tramos que series se repite el último: 5 series con `'15/12/10'` son 15,
12, 10, 10 y 10.

Las funciones llevan un segundo parámetro `serie` (base 0) con valor por
defecto, así que las llamadas de un argumento siguen valiendo y devuelven el
primer tramo. Quien pasa el índice es `empezarSesion()`, al materializar cada
serie.

**Un ejercicio en uso no se borra.** `routine_exercises.exercise_id` y
`set_logs.exercise_id` son ON DELETE RESTRICT: la base ya lo impide, y
`borrarEjercicio()` lo comprueba antes solo para poder decir en qué está metido
en vez de soltar una violación de clave ajena. Renombrarlo sí se permite
siempre — todo apunta por id, así que corregir una errata la arregla en las
rutinas y en el historial a la vez.

**Las tablas van con RLS activada y con políticas por usuario.** En `public`,
PostgREST publica lo que haya: la clave publicable de Supabase viaja en el
navegador y sin RLS lee y escribe todo. Las políticas están al final de
`01_schema.sql` y en `04_auth.sql`, y cuelgan de `current_user_id()`.

El web no depende de ellas —entra por `DATABASE_URL` con el rol dueño, que
salta RLS— pero **`tempo_mobile` sí**: todo lo suyo pasa por PostgREST. Si una
tabla nueva se queda sin políticas, el móvil deja de ver sus datos sin dar
ningún error. Una tabla nueva se crea con `ENABLE ROW LEVEL SECURITY` **y** sus
políticas, en `01_schema.sql` y en su migración. `session_summaries` lleva
`security_invoker` para no enseñar `set_logs` por la puerta de atrás.

Que el web salte RLS es justamente por qué **las server actions siguen
comprobando a mano que cada fila es del usuario actual**. Esa es su única
protección; la base no lo va a hacer por ellas.

**Solo una sesión en curso por usuario**, garantizado por un índice único
parcial. "Empezar" reanuda si hay una abierta, no duplica.

**Corregir un entrenamiento rehace sus marcas desde cero.**
`registrar_prs()` solo inserta cuando se supera lo anterior, así que volver a
llamarlo tras una corrección a la baja deja puesta la marca vieja. Por eso
`guardarCorreccion()` borra las marcas de esa sesión y recalcula. Lo que no
rehace es la progresión lineal: ya se aplicó al cerrar, y repetirla subiría la
carga dos veces. Lo mismo al borrar un entrenamiento — se van sus series y sus
marcas, la carga de la rutina se queda.

**Vincular necesita a los dos; desvincular, a uno.** El entrenador genera un
código (`coach_invites`) y el alumno lo canjea: nadie reclama a nadie. Pero
cortar es unilateral y lo puede hacer cualquiera de los dos
(`desvincularAlumno()` / `dejarEntrenador()`) — nadie tiene que pedir permiso
para dejar de entrenar con alguien. Esas tres funciones son las únicas que
tocan `users.coach_id`.

**Desvincular no toca el plan.** Se corta el vínculo y nada más: el alumno
sigue con su plan en marcha en vez de quedarse a mitad de programa sin nada que
entrenar. `assignments` tampoco se limpia — es historial, y ahí consta quién
asignó qué aunque esa persona ya no lo entrene. Ojo con esto: `getPlanActivo()`
lee de `assignments`, no de `users.coach_id`, así que seguirá diciendo "asignada
por Fulano". Es cierto: Fulano la asignó. Si quiere otra cosa, tiene
`usarComoMiPlan()`.

El canje es un `UPDATE … WHERE used_at IS NULL`, y esa condición es lo que
resuelve la carrera: si dos personas canjean el mismo código a la vez, el
segundo UPDATE no toca ninguna fila y se lleva el error. Comprobar antes con un
SELECT no cierra la ventana entre leer y escribir.

**El rol `admin` no se reparte desde la app.** Se pone a mano en la base. Y un
admin no puede cambiar su propio rol ni desactivarse: como no hay otro camino a
admin, degradarse a uno mismo puede dejar la instalación sin nadie capaz de
repartir roles. `cambiarRol()` también se niega a degradar a un entrenador que
todavía tenga alumnos: hay que soltarlos primero desde `/coach`, para que sea
él quien decida qué pasa con cada uno.

**`assignments` es la única fuente de "cuál es mi plan".** De ahí salen el
próximo día, la home, la adherencia y la semana en curso. `coach_id NULL`
significa una cosa concreta: **se lo asignó el propio alumno**
(`usarComoMiPlan()`). Un plan propio no se marca poniéndose uno de entrenador —
lo impide el CHECK `assignments_coach_no_self`, porque si se admitieran las dos
formas el panel de entrenador contaría gente como alumna de sí misma.

Crear una rutina no la convierte en plan: hace falta la fila en `assignments`.
Sin ella la rutina existe y se puede entrenar desde `/rutinas/[id]`, pero
`/entrenar` y la home salen vacías.

**Entrenar un día se comprueba contra quién sos.** `empezarSesion()` recibe un
`routineDayId` y es una server action: el argumento lo elige quien la invoca, no
la pantalla. `diaEntrenable()` solo lo acepta si la rutina es tuya o la tenés
asignada y viva. Sin eso se podía abrir una sesión sobre la rutina de otro, y
`set_logs` se materializaba con sus ejercicios y sus cargas planificadas.

**Un alumno, un plan vivo.** `asignarRutina()` cierra la asignación anterior
(`ended_on = current_date`) e inserta la nueva en la misma transacción. El
índice único solo impide repetir la *misma* rutina viva, así que sin ese cierre
el alumno acabaría con dos planes abiertos y `getPlanActivo()` eligiendo por
`started_on` — arbitrariamente si coinciden el mismo día. Cerrar no borra nada:
el historial cuelga de las sesiones, no de la asignación.

**El editor no escribe nada hasta "Guardar".** Añadir y quitar ejercicios,
crear y borrar días, reordenar y ajustar: todo se acumula en el estado de
`editor-client.tsx` y sale de una vez por `guardarRutina()`, en una sola
transacción. Así "Cancelar" descarta de verdad.

Iba a dos velocidades —la estructura al servidor en el acto, los ajustes al
guardar— y era un bug con forma de diseño: quitabas un ejercicio, pulsabas
"Cancelar" y seguía borrado. El motivo de entonces (hacían falta los ids que
genera la base) **solo valía para las altas**, no para las bajas.

**Los ids de lo nuevo los pone el cliente**, con `crypto.randomUUID()`. Las
columnas son `uuid` y aceptan uno hecho, así que el editor puede indexar su
estado local sin haber hablado con el servidor. `nuevo: true` marca lo que hay
que insertar; `ejerciciosBorrados` / `diasBorrados`, lo que hay que borrar. Lo
que se añadió y se quitó sin guardar no aparece en ninguna de las dos listas:
nunca existió en la base.

**Todo el estado editable vive dentro de `dias`**, no en variables sueltas para
el día abierto. Si el descanso, el orden o las notas colgaran del día actual,
cambiar de pestaña y volver los perdería — que es justo lo que pasaba antes.

**Al guardar se reescriben los `orden` en dos pasadas**, desplazados por encima
del máximo antes de asentarlos. `(routine_day_id, orden)` y `(routine_id,
orden)` son únicos y no admiten estados intermedios: sin la pasada de arriba,
mover el primero al segundo puesto choca contra el índice.

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
db/01_schema.sql              tablas, tipos, índices, vistas, funciones, trigger y políticas
db/02_….sql                   migraciones, numeradas de 02 a 98 (la 09 abre el catálogo al admin, la 11 trae los alias)
db/99_seed.sql                datos del prototipo (lleva los enlaces al catálogo externo)
db/enlaces-fedb.tsv           el matcheo español→inglés, curado a mano
db/fedb-catalogo.json         copia recortada de free-exercise-db (no baja al navegador)
scripts/generar-enlaces-fedb.mjs  de ese TSV sale el SQL de la 08 y del seed
public/musculos/              los SVG de wger, copiados para que el SW los cachee
src/proxy.ts                  refresca el token y corta el paso sin sesión (Edge)
src/app/layout.tsx            solo el documento — no lee la sesión, ver Auth
src/app/login/               entrar y crear cuenta (fuera del grupo (app))
src/app/offline/page.tsx      último recurso del service worker (estática)
src/app/(app)/layout.tsx      cabecera, shell y pestañas; exige sesión
src/app/(app)/*/page.tsx      una pantalla por ruta, Server Components
src/app/(app)/ejercicios/[id]/  detalle: foto grande y diagrama de musculos
src/app/(app)/ejercicios/alias-ejercicio.tsx  "mi nombre" para un ejercicio
src/app/(app)/*/loading.tsx   esqueleto de esa pantalla, con su misma rejilla
src/app/(app)/coach/invitaciones.tsx  códigos que reparte el entrenador
src/app/(app)/coach/canjear.tsx       donde el alumno canjea, y se va
src/app/(app)/coach/desvincular-alumno.tsx  el entrenador suelta a un alumno
src/app/(app)/rutinas/[id]/usar-como-mi-plan.tsx  activar una rutina propia como plan
src/app/(app)/admin/          roles y alta/baja de usuarios (solo admin)
src/app/actions.ts            TODAS las mutaciones, sesión incluida
src/app/(app)/entrenar/[sesionId]/session-client.tsx   la pieza compleja: cola offline
src/components/skeleton.tsx   piezas de los loading.tsx
src/components/exercise-form.tsx  alta de ejercicio, compartida por biblioteca y editor
src/components/exercise-name.tsx    el alias arriba y el nombre del catálogo debajo
src/components/exercise-photo.tsx   las dos fotos del movimiento, alternándose
src/components/muscle-diagram.tsx   músculos trabajados sobre las siluetas
src/components/sw-register.tsx  registra el SW (solo en producción)
public/sw.js                  caché de shell, sin build step
src/db/queries.ts             una función de lectura por bloque de pantalla
src/lib/auth.ts               punto único de acoplamiento con la autenticación
src/lib/supabase/server.ts    cliente de Supabase atado a las cookies (solo auth)
src/lib/format.ts             formato es-ES
src/lib/ejercicios-externos.ts  único sitio que sabe dónde viven fotos y diagramas
src/lib/catalogo-externo.ts   el catálogo de free-exercise-db en memoria (¡solo servidor!)
src/lib/catalogo-glosario.ts  glosario es→en y puntuación; lo comparte el script
```

## Auth

Supabase Auth, el mismo proveedor y las mismas cuentas que `tempo_mobile`.

**Ninguna pantalla lee el usuario de otro sitio que `src/lib/auth.ts`.** Dos
funciones y hay que elegir bien:

- `getCurrentUser()` — el perfil, o corta y manda a `/login`. Es la de las
  pantallas.
- `getOptionalUser()` — el perfil o `null`, sin redirigir. Solo para lo que se
  pinta *antes* de saber si hay sesión; si `/login` llamara a la otra, entraría
  en bucle.

Siempre `supabase.auth.getUser()`, nunca `getSession()`: `getSession()` se cree
lo que traiga la cookie, y la cookie la controla el cliente.

**Supabase solo dice quién sos.** Los datos se siguen leyendo por Drizzle con
`DATABASE_URL`, que entra con el rol dueño y salta RLS. Por eso las server
actions verifican a mano que la fila es del usuario actual — seguí haciéndolo
en las nuevas.

**La identidad y el perfil son dos filas.** `auth.users` (de Supabase) y
`public.users` (nuestra), unidas por `users.auth_id`. Quien las une es el
trigger `on_auth_user_created`, no la app: duplicar ese INSERT en el alta
dejaría cuentas a medias si falla la segunda escritura. El trigger hace
`ON CONFLICT (email) DO UPDATE`, así que registrarse con el email de una fila
que ya existía la adopta en vez de fallar — es como los usuarios del seed
consiguieron cuenta. Ojo: ese UPDATE pisa `role` con lo que venga en
`raw_user_meta_data`, así que para dar de alta a un entrenador hay que mandarlo
en el `data` del signUp.

**El chrome cuelga del grupo `(app)`.** El layout raíz no lee la sesión a
propósito: tocar cookies ahí volvería dinámica toda la app, y con ella
`/offline`, que es la pantalla que se sirve cuando no hay red y no puede
depender ni de la base ni de que el servidor conteste. `/login` y `/offline`
viven fuera del grupo; el resto, dentro, y su layout exige sesión.

El guard vive en dos sitios a propósito: `src/proxy.ts` corta antes de
renderizar, y `(app)/layout.tsx` lo garantiza si alguien toca el `matcher`.
`proxy.ts` corre en Edge — ahí no entra ni Drizzle ni `pg`, así que sabe si hay
sesión pero no quién es. El rol lo comprueba cada pantalla.

**El rol no se lee del JWT.** Supabase lo copia en `user_metadata` al
registrarse y no lo vuelve a tocar: si un admin cambia el rol en `users`, el
token sigue diciendo el viejo hasta que la persona vuelva a entrar. La fuente
es la fila de `users`, siempre.

**`notFound()` sale con HTTP 200 y el cuerpo del 404.** Es cómo Next 16 hace
streaming: cuando la página llega a `notFound()` las cabeceras ya salieron.
Pasa en toda la app (`/rutinas/[id]`, `/admin`…). El contenido sí es el
correcto y no se filtra nada, pero **no confíes en el código de estado para
comprobar permisos en un test** — comprobá el cuerpo.

## Pendiente

Por orden de valor:

1. **Subir una foto propia.** Enlazar al catálogo externo ya se puede desde el
   formulario, pero `imagen_url` —la foto propia, que pisa a la del catálogo—
   sigue sin tener por dónde entrar. Es lo que hace falta para los ejercicios
   que no existen en ningún dataset.
2. **Las fotos a Supabase Storage.** Hoy van hotlinkeadas a jsDelivr y el
   service worker no cachea lo que no es del propio origen, así que **en el
   gimnasio sin cobertura no cargan** — justo donde más falta hacen. Solo hay
   que bajar las de los ejercicios enlazados (~65 × 2 ≈ 10 MB, no los 120 MB
   del dataset) y cambiar `BASE_FOTOS` en `src/lib/ejercicios-externos.ts`, que
   es el único sitio que arma esas URLs. Hace falta una service-role key nueva.
3. **Filtros de rutinas por tipo** (Fuerza / Hipertrofia): hace falta una
   columna de etiquetas, hoy el filtro es por estado.
4. **Navegación offline entre pantallas.** El service worker guarda documentos,
   pero los payloads RSC van siempre a red: sin cobertura, tocar un enlace cae
   en navegación completa contra el caché. Funciona, pero parpadea.
5. **Invitaciones en el móvil.** El canje solo existe en el web. `coach_invites`
   tiene RLS y políticas para que el entrenador vea las suyas, pero el canje no
   tiene política a propósito: leer la fila de otro dejaría enumerar códigos
   ajenos desde el navegador. Cuando el móvil lo necesite, va como función
   `SECURITY DEFINER`, no como política.
6. **Traspasar alumnos entre entrenadores.** Hoy soltar y volver a vincular son
   dos pasos con un código de por medio; no hay forma de pasarle un alumno a un
   colega de una vez.

## Al terminar un cambio

Corré `npm run typecheck` y `npm run build`. Si tocaste SQL, corré también
`npm run db:reset` y comprobá que el seed entra limpio — **contra una base
desechable, nunca contra la de Supabase, que la comparte el móvil**. Si el
cambio lleva migración, probala además contra una copia con datos —`pg_dump` a
una base desechable y `db:migrate` encima— y corrésela dos veces seguidas.

Si tocaste rutas, mirá la tabla del build: `/offline` tiene que seguir saliendo
como `○ (Static)`. Si aparece como `ƒ`, algo metió cookies o cabeceras en el
layout raíz y la pantalla de "sin conexión" pasó a depender del servidor.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
