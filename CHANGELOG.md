# Changelog — Tempo (web)

Lo que trae cada versión publicada del web. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y la numeración,
[SemVer](https://semver.org/lang/es/). El móvil lleva su propia numeración en
`tempo_mobile/CHANGELOG.md`.

## [Sin publicar]

## [0.1.0] — 2026-09-17

Primera versión numerada: recoge todo lo construido hasta hoy.

### Alumno

- Home con el plan activo, el próximo día, la semana en curso y la adherencia.
- Sesión de entrenamiento que escribe primero en local: cola en `localStorage`
  con reintento al volver la red, cronómetro y descanso derivados de marcas
  absolutas.
- Series por repeticiones o por tiempo, y repeticiones por serie en el plan
  (`15/12/10`, rangos `8-12`).
- Progreso por ejercicio, volumen semanal y marcas personales.
- Historial con corrección y borrado de entrenamientos; corregir rehace las
  marcas de esa sesión.
- Rutinas propias y "Usar como mi plan".

### Entrenador

- Editor de rutinas que no escribe nada hasta "Guardar", en una sola
  transacción.
- Asignar rutinas a alumnos (un plan vivo por alumno) y panel de adherencia.
- Vinculación por código de invitación; desvincular desde cualquiera de los dos
  lados sin tocar el plan.

### Catálogo de ejercicios

- Parte común y parte privada por usuario; el común solo lo edita un admin.
- Fotos de free-exercise-db y diagramas musculares de wger, enlazados desde el
  formulario de alta.
- Alias por persona, con el nombre del catálogo siempre visible debajo.

### Admin

- Roles y alta/baja de usuarios.

### Plataforma

- Supabase Auth, con las mismas cuentas que el móvil.
- RLS con políticas por usuario en todas las tablas.
- Service worker con caché de shell y pantalla `/offline`.
- La versión se ve al pie de todas las pantallas con sesión.

### Base de datos

- Esquema hasta `db/12_frecuencia_cardiaca.sql`: `workout_sessions` guarda
  `fc_promedio` y `fc_maxima`, que escribe el móvil al terminar la sesión.

[Sin publicar]: https://github.com/sanref/tempo/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sanref/tempo/tree/v0.1.0
