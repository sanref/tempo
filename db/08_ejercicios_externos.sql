-- ═══════════════════════════════════════════════════════════════════════════
-- 08 — Fotos del movimiento y músculos trabajados
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/08_ejercicios_externos.sql
--   (o `npm run db:migrate`, que corre todos los 0N_ en orden)
--
-- Lleva una base ya creada al esquema de 01_schema.sql. En una base nueva
-- 01_schema.sql ya trae las columnas, así que solo quedan los UPDATE.
--
-- Es idempotente: `ADD COLUMN IF NOT EXISTS` no se queja si ya está, y cada
-- UPDATE lleva `fedb_id IS NULL`, así que en la segunda pasada no toca ninguna
-- fila. Esa condición también protege la curación posterior: si alguien
-- reenlaza un ejercicio a mano, correr la migración otra vez no se lo pisa.
--
-- Qué resuelve:
--
--   El catálogo no tenía con qué enseñar los ejercicios. `imagen_url` existía
--   desde el principio pero nunca se escribió ni se pintó, así que la
--   biblioteca era una lista de nombres: quien no conocía el movimiento no
--   tenía de dónde sacarlo.
--
--   Las fotos salen de free-exercise-db (dominio público): 873 ejercicios con
--   dos fotos cada uno, inicio y final del movimiento. Los diagramas de
--   músculos salen de wger (CC-BY-SA 3.0), que tiene los SVG que a la otra le
--   faltan. Ninguna de las dos servía sola.
--
--   Se guarda el enlace (`fedb_id`), no las URLs: de él salen las dos fotos
--   —sus rutas son siempre '{fedb_id}/N.jpg'— y sirve para reenlazar o migrar
--   a otro alojamiento sin volver a tocar los datos.
--
-- Los UPDATE de abajo están generados, no escritos a mano:
--
--   node scripts/generar-enlaces-fedb.mjs
--
-- a partir de `db/enlaces-fedb.tsv` (el enlace curado a mano) y de
-- `db/fedb-catalogo.json` (la copia recortada del catálogo). Para cambiarlos
-- se edita el TSV y se regenera; editar este archivo a pelo se pierde.
--
-- Cuatro de los 69 ejercicios del catálogo se quedan sin enlazar a propósito
-- porque no existen en ningún dataset inglés: son movimientos locales o
-- inventados. Se quedan con "Imagen pendiente", que es la respuesta correcta —
-- enlazarlos a algo parecido enseñaría el movimiento equivocado.
--
-- Sin cambios de RLS: las políticas de `exercises` (01_schema.sql) no enumeran
-- columnas, así que las nuevas quedan cubiertas solas.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public;

-- ── Columnas ───────────────────────────────────────────────────────────────

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS fedb_id              text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS nombre_en            text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS musculos_primarios   text[];
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS musculos_secundarios text[];

COMMENT ON COLUMN exercises.fedb_id IS
  'Id en free-exercise-db; de él salen las fotos ({fedb_id}/0.jpg y /1.jpg).';
COMMENT ON COLUMN exercises.nombre_en IS
  'Nombre en inglés. No se deriva de fedb_id: 35 de 873 pierden puntuación.';
COMMENT ON COLUMN exercises.musculos_primarios IS
  'Léxico de free-exercise-db (17 valores, en inglés). Clave del diagrama.';

-- ── Enlaces del catálogo público ───────────────────────────────────────────

-- >>> generado por scripts/generar-enlaces-fedb.mjs

-- 65 enlazados; 4 sin equivalente en inglés,
-- que se quedan sin foto a propósito:
--   · Bridge 3 apoyo inferior
--   · AMI - Glúteos 1 pierna 3 apoyos
--   · Elevación de pierna alternativa en plancha
--   · Flexión de cadera en plancha lateral

