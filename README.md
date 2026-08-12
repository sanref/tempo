# Tempo

App de planes de entrenamiento de gimnasio. Dos roles en un mismo producto: el
**alumno** sigue un plan y registra sus series desde el móvil, y el
**entrenador** crea rutinas, las asigna y vigila la adherencia.

Implementación del handoff de diseño *Tempo — Modernist*, en alta fidelidad.

## Stack

| Capa | Elección | Por qué |
| --- | --- | --- |
| Frontend + backend | Next.js 16 (App Router) + TypeScript | Un solo proyecto; Server Components para leer y Server Actions para escribir. Sin API REST intermedia. |
| Estilos | CSS plano con los tokens del design system | El sistema Modernist ya es CSS con variables. Meterlo en Tailwind sería traducirlo dos veces. |
| Base de datos | PostgreSQL | Los datos son relacionales y las consultas de progreso son agregaciones sobre series. |
| ORM | Drizzle | Tipos desde el esquema, y `sql` crudo cuando la consulta lo pide (que aquí pasa a menudo). |
| Iconos | Lucide | Lo que prescribe el design system. |
| Auth | **pendiente** — sesión mockeada en `src/lib/auth.ts` | Ver *Enchufar autenticación*. |

## Puesta en marcha

```bash
# 1. Dependencias
#    Hay un node_modules a medio instalar de cuando se montó el proyecto:
#    borralo antes para que npm resuelva las versiones limpias.
rmdir /s /q node_modules      # PowerShell: Remove-Item -Recurse -Force node_modules
npm install

# 2. Configuración
cp .env.example .env        # en Windows: copy .env.example .env
#    editá DATABASE_URL con tu Postgres local

# 3. Base de datos
createdb tempo              # o creala desde pgAdmin
npm run db:create           # esquema, funciones y vistas
npm run db:seed             # datos del prototipo: 12 semanas de historial

# 4. A correr
npm run dev                 # http://localhost:3000
```

`npm run db:reset` rehace todo desde cero (destructivo).

Los scripts llaman a `psql`; si no lo tenés en el PATH, abrí los archivos de
`db/` en pgAdmin y ejecutalos en orden.

## Cómo está organizado

```
db/
  00_reset.sql        Borra el schema `tempo` entero
  01_schema.sql       Tablas, tipos, índices, vistas y funciones ← fuente de la verdad
  02_seed.sql         Datos del prototipo, generados relativos a now()
src/
  app/
    layout.tsx        Cabecera, shell y barra de pestañas
    page.tsx          Inicio
    actions.ts        Todas las mutaciones (Server Actions)
    rutinas/          Listado · detalle · editor
    entrenar/         Antesala + sesión en curso
    historial/  progreso/  ejercicios/  coach/
    design-system.css Modernist portado tal cual — tokens y componentes
    app.css           Capa de Tempo, solo var(--…)
  components/         Piezas compartidas (StatStrip, gráficos, navegación)
  db/
    schema.ts         Espejo en Drizzle de 01_schema.sql
    queries.ts        Una función de lectura por bloque de pantalla
    index.ts          Pool perezoso
  lib/
    auth.ts           Punto único de acoplamiento con la autenticación
    format.ts         Formato es-ES: coma decimal, punto de millar
```

### El SQL manda

`db/01_schema.sql` es la fuente de la verdad y `src/db/schema.ts` es su espejo
en Drizzle. Si tocás uno, tocá el otro. Cuando el proyecto tenga tráfico real,
pasá a migraciones con `drizzle-kit generate` y hacé que el SQL sea el
resultado, no el original.

Lo agregable pesado vive en la base, no en el servidor de Next:

| Función / vista | Para qué |
| --- | --- |
| `session_summaries` | Series, volumen, duración y si hubo PR — alimenta Historial |
| `volumen_semanal(user, n)` | Las doce barras de Inicio |
| `ultimas_series(user, ejercicio)` | La columna «Anterior» de la sesión |
| `adherencia(user, días)` | Sesiones hechas ÷ planificadas |
| `registrar_prs(sesión)` | Marcas nuevas al cerrar, por e1RM de Epley |

## Decisiones que conviene conocer

**El catálogo de ejercicios está separado de las rutinas.** Si el entrenador
escribiera el nombre a mano en cada rutina, «¿cómo progresé en press banca?»
sería imposible de responder. `set_logs` apunta a `exercises`, no a texto.

**Los cronómetros se derivan de marcas absolutas.** La sesión guarda
`started_at` y el reloj es `now() - started_at`. El descanso guarda su hora de
fin en `localStorage`. Nunca se acumulan ticks: en el gimnasio la pantalla se
apaga a mitad de serie y el tiempo tiene que seguir corriendo.

**La sesión escribe primero en local.** Cada cambio se aplica al estado del
cliente al instante, se apila en una cola persistida en `localStorage` y se
vacía contra el servidor con debounce. Si falla, la cola se queda y se
reintenta al recuperar red o al volver a la pestaña, avisando arriba. En el
subsuelo del gimnasio no hay cobertura y perder reps no es una opción.

**Las mutaciones nunca cuelgan de un GET.** Empezar un entrenamiento o crear
una rutina son `POST` a través de un `<form action={…}>`, no enlaces: Next
prefetchea los `<Link>` al pasar el ratón y acabaríamos creando filas fantasma.

**Solo una sesión en curso por usuario**, garantizado por un índice único
parcial. «Empezar» reanuda si ya hay una abierta.

**Progresión lineal automática.** Al cerrar una sesión, los ejercicios cuyas
series se completaron todas suben su carga objetivo según
`routine_days.incremento_kg`.

**El riesgo se marca sin color.** Adherencia por debajo del 65% pinta la barra
en gris apagado, no en un segundo tono: el sistema es monocromo a propósito.

**Móvil por breakpoint, no por conmutador.** El prototipo traía un selector
Escritorio/Móvil que era una herramienta del entorno de diseño. Aquí es CSS:
por debajo de 640px aparece la barra de pestañas inferior y desaparece la
navegación de la cabecera.

## Enchufar autenticación

Todo pasa por `getCurrentUser()` en `src/lib/auth.ts`, que hoy devuelve el
usuario de `MOCK_USER_ID`. Ninguna pantalla lee el usuario de otro sitio, así
que el cambio es local:

```ts
export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return db.query.users.findFirst({ where: eq(users.id, session.user.id) });
}
```

`users` ya tiene `role` y `coach_id`; añadí `auth_id text UNIQUE` apuntando a la
tabla de identidades del proveedor. Para probar la vista de entrenador,
cambiá `MOCK_USER_ID` a `22222222-2222-2222-2222-222222222222` (Laura Ferrán).

## Pendiente

- **Service worker.** El manifest ya está y la app es instalable, pero sin SW
  no hay caché de shell: en el gimnasio, una recarga sin red deja pantalla en
  blanco. Es el siguiente paso natural del registro offline.
- **Estados de carga.** Faltan los `loading.tsx` con esqueletos de lista.
- **Fotos de ejercicios.** La biblioteca pinta el placeholder del diseño;
  las imágenes reales van envueltas en `.grayscale`.
- **Editor:** añadir y quitar ejercicios desde la biblioteca (hoy solo
  reordena y ajusta series), y crear o borrar días.
- **Filtros de rutinas por tipo** (Fuerza / Hipertrofia) — hace falta una
  columna de etiquetas; hoy el filtro es por estado.