UPDATE exercises SET fedb_id = 'Barbell_Bench_Press_-_Medium_Grip',
                     nombre_en = 'Barbell Bench Press - Medium Grip',
                     musculos_primarios = '{"chest"}',
                     musculos_secundarios = '{"shoulders","triceps"}'
 WHERE lower(nombre) = 'press banca'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Barbell_Incline_Bench_Press_-_Medium_Grip',
                     nombre_en = 'Barbell Incline Bench Press - Medium Grip',
                     musculos_primarios = '{"chest"}',
                     musculos_secundarios = '{"shoulders","triceps"}'
 WHERE lower(nombre) = 'press banca inclinado'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Incline_Dumbbell_Press',
                     nombre_en = 'Incline Dumbbell Press',
                     musculos_primarios = '{"chest"}',
                     musculos_secundarios = '{"shoulders","triceps"}'
 WHERE lower(nombre) = 'press inclinado mancuernas'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Dumbbell_Bench_Press',
                     nombre_en = 'Dumbbell Bench Press',
                     musculos_primarios = '{"chest"}',
                     musculos_secundarios = '{"shoulders","triceps"}'
 WHERE lower(nombre) = 'press banca con mancuernas'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Decline_Barbell_Bench_Press',
                     nombre_en = 'Decline Barbell Bench Press',
                     musculos_primarios = '{"chest"}',
                     musculos_secundarios = '{"shoulders","triceps"}'
 WHERE lower(nombre) = 'press declinado'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Flat_Bench_Cable_Flyes',
                     nombre_en = 'Flat Bench Cable Flyes',
                     musculos_primarios = '{"chest"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'aperturas en polea'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Cable_Crossover',
                     nombre_en = 'Cable Crossover',
                     musculos_primarios = '{"chest"}',
                     musculos_secundarios = '{"shoulders"}'
 WHERE lower(nombre) = 'cruce de poleas'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Butterfly',
                     nombre_en = 'Butterfly',
                     musculos_primarios = '{"chest"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'pec deck'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Dips_-_Chest_Version',
                     nombre_en = 'Dips - Chest Version',
                     musculos_primarios = '{"chest"}',
                     musculos_secundarios = '{"shoulders","triceps"}'
 WHERE lower(nombre) = 'fondos en paralelas'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Incline_Dumbbell_Flyes',
                     nombre_en = 'Incline Dumbbell Flyes',
                     musculos_primarios = '{"chest"}',
                     musculos_secundarios = '{"shoulders"}'
 WHERE lower(nombre) = 'aperturas inclinadas con mancuernas'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Barbell_Deadlift',
                     nombre_en = 'Barbell Deadlift',
                     musculos_primarios = '{"lower back"}',
                     musculos_secundarios = '{"calves","forearms","glutes","hamstrings","lats","middle back","quadriceps","traps"}'
 WHERE lower(nombre) = 'peso muerto'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Romanian_Deadlift',
                     nombre_en = 'Romanian Deadlift',
                     musculos_primarios = '{"hamstrings"}',
                     musculos_secundarios = '{"calves","glutes","lower back"}'
 WHERE lower(nombre) = 'peso muerto rumano'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Sumo_Deadlift',
                     nombre_en = 'Sumo Deadlift',
                     musculos_primarios = '{"hamstrings"}',
                     musculos_secundarios = '{"adductors","forearms","glutes","lower back","middle back","quadriceps","traps"}'
 WHERE lower(nombre) = 'peso muerto sumo'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Pullups',
                     nombre_en = 'Pullups',
                     musculos_primarios = '{"lats"}',
                     musculos_secundarios = '{"biceps","middle back"}'
 WHERE lower(nombre) = 'dominadas'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Weighted_Pull_Ups',
                     nombre_en = 'Weighted Pull Ups',
                     musculos_primarios = '{"lats"}',
                     musculos_secundarios = '{"biceps","middle back"}'
 WHERE lower(nombre) = 'dominadas lastradas'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Bent_Over_Barbell_Row',
                     nombre_en = 'Bent Over Barbell Row',
                     musculos_primarios = '{"middle back"}',
                     musculos_secundarios = '{"biceps","lats","shoulders"}'
 WHERE lower(nombre) = 'remo con barra'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'T-Bar_Row_with_Handle',
                     nombre_en = 'T-Bar Row with Handle',
                     musculos_primarios = '{"middle back"}',
                     musculos_secundarios = '{"biceps","lats"}'
 WHERE lower(nombre) = 'remo en t'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Bent_Over_Barbell_Row',
                     nombre_en = 'Bent Over Barbell Row',
                     musculos_primarios = '{"middle back"}',
                     musculos_secundarios = '{"biceps","lats","shoulders"}'
 WHERE lower(nombre) = 'remo pendlay'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'One-Arm_Dumbbell_Row',
                     nombre_en = 'One-Arm Dumbbell Row',
                     musculos_primarios = '{"middle back"}',
                     musculos_secundarios = '{"biceps","lats","shoulders"}'
 WHERE lower(nombre) = 'remo con mancuerna'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Seated_Cable_Rows',
                     nombre_en = 'Seated Cable Rows',
                     musculos_primarios = '{"middle back"}',
                     musculos_secundarios = '{"biceps","lats","shoulders"}'
 WHERE lower(nombre) = 'remo sentado en polea'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Wide-Grip_Lat_Pulldown',
                     nombre_en = 'Wide-Grip Lat Pulldown',
                     musculos_primarios = '{"lats"}',
                     musculos_secundarios = '{"biceps","middle back","shoulders"}'
 WHERE lower(nombre) = 'jalón al pecho'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Straight-Arm_Pulldown',
                     nombre_en = 'Straight-Arm Pulldown',
                     musculos_primarios = '{"lats"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'pull-over en polea'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Barbell_Squat',
                     nombre_en = 'Barbell Squat',
                     musculos_primarios = '{"quadriceps"}',
                     musculos_secundarios = '{"calves","glutes","hamstrings","lower back"}'
 WHERE lower(nombre) = 'sentadilla trasera'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Front_Barbell_Squat',
                     nombre_en = 'Front Barbell Squat',
                     musculos_primarios = '{"quadriceps"}',
                     musculos_secundarios = '{"calves","glutes","hamstrings"}'
 WHERE lower(nombre) = 'sentadilla frontal'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Split_Squat_with_Dumbbells',
                     nombre_en = 'Split Squat with Dumbbells',
                     musculos_primarios = '{"quadriceps"}',
                     musculos_secundarios = '{"glutes","hamstrings"}'
 WHERE lower(nombre) = 'sentadilla búlgara'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Leg_Press',
                     nombre_en = 'Leg Press',
                     musculos_primarios = '{"quadriceps"}',
                     musculos_secundarios = '{"calves","glutes","hamstrings"}'
 WHERE lower(nombre) = 'prensa 45°'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Leg_Extensions',
                     nombre_en = 'Leg Extensions',
                     musculos_primarios = '{"quadriceps"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'extensión de cuádriceps'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Lying_Leg_Curls',
                     nombre_en = 'Lying Leg Curls',
                     musculos_primarios = '{"hamstrings"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'curl femoral tumbado'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Seated_Leg_Curl',
                     nombre_en = 'Seated Leg Curl',
                     musculos_primarios = '{"hamstrings"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'curl femoral sentado'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Thigh_Abductor',
                     nombre_en = 'Thigh Abductor',
                     musculos_primarios = '{"abductors"}',
                     musculos_secundarios = '{"glutes"}'
 WHERE lower(nombre) = 'abducción de cadera'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Dumbbell_Lunges',
                     nombre_en = 'Dumbbell Lunges',
                     musculos_primarios = '{"quadriceps"}',
                     musculos_secundarios = '{"calves","glutes","hamstrings"}'
 WHERE lower(nombre) = 'zancadas con mancuernas'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Kettlebell_One-Legged_Deadlift',
                     nombre_en = 'Kettlebell One-Legged Deadlift',
                     musculos_primarios = '{"hamstrings"}',
                     musculos_secundarios = '{"glutes","lower back"}'
 WHERE lower(nombre) = 'peso muerto a una pierna'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Standing_Calf_Raises',
                     nombre_en = 'Standing Calf Raises',
                     musculos_primarios = '{"calves"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'elevación de gemelo'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Barbell_Hip_Thrust',
                     nombre_en = 'Barbell Hip Thrust',
                     musculos_primarios = '{"glutes"}',
                     musculos_secundarios = '{"calves","hamstrings"}'
 WHERE lower(nombre) = 'hip thrust'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Standing_Military_Press',
                     nombre_en = 'Standing Military Press',
                     musculos_primarios = '{"shoulders"}',
                     musculos_secundarios = '{"triceps"}'
 WHERE lower(nombre) = 'press militar'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Dumbbell_Shoulder_Press',
                     nombre_en = 'Dumbbell Shoulder Press',
                     musculos_primarios = '{"shoulders"}',
                     musculos_secundarios = '{"triceps"}'
 WHERE lower(nombre) = 'press militar con mancuernas'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Arnold_Dumbbell_Press',
                     nombre_en = 'Arnold Dumbbell Press',
                     musculos_primarios = '{"shoulders"}',
                     musculos_secundarios = '{"triceps"}'
 WHERE lower(nombre) = 'press arnold'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Side_Lateral_Raise',
                     nombre_en = 'Side Lateral Raise',
                     musculos_primarios = '{"shoulders"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'elevaciones laterales'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Front_Dumbbell_Raise',
                     nombre_en = 'Front Dumbbell Raise',
                     musculos_primarios = '{"shoulders"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'elevación frontal'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Seated_Bent-Over_Rear_Delt_Raise',
                     nombre_en = 'Seated Bent-Over Rear Delt Raise',
                     musculos_primarios = '{"shoulders"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'elevación posterior (pájaros)'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Face_Pull',
                     nombre_en = 'Face Pull',
                     musculos_primarios = '{"shoulders"}',
                     musculos_secundarios = '{"middle back"}'
 WHERE lower(nombre) = 'face pull'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'EZ-Bar_Curl',
                     nombre_en = 'EZ-Bar Curl',
                     musculos_primarios = '{"biceps"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'curl con barra z'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Dumbbell_Bicep_Curl',
                     nombre_en = 'Dumbbell Bicep Curl',
                     musculos_primarios = '{"biceps"}',
                     musculos_secundarios = '{"forearms"}'
 WHERE lower(nombre) = 'curl de bíceps con mancuernas'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Hammer_Curls',
                     nombre_en = 'Hammer Curls',
                     musculos_primarios = '{"biceps"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'curl martillo'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Concentration_Curls',
                     nombre_en = 'Concentration Curls',
                     musculos_primarios = '{"biceps"}',
                     musculos_secundarios = '{"forearms"}'
 WHERE lower(nombre) = 'curl concentrado'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Triceps_Pushdown',
                     nombre_en = 'Triceps Pushdown',
                     musculos_primarios = '{"triceps"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'extensión tríceps en polea'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Lying_Triceps_Press',
                     nombre_en = 'Lying Triceps Press',
                     musculos_primarios = '{"triceps"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'press francés'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Cable_Lying_Triceps_Extension',
                     nombre_en = 'Cable Lying Triceps Extension',
                     musculos_primarios = '{"triceps"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'press francés en polea'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Bench_Dips',
                     nombre_en = 'Bench Dips',
                     musculos_primarios = '{"triceps"}',
                     musculos_secundarios = '{"chest","shoulders"}'
 WHERE lower(nombre) = 'fondos en banco'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Tricep_Dumbbell_Kickback',
                     nombre_en = 'Tricep Dumbbell Kickback',
                     musculos_primarios = '{"triceps"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'patada de tríceps'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Preacher_Curl',
                     nombre_en = 'Preacher Curl',
                     musculos_primarios = '{"biceps"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'curl bíceps en banco scott'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Plank',
                     nombre_en = 'Plank',
                     musculos_primarios = '{"abdominals"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'plancha con lastre'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Ab_Roller',
                     nombre_en = 'Ab Roller',
                     musculos_primarios = '{"abdominals"}',
                     musculos_secundarios = '{"shoulders"}'
 WHERE lower(nombre) = 'rueda abdominal'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Cable_Crunch',
                     nombre_en = 'Cable Crunch',
                     musculos_primarios = '{"abdominals"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'crunch en polea'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Hanging_Leg_Raise',
                     nombre_en = 'Hanging Leg Raise',
                     musculos_primarios = '{"abdominals"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'elevación de piernas colgado'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Russian_Twist',
                     nombre_en = 'Russian Twist',
                     musculos_primarios = '{"abdominals"}',
                     musculos_secundarios = '{"lower back"}'
 WHERE lower(nombre) = 'russian twist'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Ab_Crunch_Machine',
                     nombre_en = 'Ab Crunch Machine',
                     musculos_primarios = '{"abdominals"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'abdominales en máquina'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Crunch_-_Hands_Overhead',
                     nombre_en = 'Crunch - Hands Overhead',
                     musculos_primarios = '{"abdominals"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'crunch abdominal con carga por encima de la cabeza'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Crunches',
                     nombre_en = 'Crunches',
                     musculos_primarios = '{"abdominals"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'encogimiento abdominal'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Mountain_Climbers',
                     nombre_en = 'Mountain Climbers',
                     musculos_primarios = '{"quadriceps"}',
                     musculos_secundarios = '{"chest","hamstrings","shoulders"}'
 WHERE lower(nombre) = 'escalador'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Crunches',
                     nombre_en = 'Crunches',
                     musculos_primarios = '{"abdominals"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'crunch con piernas elevadas'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Barbell_Shrug',
                     nombre_en = 'Barbell Shrug',
                     musculos_primarios = '{"traps"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'encogimientos con barra'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Dumbbell_Shrug',
                     nombre_en = 'Dumbbell Shrug',
                     musculos_primarios = '{"traps"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'encogimientos con mancuernas'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Seated_Palm-Up_Barbell_Wrist_Curl',
                     nombre_en = 'Seated Palm-Up Barbell Wrist Curl',
                     musculos_primarios = '{"forearms"}',
                     musculos_secundarios = null
 WHERE lower(nombre) = 'curl de muñeca'
   AND es_publico AND fedb_id IS NULL;

UPDATE exercises SET fedb_id = 'Farmers_Walk',
                     nombre_en = 'Farmer''s Walk',
                     musculos_primarios = '{"forearms"}',
                     musculos_secundarios = '{"abdominals","glutes","hamstrings","lower back","quadriceps","traps"}'
 WHERE lower(nombre) = 'farmer walk'
   AND es_publico AND fedb_id IS NULL;

-- <<< generado

-- Comprobación rápida: cuántos quedaron enlazados y cuántos siguen sin foto.
SELECT count(*) FILTER (WHERE fedb_id IS NOT NULL) AS enlazados,
       count(*) FILTER (WHERE fedb_id IS NULL)     AS sin_enlazar
  FROM exercises WHERE es_publico;
