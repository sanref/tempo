-- ═══════════════════════════════════════════════════════════════════════════
-- Tempo — datos semilla (los del prototipo de diseño).
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/99_seed.sql
--
-- Idempotente: se puede volver a correr, borra lo suyo y lo vuelve a insertar.
-- El historial se genera relativo a now(), así que las gráficas tienen sentido
-- se ejecute el día que se ejecute.
-- ═══════════════════════════════════════════════════════════════════════════

SET search_path TO public;

BEGIN;

TRUNCATE personal_records, set_logs, workout_sessions, assignments,
         routine_exercises, routine_days, routines, exercises, users
  RESTART IDENTITY CASCADE;

-- ── Usuarios ───────────────────────────────────────────────────────────────

INSERT INTO users (id, email, nombre, role, coach_id) VALUES
  ('22222222-2222-2222-2222-222222222222', 'laura@tempo.gym',  'Laura Ferrán',    'entrenador', NULL),
  ('11111111-1111-1111-1111-111111111111', 'marco@tempo.gym',  'Marco Duarte',    'alumno', '22222222-2222-2222-2222-222222222222');

-- ── Catálogo de ejercicios ─────────────────────────────────────────────────
-- 656 de free-exercise-db (nombre en inglés, tal como vienen) + 4 locales sin
-- equivalente en ningún dataset. Generado por scripts/generar-catalogo.mjs —
-- ver docs/plan-catalogo-free-exercise-db.md. Editar a mano se pierde en la
-- siguiente pasada; para cambiar el filtro o los mapeos se edita el script.

-- >>> generado por scripts/generar-catalogo.mjs

-- 656 de free-exercise-db (strength · powerlifting · olympic
-- weightlifting, más Mountain_Climbers y Farmers_Walk por lista explícita) +
-- 4 locales sin equivalente en ningún dataset.
INSERT INTO exercises (nombre, grupo, equipo, fedb_id, musculos_primarios, musculos_secundarios) VALUES
  ('3/4 Sit-Up', 'Core', 'Peso corporal', '3_4_Sit-Up', '{"abdominals"}', NULL),
  ('Ab Crunch Machine', 'Core', 'Máquina', 'Ab_Crunch_Machine', '{"abdominals"}', NULL),
  ('Ab Roller', 'Core', 'Otro', 'Ab_Roller', '{"abdominals"}', '{"shoulders"}'),
  ('Advanced Kettlebell Windmill', 'Core', 'Pesa rusa', 'Advanced_Kettlebell_Windmill', '{"abdominals"}', '{"glutes","hamstrings","shoulders"}'),
  ('Air Bike', 'Core', 'Peso corporal', 'Air_Bike', '{"abdominals"}', NULL),
  ('Alternate Hammer Curl', 'Brazo', 'Mancuernas', 'Alternate_Hammer_Curl', '{"biceps"}', '{"forearms"}'),
  ('Alternate Heel Touchers', 'Core', 'Peso corporal', 'Alternate_Heel_Touchers', '{"abdominals"}', NULL),
  ('Alternate Incline Dumbbell Curl', 'Brazo', 'Mancuernas', 'Alternate_Incline_Dumbbell_Curl', '{"biceps"}', '{"forearms"}'),
  ('Alternating Cable Shoulder Press', 'Hombro', 'Polea', 'Alternating_Cable_Shoulder_Press', '{"shoulders"}', '{"triceps"}'),
  ('Alternating Deltoid Raise', 'Hombro', 'Mancuernas', 'Alternating_Deltoid_Raise', '{"shoulders"}', NULL),
  ('Alternating Floor Press', 'Pecho', 'Pesa rusa', 'Alternating_Floor_Press', '{"chest"}', '{"abdominals","shoulders","triceps"}'),
  ('Alternating Hang Clean', 'Pierna', 'Pesa rusa', 'Alternating_Hang_Clean', '{"hamstrings"}', '{"biceps","calves","forearms","glutes","lower back","traps"}'),
  ('Alternating Kettlebell Press', 'Hombro', 'Pesa rusa', 'Alternating_Kettlebell_Press', '{"shoulders"}', '{"triceps"}'),
  ('Alternating Kettlebell Row', 'Espalda', 'Pesa rusa', 'Alternating_Kettlebell_Row', '{"middle back"}', '{"biceps","lats"}'),
  ('Alternating Renegade Row', 'Espalda', 'Pesa rusa', 'Alternating_Renegade_Row', '{"middle back"}', '{"abdominals","biceps","chest","lats","triceps"}'),
  ('Anti-Gravity Press', 'Hombro', 'Barra', 'Anti-Gravity_Press', '{"shoulders"}', '{"middle back","traps","triceps"}'),
  ('Arnold Dumbbell Press', 'Hombro', 'Mancuernas', 'Arnold_Dumbbell_Press', '{"shoulders"}', '{"triceps"}'),
  ('Around The Worlds', 'Pecho', 'Mancuernas', 'Around_The_Worlds', '{"chest"}', '{"shoulders"}'),
  ('Back Flyes - With Bands', 'Hombro', 'Banda elástica', 'Back_Flyes_-_With_Bands', '{"shoulders"}', '{"middle back","triceps"}'),
  ('Balance Board', 'Pierna', 'Otro', 'Balance_Board', '{"calves"}', '{"hamstrings","quadriceps"}'),
  ('Ball Leg Curl', 'Pierna', 'Fitball', 'Ball_Leg_Curl', '{"hamstrings"}', '{"calves","glutes"}'),
  ('Band Assisted Pull-Up', 'Espalda', 'Otro', 'Band_Assisted_Pull-Up', '{"lats"}', '{"abdominals","forearms","middle back"}'),
  ('Band Good Morning', 'Pierna', 'Banda elástica', 'Band_Good_Morning', '{"hamstrings"}', '{"glutes","lower back"}'),
  ('Band Good Morning (Pull Through)', 'Pierna', 'Banda elástica', 'Band_Good_Morning_Pull_Through', '{"hamstrings"}', '{"glutes","lower back"}'),
  ('Band Hip Adductions', 'Pierna', 'Banda elástica', 'Band_Hip_Adductions', '{"adductors"}', NULL),
  ('Band Pull Apart', 'Hombro', 'Banda elástica', 'Band_Pull_Apart', '{"shoulders"}', '{"middle back","traps"}'),
  ('Band Skull Crusher', 'Brazo', 'Banda elástica', 'Band_Skull_Crusher', '{"triceps"}', NULL),
  ('Barbell Ab Rollout', 'Core', 'Barra', 'Barbell_Ab_Rollout', '{"abdominals"}', '{"lower back","shoulders"}'),
  ('Barbell Ab Rollout - On Knees', 'Core', 'Barra', 'Barbell_Ab_Rollout_-_On_Knees', '{"abdominals"}', '{"lower back","shoulders"}'),
  ('Barbell Bench Press - Medium Grip', 'Pecho', 'Barra', 'Barbell_Bench_Press_-_Medium_Grip', '{"chest"}', '{"shoulders","triceps"}'),
  ('Barbell Curl', 'Brazo', 'Barra', 'Barbell_Curl', '{"biceps"}', '{"forearms"}'),
  ('Barbell Curls Lying Against An Incline', 'Brazo', 'Barra', 'Barbell_Curls_Lying_Against_An_Incline', '{"biceps"}', NULL),
  ('Barbell Deadlift', 'Espalda', 'Barra', 'Barbell_Deadlift', '{"lower back"}', '{"calves","forearms","glutes","hamstrings","lats","middle back","quadriceps","traps"}'),
  ('Barbell Full Squat', 'Pierna', 'Barra', 'Barbell_Full_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings","lower back"}'),
  ('Barbell Glute Bridge', 'Pierna', 'Barra', 'Barbell_Glute_Bridge', '{"glutes"}', '{"calves","hamstrings"}'),
  ('Barbell Guillotine Bench Press', 'Pecho', 'Barra', 'Barbell_Guillotine_Bench_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Barbell Hack Squat', 'Pierna', 'Barra', 'Barbell_Hack_Squat', '{"quadriceps"}', '{"calves","forearms","hamstrings"}'),
  ('Barbell Hip Thrust', 'Pierna', 'Barra', 'Barbell_Hip_Thrust', '{"glutes"}', '{"calves","hamstrings"}'),
  ('Barbell Incline Bench Press - Medium Grip', 'Pecho', 'Barra', 'Barbell_Incline_Bench_Press_-_Medium_Grip', '{"chest"}', '{"shoulders","triceps"}'),
  ('Barbell Incline Shoulder Raise', 'Hombro', 'Barra', 'Barbell_Incline_Shoulder_Raise', '{"shoulders"}', '{"chest"}'),
  ('Barbell Lunge', 'Pierna', 'Barra', 'Barbell_Lunge', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Barbell Rear Delt Row', 'Hombro', 'Barra', 'Barbell_Rear_Delt_Row', '{"shoulders"}', '{"biceps","lats","middle back"}'),
  ('Barbell Rollout from Bench', 'Core', 'Barra', 'Barbell_Rollout_from_Bench', '{"abdominals"}', '{"glutes","hamstrings","lats","shoulders"}'),
  ('Barbell Seated Calf Raise', 'Pierna', 'Barra', 'Barbell_Seated_Calf_Raise', '{"calves"}', NULL),
  ('Barbell Shoulder Press', 'Hombro', 'Barra', 'Barbell_Shoulder_Press', '{"shoulders"}', '{"chest","triceps"}'),
  ('Barbell Shrug', 'Trapecio', 'Barra', 'Barbell_Shrug', '{"traps"}', NULL),
  ('Barbell Shrug Behind The Back', 'Trapecio', 'Barra', 'Barbell_Shrug_Behind_The_Back', '{"traps"}', '{"forearms","middle back"}'),
  ('Barbell Side Bend', 'Core', 'Barra', 'Barbell_Side_Bend', '{"abdominals"}', '{"lower back"}'),
  ('Barbell Side Split Squat', 'Pierna', 'Barra', 'Barbell_Side_Split_Squat', '{"quadriceps"}', '{"calves","hamstrings","lower back"}'),
  ('Barbell Squat', 'Pierna', 'Barra', 'Barbell_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings","lower back"}'),
  ('Barbell Squat To A Bench', 'Pierna', 'Barra', 'Barbell_Squat_To_A_Bench', '{"quadriceps"}', '{"calves","glutes","hamstrings","lower back"}'),
  ('Barbell Step Ups', 'Pierna', 'Barra', 'Barbell_Step_Ups', '{"quadriceps"}', '{"calves","glutes","hamstrings","quadriceps"}'),
  ('Barbell Walking Lunge', 'Pierna', 'Barra', 'Barbell_Walking_Lunge', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Battling Ropes', 'Hombro', 'Otro', 'Battling_Ropes', '{"shoulders"}', '{"chest","forearms"}'),
  ('Bench Dips', 'Brazo', 'Peso corporal', 'Bench_Dips', '{"triceps"}', '{"chest","shoulders"}'),
  ('Bench Press - Powerlifting', 'Brazo', 'Barra', 'Bench_Press_-_Powerlifting', '{"triceps"}', '{"chest","forearms","lats","shoulders"}'),
  ('Bench Press - With Bands', 'Pecho', 'Banda elástica', 'Bench_Press_-_With_Bands', '{"chest"}', '{"shoulders","triceps"}'),
  ('Bench Press with Chains', 'Brazo', 'Barra', 'Bench_Press_with_Chains', '{"triceps"}', '{"chest","lats","shoulders"}'),
  ('Bent Over Barbell Row', 'Espalda', 'Barra', 'Bent_Over_Barbell_Row', '{"middle back"}', '{"biceps","lats","shoulders"}'),
  ('Bent Over Dumbbell Rear Delt Raise With Head On Bench', 'Hombro', 'Mancuernas', 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench', '{"shoulders"}', NULL),
  ('Bent Over Low-Pulley Side Lateral', 'Hombro', 'Polea', 'Bent_Over_Low-Pulley_Side_Lateral', '{"shoulders"}', '{"lower back","middle back","traps"}'),
  ('Bent Over One-Arm Long Bar Row', 'Espalda', 'Barra', 'Bent_Over_One-Arm_Long_Bar_Row', '{"middle back"}', '{"biceps","lats","lower back","traps"}'),
  ('Bent Over Two-Arm Long Bar Row', 'Espalda', 'Barra', 'Bent_Over_Two-Arm_Long_Bar_Row', '{"middle back"}', '{"biceps","lats"}'),
  ('Bent Over Two-Dumbbell Row', 'Espalda', 'Mancuernas', 'Bent_Over_Two-Dumbbell_Row', '{"middle back"}', '{"biceps","lats","shoulders"}'),
  ('Bent Over Two-Dumbbell Row With Palms In', 'Espalda', 'Mancuernas', 'Bent_Over_Two-Dumbbell_Row_With_Palms_In', '{"middle back"}', '{"biceps","lats"}'),
  ('Bent Press', 'Core', 'Pesa rusa', 'Bent_Press', '{"abdominals"}', '{"glutes","hamstrings","lower back","quadriceps","shoulders","triceps"}'),
  ('Bent-Arm Barbell Pullover', 'Espalda', 'Barra', 'Bent-Arm_Barbell_Pullover', '{"lats"}', '{"chest","lats","shoulders","triceps"}'),
  ('Bent-Arm Dumbbell Pullover', 'Pecho', 'Mancuernas', 'Bent-Arm_Dumbbell_Pullover', '{"chest"}', '{"lats","shoulders","triceps"}'),
  ('Bent-Knee Hip Raise', 'Core', 'Peso corporal', 'Bent-Knee_Hip_Raise', '{"abdominals"}', NULL),
  ('Board Press', 'Brazo', 'Barra', 'Board_Press', '{"triceps"}', '{"chest","forearms","lats","shoulders"}'),
  ('Body Tricep Press', 'Brazo', 'Peso corporal', 'Body_Tricep_Press', '{"triceps"}', NULL),
  ('Body-Up', 'Brazo', 'Peso corporal', 'Body-Up', '{"triceps"}', '{"abdominals","forearms"}'),
  ('Bodyweight Flyes', 'Pecho', 'Barra Z', 'Bodyweight_Flyes', '{"chest"}', '{"abdominals","shoulders","triceps"}'),
  ('Bodyweight Mid Row', 'Espalda', 'Otro', 'Bodyweight_Mid_Row', '{"middle back"}', '{"biceps","lats"}'),
  ('Bodyweight Squat', 'Pierna', 'Peso corporal', 'Bodyweight_Squat', '{"quadriceps"}', '{"glutes","hamstrings"}'),
  ('Bodyweight Walking Lunge', 'Pierna', 'Otro', 'Bodyweight_Walking_Lunge', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Bosu Ball Cable Crunch With Side Bends', 'Core', 'Polea', 'Bosu_Ball_Cable_Crunch_With_Side_Bends', '{"abdominals"}', NULL),
  ('Bottoms Up', 'Core', 'Peso corporal', 'Bottoms_Up', '{"abdominals"}', NULL),
  ('Bottoms-Up Clean From The Hang Position', 'Antebrazo', 'Pesa rusa', 'Bottoms-Up_Clean_From_The_Hang_Position', '{"forearms"}', '{"biceps","shoulders"}'),
  ('Box Squat', 'Pierna', 'Barra', 'Box_Squat', '{"quadriceps"}', '{"adductors","calves","glutes","hamstrings","lower back"}'),
  ('Box Squat with Bands', 'Pierna', 'Barra', 'Box_Squat_with_Bands', '{"quadriceps"}', '{"abductors","adductors","calves","glutes","hamstrings","lower back"}'),
  ('Box Squat with Chains', 'Pierna', 'Barra', 'Box_Squat_with_Chains', '{"quadriceps"}', '{"abductors","adductors","calves","glutes","hamstrings","lower back"}'),
  ('Bradford/Rocky Presses', 'Hombro', 'Barra', 'Bradford_Rocky_Presses', '{"shoulders"}', '{"triceps"}'),
  ('Butt Lift (Bridge)', 'Pierna', 'Peso corporal', 'Butt_Lift_Bridge', '{"glutes"}', '{"hamstrings"}'),
  ('Butt-Ups', 'Core', 'Peso corporal', 'Butt-Ups', '{"abdominals"}', NULL),
  ('Butterfly', 'Pecho', 'Máquina', 'Butterfly', '{"chest"}', NULL),
  ('Cable Chest Press', 'Pecho', 'Polea', 'Cable_Chest_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Cable Crossover', 'Pecho', 'Polea', 'Cable_Crossover', '{"chest"}', '{"shoulders"}'),
  ('Cable Crunch', 'Core', 'Polea', 'Cable_Crunch', '{"abdominals"}', NULL),
  ('Cable Deadlifts', 'Pierna', 'Polea', 'Cable_Deadlifts', '{"quadriceps"}', '{"forearms","glutes","hamstrings","lower back"}'),
  ('Cable Hammer Curls - Rope Attachment', 'Brazo', 'Polea', 'Cable_Hammer_Curls_-_Rope_Attachment', '{"biceps"}', NULL),
  ('Cable Hip Adduction', 'Pierna', 'Polea', 'Cable_Hip_Adduction', '{"quadriceps"}', NULL),
  ('Cable Incline Pushdown', 'Espalda', 'Polea', 'Cable_Incline_Pushdown', '{"lats"}', NULL),
  ('Cable Incline Triceps Extension', 'Brazo', 'Polea', 'Cable_Incline_Triceps_Extension', '{"triceps"}', NULL),
  ('Cable Internal Rotation', 'Hombro', 'Polea', 'Cable_Internal_Rotation', '{"shoulders"}', NULL),
  ('Cable Iron Cross', 'Pecho', 'Polea', 'Cable_Iron_Cross', '{"chest"}', NULL),
  ('Cable Judo Flip', 'Core', 'Polea', 'Cable_Judo_Flip', '{"abdominals"}', NULL),
  ('Cable Lying Triceps Extension', 'Brazo', 'Polea', 'Cable_Lying_Triceps_Extension', '{"triceps"}', NULL),
  ('Cable One Arm Tricep Extension', 'Brazo', 'Polea', 'Cable_One_Arm_Tricep_Extension', '{"triceps"}', NULL),
  ('Cable Preacher Curl', 'Brazo', 'Polea', 'Cable_Preacher_Curl', '{"biceps"}', '{"forearms"}'),
  ('Cable Rear Delt Fly', 'Hombro', 'Polea', 'Cable_Rear_Delt_Fly', '{"shoulders"}', NULL),
  ('Cable Reverse Crunch', 'Core', 'Polea', 'Cable_Reverse_Crunch', '{"abdominals"}', NULL),
  ('Cable Rope Overhead Triceps Extension', 'Brazo', 'Polea', 'Cable_Rope_Overhead_Triceps_Extension', '{"triceps"}', NULL),
  ('Cable Rope Rear-Delt Rows', 'Hombro', 'Polea', 'Cable_Rope_Rear-Delt_Rows', '{"shoulders"}', '{"biceps","middle back"}'),
  ('Cable Russian Twists', 'Core', 'Polea', 'Cable_Russian_Twists', '{"abdominals"}', NULL),
  ('Cable Seated Crunch', 'Core', 'Polea', 'Cable_Seated_Crunch', '{"abdominals"}', NULL),
  ('Cable Seated Lateral Raise', 'Hombro', 'Polea', 'Cable_Seated_Lateral_Raise', '{"shoulders"}', '{"middle back","traps"}'),
  ('Cable Shoulder Press', 'Hombro', 'Polea', 'Cable_Shoulder_Press', '{"shoulders"}', '{"triceps"}'),
  ('Cable Shrugs', 'Trapecio', 'Polea', 'Cable_Shrugs', '{"traps"}', NULL),
  ('Cable Wrist Curl', 'Antebrazo', 'Polea', 'Cable_Wrist_Curl', '{"forearms"}', NULL),
  ('Calf Press', 'Pierna', 'Máquina', 'Calf_Press', '{"calves"}', NULL),
  ('Calf Press On The Leg Press Machine', 'Pierna', 'Máquina', 'Calf_Press_On_The_Leg_Press_Machine', '{"calves"}', NULL),
  ('Calf Raise On A Dumbbell', 'Pierna', 'Mancuernas', 'Calf_Raise_On_A_Dumbbell', '{"calves"}', NULL),
  ('Calf Raises - With Bands', 'Pierna', 'Banda elástica', 'Calf_Raises_-_With_Bands', '{"calves"}', NULL),
  ('Calf-Machine Shoulder Shrug', 'Trapecio', 'Máquina', 'Calf-Machine_Shoulder_Shrug', '{"traps"}', NULL),
  ('Car Drivers', 'Hombro', 'Barra', 'Car_Drivers', '{"shoulders"}', '{"forearms"}'),
  ('Chain Handle Extension', 'Brazo', 'Otro', 'Chain_Handle_Extension', '{"triceps"}', NULL),
  ('Chain Press', 'Pecho', 'Otro', 'Chain_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Chair Squat', 'Pierna', 'Máquina', 'Chair_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Chin-Up', 'Espalda', 'Peso corporal', 'Chin-Up', '{"lats"}', '{"biceps","forearms","middle back"}'),
  ('Clean', 'Pierna', 'Barra', 'Clean', '{"hamstrings"}', '{"calves","forearms","glutes","lower back","quadriceps","shoulders","traps"}'),
  ('Clean and Jerk', 'Hombro', 'Barra', 'Clean_and_Jerk', '{"shoulders"}', '{"abdominals","glutes","hamstrings","lower back","quadriceps","traps","triceps"}'),
  ('Clean and Press', 'Hombro', 'Barra', 'Clean_and_Press', '{"shoulders"}', '{"abdominals","calves","glutes","hamstrings","lower back","middle back","quadriceps","shoulders","traps","triceps"}'),
  ('Clean Deadlift', 'Pierna', 'Barra', 'Clean_Deadlift', '{"hamstrings"}', '{"forearms","glutes","lower back","middle back","quadriceps","traps"}'),
  ('Clean from Blocks', 'Pierna', 'Barra', 'Clean_from_Blocks', '{"quadriceps"}', '{"calves","glutes","hamstrings","shoulders","traps"}'),
  ('Clean Pull', 'Pierna', 'Barra', 'Clean_Pull', '{"quadriceps"}', '{"forearms","glutes","hamstrings","lower back","traps"}'),
  ('Clean Shrug', 'Trapecio', 'Barra', 'Clean_Shrug', '{"traps"}', '{"forearms","shoulders"}'),
  ('Clock Push-Up', 'Pecho', 'Peso corporal', 'Clock_Push-Up', '{"chest"}', '{"shoulders","triceps"}'),
  ('Close-Grip Barbell Bench Press', 'Brazo', 'Barra', 'Close-Grip_Barbell_Bench_Press', '{"triceps"}', '{"chest","shoulders"}'),
  ('Close-Grip Dumbbell Press', 'Brazo', 'Mancuernas', 'Close-Grip_Dumbbell_Press', '{"triceps"}', '{"chest","shoulders"}'),
  ('Close-Grip EZ Bar Curl', 'Brazo', 'Barra', 'Close-Grip_EZ_Bar_Curl', '{"biceps"}', '{"forearms"}'),
  ('Close-Grip EZ-Bar Curl with Band', 'Brazo', 'Barra Z', 'Close-Grip_EZ-Bar_Curl_with_Band', '{"biceps"}', '{"forearms"}'),
  ('Close-Grip EZ-Bar Press', 'Brazo', 'Barra Z', 'Close-Grip_EZ-Bar_Press', '{"triceps"}', '{"chest","shoulders"}'),
  ('Close-Grip Front Lat Pulldown', 'Espalda', 'Polea', 'Close-Grip_Front_Lat_Pulldown', '{"lats"}', '{"biceps","middle back","shoulders"}'),
  ('Close-Grip Push-Up off of a Dumbbell', 'Brazo', 'Peso corporal', 'Close-Grip_Push-Up_off_of_a_Dumbbell', '{"triceps"}', '{"abdominals","chest","shoulders"}'),
  ('Close-Grip Standing Barbell Curl', 'Brazo', 'Barra', 'Close-Grip_Standing_Barbell_Curl', '{"biceps"}', '{"forearms"}'),
  ('Cocoons', 'Core', 'Peso corporal', 'Cocoons', '{"abdominals"}', NULL),
  ('Concentration Curls', 'Brazo', 'Mancuernas', 'Concentration_Curls', '{"biceps"}', '{"forearms"}'),
  ('Cross Body Hammer Curl', 'Brazo', 'Mancuernas', 'Cross_Body_Hammer_Curl', '{"biceps"}', '{"forearms"}'),
  ('Cross Over - With Bands', 'Pecho', 'Banda elástica', 'Cross_Over_-_With_Bands', '{"chest"}', '{"biceps","shoulders"}'),
  ('Cross-Body Crunch', 'Core', 'Peso corporal', 'Cross-Body_Crunch', '{"abdominals"}', NULL),
  ('Crunch - Hands Overhead', 'Core', 'Peso corporal', 'Crunch_-_Hands_Overhead', '{"abdominals"}', NULL),
  ('Crunch - Legs On Exercise Ball', 'Core', 'Peso corporal', 'Crunch_-_Legs_On_Exercise_Ball', '{"abdominals"}', NULL),
  ('Crunches', 'Core', 'Peso corporal', 'Crunches', '{"abdominals"}', NULL),
  ('Cuban Press', 'Hombro', 'Mancuernas', 'Cuban_Press', '{"shoulders"}', '{"traps"}'),
  ('Dead Bug', 'Core', 'Peso corporal', 'Dead_Bug', '{"abdominals"}', NULL),
  ('Deadlift with Bands', 'Espalda', 'Barra', 'Deadlift_with_Bands', '{"lower back"}', '{"forearms","glutes","hamstrings","middle back","quadriceps","traps"}'),
  ('Deadlift with Chains', 'Espalda', 'Barra', 'Deadlift_with_Chains', '{"lower back"}', '{"forearms","glutes","hamstrings","middle back","quadriceps","traps"}'),
  ('Decline Barbell Bench Press', 'Pecho', 'Barra', 'Decline_Barbell_Bench_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Decline Close-Grip Bench To Skull Crusher', 'Brazo', 'Barra', 'Decline_Close-Grip_Bench_To_Skull_Crusher', '{"triceps"}', '{"chest","shoulders"}'),
  ('Decline Crunch', 'Core', 'Peso corporal', 'Decline_Crunch', '{"abdominals"}', NULL),
  ('Decline Dumbbell Bench Press', 'Pecho', 'Mancuernas', 'Decline_Dumbbell_Bench_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Decline Dumbbell Flyes', 'Pecho', 'Mancuernas', 'Decline_Dumbbell_Flyes', '{"chest"}', NULL),
  ('Decline Dumbbell Triceps Extension', 'Brazo', 'Mancuernas', 'Decline_Dumbbell_Triceps_Extension', '{"triceps"}', NULL),
  ('Decline EZ Bar Triceps Extension', 'Brazo', 'Barra', 'Decline_EZ_Bar_Triceps_Extension', '{"triceps"}', NULL),
  ('Decline Oblique Crunch', 'Core', 'Peso corporal', 'Decline_Oblique_Crunch', '{"abdominals"}', NULL),
  ('Decline Push-Up', 'Pecho', 'Otro', 'Decline_Push-Up', '{"chest"}', '{"shoulders","triceps"}'),
  ('Decline Reverse Crunch', 'Core', 'Peso corporal', 'Decline_Reverse_Crunch', '{"abdominals"}', NULL),
  ('Decline Smith Press', 'Pecho', 'Máquina', 'Decline_Smith_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Deficit Deadlift', 'Espalda', 'Barra', 'Deficit_Deadlift', '{"lower back"}', '{"forearms","glutes","hamstrings","middle back","quadriceps","traps"}'),
  ('Dip Machine', 'Brazo', 'Máquina', 'Dip_Machine', '{"triceps"}', '{"chest","shoulders"}'),
  ('Dips - Chest Version', 'Pecho', 'Otro', 'Dips_-_Chest_Version', '{"chest"}', '{"shoulders","triceps"}'),
  ('Dips - Triceps Version', 'Brazo', 'Peso corporal', 'Dips_-_Triceps_Version', '{"triceps"}', '{"chest","shoulders"}'),
  ('Donkey Calf Raises', 'Pierna', 'Otro', 'Donkey_Calf_Raises', '{"calves"}', NULL),
  ('Double Kettlebell Alternating Hang Clean', 'Pierna', 'Pesa rusa', 'Double_Kettlebell_Alternating_Hang_Clean', '{"hamstrings"}', '{"biceps","calves","forearms","glutes","lower back","quadriceps","traps"}'),
  ('Double Kettlebell Jerk', 'Hombro', 'Pesa rusa', 'Double_Kettlebell_Jerk', '{"shoulders"}', '{"calves","quadriceps","triceps"}'),
  ('Double Kettlebell Push Press', 'Hombro', 'Pesa rusa', 'Double_Kettlebell_Push_Press', '{"shoulders"}', '{"calves","quadriceps","triceps"}'),
  ('Double Kettlebell Snatch', 'Hombro', 'Pesa rusa', 'Double_Kettlebell_Snatch', '{"shoulders"}', '{"glutes","hamstrings","quadriceps"}'),
  ('Double Kettlebell Windmill', 'Core', 'Pesa rusa', 'Double_Kettlebell_Windmill', '{"abdominals"}', '{"glutes","hamstrings","shoulders","triceps"}'),
  ('Downward Facing Balance', 'Pierna', 'Fitball', 'Downward_Facing_Balance', '{"glutes"}', '{"abdominals","hamstrings"}'),
  ('Drag Curl', 'Brazo', 'Barra', 'Drag_Curl', '{"biceps"}', '{"forearms"}'),
  ('Dumbbell Alternate Bicep Curl', 'Brazo', 'Mancuernas', 'Dumbbell_Alternate_Bicep_Curl', '{"biceps"}', '{"forearms"}'),
  ('Dumbbell Bench Press', 'Pecho', 'Mancuernas', 'Dumbbell_Bench_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Dumbbell Bench Press with Neutral Grip', 'Pecho', 'Mancuernas', 'Dumbbell_Bench_Press_with_Neutral_Grip', '{"chest"}', '{"shoulders","triceps"}'),
  ('Dumbbell Bicep Curl', 'Brazo', 'Mancuernas', 'Dumbbell_Bicep_Curl', '{"biceps"}', '{"forearms"}'),
  ('Dumbbell Clean', 'Pierna', 'Mancuernas', 'Dumbbell_Clean', '{"hamstrings"}', '{"calves","forearms","glutes","lower back","quadriceps","shoulders","traps"}'),
  ('Dumbbell Floor Press', 'Brazo', 'Mancuernas', 'Dumbbell_Floor_Press', '{"triceps"}', '{"chest","shoulders"}'),
  ('Dumbbell Flyes', 'Pecho', 'Mancuernas', 'Dumbbell_Flyes', '{"chest"}', NULL),
  ('Dumbbell Incline Row', 'Espalda', 'Mancuernas', 'Dumbbell_Incline_Row', '{"middle back"}', '{"biceps","forearms","lats","shoulders"}'),
  ('Dumbbell Incline Shoulder Raise', 'Hombro', 'Mancuernas', 'Dumbbell_Incline_Shoulder_Raise', '{"shoulders"}', '{"triceps"}'),
  ('Dumbbell Lunges', 'Pierna', 'Mancuernas', 'Dumbbell_Lunges', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Dumbbell Lying One-Arm Rear Lateral Raise', 'Hombro', 'Mancuernas', 'Dumbbell_Lying_One-Arm_Rear_Lateral_Raise', '{"shoulders"}', '{"middle back"}'),
  ('Dumbbell Lying Pronation', 'Antebrazo', 'Mancuernas', 'Dumbbell_Lying_Pronation', '{"forearms"}', NULL),
  ('Dumbbell Lying Rear Lateral Raise', 'Hombro', 'Mancuernas', 'Dumbbell_Lying_Rear_Lateral_Raise', '{"shoulders"}', NULL),
  ('Dumbbell Lying Supination', 'Antebrazo', 'Mancuernas', 'Dumbbell_Lying_Supination', '{"forearms"}', NULL),
  ('Dumbbell One-Arm Shoulder Press', 'Hombro', 'Mancuernas', 'Dumbbell_One-Arm_Shoulder_Press', '{"shoulders"}', '{"triceps"}'),
  ('Dumbbell One-Arm Triceps Extension', 'Brazo', 'Mancuernas', 'Dumbbell_One-Arm_Triceps_Extension', '{"triceps"}', NULL),
  ('Dumbbell One-Arm Upright Row', 'Hombro', 'Mancuernas', 'Dumbbell_One-Arm_Upright_Row', '{"shoulders"}', '{"biceps","traps"}'),
  ('Dumbbell Prone Incline Curl', 'Brazo', 'Mancuernas', 'Dumbbell_Prone_Incline_Curl', '{"biceps"}', NULL),
  ('Dumbbell Raise', 'Hombro', 'Mancuernas', 'Dumbbell_Raise', '{"shoulders"}', '{"biceps"}'),
  ('Dumbbell Rear Lunge', 'Pierna', 'Mancuernas', 'Dumbbell_Rear_Lunge', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Dumbbell Scaption', 'Hombro', 'Mancuernas', 'Dumbbell_Scaption', '{"shoulders"}', '{"traps"}'),
  ('Dumbbell Seated One-Leg Calf Raise', 'Pierna', 'Mancuernas', 'Dumbbell_Seated_One-Leg_Calf_Raise', '{"calves"}', NULL),
  ('Dumbbell Shoulder Press', 'Hombro', 'Mancuernas', 'Dumbbell_Shoulder_Press', '{"shoulders"}', '{"triceps"}'),
  ('Dumbbell Shrug', 'Trapecio', 'Mancuernas', 'Dumbbell_Shrug', '{"traps"}', NULL),
  ('Dumbbell Side Bend', 'Core', 'Mancuernas', 'Dumbbell_Side_Bend', '{"abdominals"}', NULL),
  ('Dumbbell Squat', 'Pierna', 'Mancuernas', 'Dumbbell_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings","lower back"}'),
  ('Dumbbell Squat To A Bench', 'Pierna', 'Mancuernas', 'Dumbbell_Squat_To_A_Bench', '{"quadriceps"}', '{"calves","glutes","hamstrings","lower back"}'),
  ('Dumbbell Step Ups', 'Pierna', 'Mancuernas', 'Dumbbell_Step_Ups', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Dumbbell Tricep Extension -Pronated Grip', 'Brazo', 'Mancuernas', 'Dumbbell_Tricep_Extension_-Pronated_Grip', '{"triceps"}', NULL),
  ('Elbow to Knee', 'Core', 'Peso corporal', 'Elbow_to_Knee', '{"abdominals"}', NULL),
  ('Elevated Back Lunge', 'Pierna', 'Barra', 'Elevated_Back_Lunge', '{"quadriceps"}', '{"glutes","hamstrings"}'),
  ('Elevated Cable Rows', 'Espalda', 'Polea', 'Elevated_Cable_Rows', '{"lats"}', '{"middle back","traps"}'),
  ('Exercise Ball Crunch', 'Core', 'Fitball', 'Exercise_Ball_Crunch', '{"abdominals"}', NULL),
  ('Exercise Ball Pull-In', 'Core', 'Fitball', 'Exercise_Ball_Pull-In', '{"abdominals"}', NULL),
  ('Extended Range One-Arm Kettlebell Floor Press', 'Pecho', 'Pesa rusa', 'Extended_Range_One-Arm_Kettlebell_Floor_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('External Rotation', 'Hombro', 'Mancuernas', 'External_Rotation', '{"shoulders"}', NULL),
  ('External Rotation with Band', 'Hombro', 'Banda elástica', 'External_Rotation_with_Band', '{"shoulders"}', NULL),
  ('External Rotation with Cable', 'Hombro', 'Polea', 'External_Rotation_with_Cable', '{"shoulders"}', NULL),
  ('EZ-Bar Curl', 'Brazo', 'Barra Z', 'EZ-Bar_Curl', '{"biceps"}', NULL),
  ('EZ-Bar Skullcrusher', 'Brazo', 'Barra Z', 'EZ-Bar_Skullcrusher', '{"triceps"}', '{"forearms"}'),
  ('Face Pull', 'Hombro', 'Polea', 'Face_Pull', '{"shoulders"}', '{"middle back"}'),
  ('Farmer''s Walk', 'Antebrazo', 'Otro', 'Farmers_Walk', '{"forearms"}', '{"abdominals","glutes","hamstrings","lower back","quadriceps","traps"}'),
  ('Finger Curls', 'Antebrazo', 'Barra', 'Finger_Curls', '{"forearms"}', NULL),
  ('Flat Bench Cable Flyes', 'Pecho', 'Polea', 'Flat_Bench_Cable_Flyes', '{"chest"}', NULL),
  ('Flat Bench Leg Pull-In', 'Core', 'Peso corporal', 'Flat_Bench_Leg_Pull-In', '{"abdominals"}', NULL),
  ('Flat Bench Lying Leg Raise', 'Core', 'Peso corporal', 'Flat_Bench_Lying_Leg_Raise', '{"abdominals"}', NULL),
  ('Flexor Incline Dumbbell Curls', 'Brazo', 'Mancuernas', 'Flexor_Incline_Dumbbell_Curls', '{"biceps"}', NULL),
  ('Floor Glute-Ham Raise', 'Pierna', 'Otro', 'Floor_Glute-Ham_Raise', '{"hamstrings"}', '{"calves","glutes"}'),
  ('Floor Press', 'Brazo', 'Barra', 'Floor_Press', '{"triceps"}', '{"chest","shoulders"}'),
  ('Floor Press with Chains', 'Brazo', 'Barra', 'Floor_Press_with_Chains', '{"triceps"}', '{"chest","shoulders"}'),
  ('Flutter Kicks', 'Pierna', 'Peso corporal', 'Flutter_Kicks', '{"glutes"}', '{"hamstrings"}'),
  ('Frankenstein Squat', 'Pierna', 'Barra', 'Frankenstein_Squat', '{"quadriceps"}', '{"abdominals","calves","glutes","hamstrings"}'),
  ('Freehand Jump Squat', 'Pierna', 'Peso corporal', 'Freehand_Jump_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Frog Sit-Ups', 'Core', 'Peso corporal', 'Frog_Sit-Ups', '{"abdominals"}', NULL),
  ('Front Barbell Squat', 'Pierna', 'Barra', 'Front_Barbell_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Front Barbell Squat To A Bench', 'Pierna', 'Barra', 'Front_Barbell_Squat_To_A_Bench', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Front Cable Raise', 'Hombro', 'Polea', 'Front_Cable_Raise', '{"shoulders"}', NULL),
  ('Front Dumbbell Raise', 'Hombro', 'Mancuernas', 'Front_Dumbbell_Raise', '{"shoulders"}', NULL),
  ('Front Incline Dumbbell Raise', 'Hombro', 'Mancuernas', 'Front_Incline_Dumbbell_Raise', '{"shoulders"}', NULL),
  ('Front Plate Raise', 'Hombro', 'Otro', 'Front_Plate_Raise', '{"shoulders"}', NULL),
  ('Front Raise And Pullover', 'Pecho', 'Barra', 'Front_Raise_And_Pullover', '{"chest"}', '{"lats","shoulders","triceps"}'),
  ('Front Squat (Clean Grip)', 'Pierna', 'Barra', 'Front_Squat_Clean_Grip', '{"quadriceps"}', '{"abdominals","glutes","hamstrings"}'),
  ('Front Squats With Two Kettlebells', 'Pierna', 'Pesa rusa', 'Front_Squats_With_Two_Kettlebells', '{"quadriceps"}', '{"calves","glutes"}'),
  ('Front Two-Dumbbell Raise', 'Hombro', 'Mancuernas', 'Front_Two-Dumbbell_Raise', '{"shoulders"}', NULL),
  ('Full Range-Of-Motion Lat Pulldown', 'Espalda', 'Polea', 'Full_Range-Of-Motion_Lat_Pulldown', '{"lats"}', '{"biceps","middle back","shoulders"}'),
  ('Gironda Sternum Chins', 'Espalda', 'Otro', 'Gironda_Sternum_Chins', '{"lats"}', '{"biceps","middle back"}'),
  ('Glute Ham Raise', 'Pierna', 'Máquina', 'Glute_Ham_Raise', '{"hamstrings"}', '{"calves","glutes"}'),
  ('Glute Kickback', 'Pierna', 'Peso corporal', 'Glute_Kickback', '{"glutes"}', '{"hamstrings"}'),
  ('Goblet Squat', 'Pierna', 'Pesa rusa', 'Goblet_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings","shoulders"}'),
  ('Good Morning', 'Pierna', 'Barra', 'Good_Morning', '{"hamstrings"}', '{"abdominals","glutes","lower back"}'),
  ('Good Morning off Pins', 'Pierna', 'Barra', 'Good_Morning_off_Pins', '{"hamstrings"}', '{"abdominals","glutes","lower back"}'),
  ('Gorilla Chin/Crunch', 'Core', 'Peso corporal', 'Gorilla_Chin_Crunch', '{"abdominals"}', '{"biceps","lats"}'),
  ('Hack Squat', 'Pierna', 'Máquina', 'Hack_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Hammer Curls', 'Brazo', 'Mancuernas', 'Hammer_Curls', '{"biceps"}', NULL),
  ('Hammer Grip Incline DB Bench Press', 'Pecho', 'Mancuernas', 'Hammer_Grip_Incline_DB_Bench_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Handstand Push-Ups', 'Hombro', 'Peso corporal', 'Handstand_Push-Ups', '{"shoulders"}', '{"triceps"}'),
  ('Hang Clean', 'Pierna', 'Barra', 'Hang_Clean', '{"quadriceps"}', '{"calves","forearms","glutes","hamstrings","lower back","shoulders","traps"}'),
  ('Hang Clean - Below the Knees', 'Pierna', 'Barra', 'Hang_Clean_-_Below_the_Knees', '{"quadriceps"}', '{"calves","forearms","glutes","hamstrings","lower back","shoulders","traps"}'),
  ('Hang Snatch', 'Pierna', 'Barra', 'Hang_Snatch', '{"hamstrings"}', '{"abdominals","calves","forearms","glutes","lower back","quadriceps","shoulders","traps"}'),
  ('Hang Snatch - Below Knees', 'Pierna', 'Barra', 'Hang_Snatch_-_Below_Knees', '{"hamstrings"}', '{"abdominals","calves","forearms","glutes","lower back","quadriceps","shoulders","traps"}'),
  ('Hanging Bar Good Morning', 'Pierna', 'Barra', 'Hanging_Bar_Good_Morning', '{"hamstrings"}', '{"abdominals","glutes","lower back"}'),
  ('Hanging Leg Raise', 'Core', 'Peso corporal', 'Hanging_Leg_Raise', '{"abdominals"}', NULL),
  ('Hanging Pike', 'Core', 'Peso corporal', 'Hanging_Pike', '{"abdominals"}', NULL),
  ('Heaving Snatch Balance', 'Pierna', 'Barra', 'Heaving_Snatch_Balance', '{"quadriceps"}', '{"abdominals","forearms","glutes","hamstrings","shoulders","triceps"}'),
  ('High Cable Curls', 'Brazo', 'Polea', 'High_Cable_Curls', '{"biceps"}', NULL),
  ('Hip Extension with Bands', 'Pierna', 'Banda elástica', 'Hip_Extension_with_Bands', '{"glutes"}', '{"hamstrings"}'),
  ('Hip Flexion with Band', 'Pierna', 'Banda elástica', 'Hip_Flexion_with_Band', '{"quadriceps"}', NULL),
  ('Hip Lift with Band', 'Pierna', 'Banda elástica', 'Hip_Lift_with_Band', '{"glutes"}', '{"calves","hamstrings"}'),
  ('Hyperextensions (Back Extensions)', 'Espalda', 'Otro', 'Hyperextensions_Back_Extensions', '{"lower back"}', '{"glutes","hamstrings"}'),
  ('Hyperextensions With No Hyperextension Bench', 'Espalda', 'Peso corporal', 'Hyperextensions_With_No_Hyperextension_Bench', '{"lower back"}', '{"glutes","hamstrings"}'),
  ('Incline Barbell Triceps Extension', 'Brazo', 'Barra', 'Incline_Barbell_Triceps_Extension', '{"triceps"}', '{"forearms"}'),
  ('Incline Bench Pull', 'Espalda', 'Barra', 'Incline_Bench_Pull', '{"middle back"}', '{"lats","shoulders"}'),
  ('Incline Cable Chest Press', 'Pecho', 'Polea', 'Incline_Cable_Chest_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Incline Cable Flye', 'Pecho', 'Polea', 'Incline_Cable_Flye', '{"chest"}', '{"shoulders"}'),
  ('Incline Dumbbell Bench With Palms Facing In', 'Pecho', 'Mancuernas', 'Incline_Dumbbell_Bench_With_Palms_Facing_In', '{"chest"}', '{"shoulders","triceps"}'),
  ('Incline Dumbbell Curl', 'Brazo', 'Mancuernas', 'Incline_Dumbbell_Curl', '{"biceps"}', NULL),
  ('Incline Dumbbell Flyes', 'Pecho', 'Mancuernas', 'Incline_Dumbbell_Flyes', '{"chest"}', '{"shoulders"}'),
  ('Incline Dumbbell Flyes - With A Twist', 'Pecho', 'Mancuernas', 'Incline_Dumbbell_Flyes_-_With_A_Twist', '{"chest"}', '{"shoulders"}'),
  ('Incline Dumbbell Press', 'Pecho', 'Mancuernas', 'Incline_Dumbbell_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Incline Hammer Curls', 'Brazo', 'Mancuernas', 'Incline_Hammer_Curls', '{"biceps"}', NULL),
  ('Incline Inner Biceps Curl', 'Brazo', 'Mancuernas', 'Incline_Inner_Biceps_Curl', '{"biceps"}', NULL),
  ('Incline Push-Up', 'Pecho', 'Peso corporal', 'Incline_Push-Up', '{"chest"}', '{"shoulders","triceps"}'),
  ('Incline Push-Up Close-Grip', 'Brazo', 'Peso corporal', 'Incline_Push-Up_Close-Grip', '{"triceps"}', '{"chest","shoulders"}'),
  ('Incline Push-Up Medium', 'Pecho', 'Peso corporal', 'Incline_Push-Up_Medium', '{"chest"}', '{"abdominals","shoulders","triceps"}'),
  ('Incline Push-Up Reverse Grip', 'Pecho', 'Peso corporal', 'Incline_Push-Up_Reverse_Grip', '{"chest"}', '{"abdominals","shoulders","triceps"}'),
  ('Incline Push-Up Wide', 'Pecho', 'Peso corporal', 'Incline_Push-Up_Wide', '{"chest"}', '{"abdominals","shoulders","triceps"}'),
  ('Internal Rotation with Band', 'Hombro', 'Banda elástica', 'Internal_Rotation_with_Band', '{"shoulders"}', NULL),
  ('Inverted Row', 'Espalda', 'Otro', 'Inverted_Row', '{"middle back"}', '{"lats"}'),
  ('Inverted Row with Straps', 'Espalda', 'Otro', 'Inverted_Row_with_Straps', '{"middle back"}', '{"biceps","lats"}'),
  ('Iron Cross', 'Hombro', 'Mancuernas', 'Iron_Cross', '{"shoulders"}', '{"chest","glutes","hamstrings","lower back","quadriceps","traps"}'),
  ('Isometric Neck Exercise - Front And Back', 'Trapecio', 'Peso corporal', 'Isometric_Neck_Exercise_-_Front_And_Back', '{"neck"}', NULL),
  ('Isometric Neck Exercise - Sides', 'Trapecio', 'Peso corporal', 'Isometric_Neck_Exercise_-_Sides', '{"neck"}', NULL),
  ('Isometric Wipers', 'Pecho', 'Peso corporal', 'Isometric_Wipers', '{"chest"}', '{"abdominals","shoulders","triceps"}'),
  ('Jackknife Sit-Up', 'Core', 'Peso corporal', 'Jackknife_Sit-Up', '{"abdominals"}', NULL),
  ('Janda Sit-Up', 'Core', 'Peso corporal', 'Janda_Sit-Up', '{"abdominals"}', NULL),
  ('Jefferson Squats', 'Pierna', 'Barra', 'Jefferson_Squats', '{"quadriceps"}', '{"calves","glutes","hamstrings","lower back","traps"}'),
  ('Jerk Balance', 'Hombro', 'Barra', 'Jerk_Balance', '{"shoulders"}', '{"glutes","hamstrings","quadriceps","triceps"}'),
  ('Jerk Dip Squat', 'Pierna', 'Barra', 'Jerk_Dip_Squat', '{"quadriceps"}', '{"abdominals","calves"}'),
  ('JM Press', 'Brazo', 'Barra', 'JM_Press', '{"triceps"}', '{"chest","shoulders"}'),
  ('Kettlebell Arnold Press', 'Hombro', 'Pesa rusa', 'Kettlebell_Arnold_Press', '{"shoulders"}', '{"triceps"}'),
  ('Kettlebell Dead Clean', 'Pierna', 'Pesa rusa', 'Kettlebell_Dead_Clean', '{"hamstrings"}', '{"calves","glutes","lower back","quadriceps","traps"}'),
  ('Kettlebell Figure 8', 'Core', 'Pesa rusa', 'Kettlebell_Figure_8', '{"abdominals"}', '{"hamstrings","shoulders"}'),
  ('Kettlebell Hang Clean', 'Pierna', 'Pesa rusa', 'Kettlebell_Hang_Clean', '{"hamstrings"}', '{"calves","glutes","lower back","shoulders","traps"}'),
  ('Kettlebell One-Legged Deadlift', 'Pierna', 'Pesa rusa', 'Kettlebell_One-Legged_Deadlift', '{"hamstrings"}', '{"glutes","lower back"}'),
  ('Kettlebell Pass Between The Legs', 'Core', 'Pesa rusa', 'Kettlebell_Pass_Between_The_Legs', '{"abdominals"}', '{"glutes","hamstrings","shoulders"}'),
  ('Kettlebell Pirate Ships', 'Hombro', 'Pesa rusa', 'Kettlebell_Pirate_Ships', '{"shoulders"}', '{"abdominals"}'),
  ('Kettlebell Pistol Squat', 'Pierna', 'Pesa rusa', 'Kettlebell_Pistol_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings","shoulders"}'),
  ('Kettlebell Seated Press', 'Hombro', 'Pesa rusa', 'Kettlebell_Seated_Press', '{"shoulders"}', '{"triceps"}'),
  ('Kettlebell Seesaw Press', 'Hombro', 'Pesa rusa', 'Kettlebell_Seesaw_Press', '{"shoulders"}', '{"triceps"}'),
  ('Kettlebell Sumo High Pull', 'Trapecio', 'Pesa rusa', 'Kettlebell_Sumo_High_Pull', '{"traps"}', '{"adductors","glutes","hamstrings","quadriceps","shoulders"}'),
  ('Kettlebell Thruster', 'Hombro', 'Pesa rusa', 'Kettlebell_Thruster', '{"shoulders"}', '{"quadriceps","triceps"}'),
  ('Kettlebell Turkish Get-Up (Lunge style)', 'Hombro', 'Pesa rusa', 'Kettlebell_Turkish_Get-Up_Lunge_style', '{"shoulders"}', '{"abdominals","hamstrings","quadriceps","triceps"}'),
  ('Kettlebell Turkish Get-Up (Squat style)', 'Hombro', 'Pesa rusa', 'Kettlebell_Turkish_Get-Up_Squat_style', '{"shoulders"}', '{"abdominals","calves","hamstrings","quadriceps","triceps"}'),
  ('Kettlebell Windmill', 'Core', 'Pesa rusa', 'Kettlebell_Windmill', '{"abdominals"}', '{"glutes","hamstrings","shoulders","triceps"}'),
  ('Kipping Muscle Up', 'Espalda', 'Otro', 'Kipping_Muscle_Up', '{"lats"}', '{"abdominals","biceps","forearms","middle back","shoulders","traps","triceps"}'),
  ('Knee/Hip Raise On Parallel Bars', 'Core', 'Otro', 'Knee_Hip_Raise_On_Parallel_Bars', '{"abdominals"}', NULL),
  ('Kneeling Cable Crunch With Alternating Oblique Twists', 'Core', 'Polea', 'Kneeling_Cable_Crunch_With_Alternating_Oblique_Twists', '{"abdominals"}', NULL),
  ('Kneeling Cable Triceps Extension', 'Brazo', 'Polea', 'Kneeling_Cable_Triceps_Extension', '{"triceps"}', NULL),
  ('Kneeling High Pulley Row', 'Espalda', 'Polea', 'Kneeling_High_Pulley_Row', '{"lats"}', '{"biceps","middle back"}'),
  ('Kneeling Jump Squat', 'Pierna', 'Barra', 'Kneeling_Jump_Squat', '{"glutes"}', '{"calves","hamstrings","quadriceps"}'),
  ('Kneeling Single-Arm High Pulley Row', 'Espalda', 'Polea', 'Kneeling_Single-Arm_High_Pulley_Row', '{"lats"}', '{"biceps","middle back"}'),
  ('Kneeling Squat', 'Pierna', 'Barra', 'Kneeling_Squat', '{"glutes"}', '{"abdominals","hamstrings","lower back"}'),
  ('Landmine 180''s', 'Core', 'Barra', 'Landmine_180s', '{"abdominals"}', '{"glutes","lower back","shoulders"}'),
  ('Landmine Linear Jammer', 'Hombro', 'Barra', 'Landmine_Linear_Jammer', '{"shoulders"}', '{"abdominals","calves","chest","hamstrings","quadriceps","triceps"}'),
  ('Lateral Raise - With Bands', 'Hombro', 'Banda elástica', 'Lateral_Raise_-_With_Bands', '{"shoulders"}', NULL),
  ('Leg Extensions', 'Pierna', 'Máquina', 'Leg_Extensions', '{"quadriceps"}', NULL),
  ('Leg Lift', 'Pierna', 'Peso corporal', 'Leg_Lift', '{"glutes"}', '{"hamstrings"}'),
  ('Leg Press', 'Pierna', 'Máquina', 'Leg_Press', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Leg Pull-In', 'Core', 'Peso corporal', 'Leg_Pull-In', '{"abdominals"}', NULL),
  ('Leg-Over Floor Press', 'Pecho', 'Pesa rusa', 'Leg-Over_Floor_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Leverage Chest Press', 'Pecho', 'Máquina', 'Leverage_Chest_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Leverage Deadlift', 'Pierna', 'Máquina', 'Leverage_Deadlift', '{"quadriceps"}', '{"glutes","hamstrings"}'),
  ('Leverage Decline Chest Press', 'Pecho', 'Máquina', 'Leverage_Decline_Chest_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Leverage High Row', 'Espalda', 'Máquina', 'Leverage_High_Row', '{"middle back"}', '{"lats"}'),
  ('Leverage Incline Chest Press', 'Pecho', 'Máquina', 'Leverage_Incline_Chest_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Leverage Iso Row', 'Espalda', 'Máquina', 'Leverage_Iso_Row', '{"lats"}', '{"biceps","middle back"}'),
  ('Leverage Shoulder Press', 'Hombro', 'Máquina', 'Leverage_Shoulder_Press', '{"shoulders"}', '{"triceps"}'),
  ('Leverage Shrug', 'Trapecio', 'Máquina', 'Leverage_Shrug', '{"traps"}', '{"forearms"}'),
  ('London Bridges', 'Espalda', 'Otro', 'London_Bridges', '{"lats"}', '{"biceps","forearms","middle back"}'),
  ('Low Cable Crossover', 'Pecho', 'Polea', 'Low_Cable_Crossover', '{"chest"}', '{"shoulders"}'),
  ('Low Cable Triceps Extension', 'Brazo', 'Polea', 'Low_Cable_Triceps_Extension', '{"triceps"}', NULL),
  ('Low Pulley Row To Neck', 'Hombro', 'Polea', 'Low_Pulley_Row_To_Neck', '{"shoulders"}', '{"biceps","middle back","traps"}'),
  ('Lunge Pass Through', 'Pierna', 'Pesa rusa', 'Lunge_Pass_Through', '{"hamstrings"}', '{"calves","glutes","quadriceps"}'),
  ('Lunge Sprint', 'Pierna', 'Máquina', 'Lunge_Sprint', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Lying Cable Curl', 'Brazo', 'Polea', 'Lying_Cable_Curl', '{"biceps"}', NULL),
  ('Lying Cambered Barbell Row', 'Espalda', 'Barra', 'Lying_Cambered_Barbell_Row', '{"middle back"}', '{"biceps","lats","traps"}'),
  ('Lying Close-Grip Bar Curl On High Pulley', 'Brazo', 'Polea', 'Lying_Close-Grip_Bar_Curl_On_High_Pulley', '{"biceps"}', NULL),
  ('Lying Close-Grip Barbell Triceps Extension Behind The Head', 'Brazo', 'Barra', 'Lying_Close-Grip_Barbell_Triceps_Extension_Behind_The_Head', '{"triceps"}', NULL),
  ('Lying Close-Grip Barbell Triceps Press To Chin', 'Brazo', 'Barra Z', 'Lying_Close-Grip_Barbell_Triceps_Press_To_Chin', '{"triceps"}', NULL),
  ('Lying Dumbbell Tricep Extension', 'Brazo', 'Mancuernas', 'Lying_Dumbbell_Tricep_Extension', '{"triceps"}', '{"chest","shoulders"}'),
  ('Lying Face Down Plate Neck Resistance', 'Trapecio', 'Otro', 'Lying_Face_Down_Plate_Neck_Resistance', '{"neck"}', NULL),
  ('Lying Face Up Plate Neck Resistance', 'Trapecio', 'Otro', 'Lying_Face_Up_Plate_Neck_Resistance', '{"neck"}', NULL),
  ('Lying High Bench Barbell Curl', 'Brazo', 'Barra', 'Lying_High_Bench_Barbell_Curl', '{"biceps"}', NULL),
  ('Lying Leg Curls', 'Pierna', 'Máquina', 'Lying_Leg_Curls', '{"hamstrings"}', NULL),
  ('Lying Machine Squat', 'Pierna', 'Máquina', 'Lying_Machine_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Lying One-Arm Lateral Raise', 'Hombro', 'Mancuernas', 'Lying_One-Arm_Lateral_Raise', '{"shoulders"}', NULL),
  ('Lying Rear Delt Raise', 'Hombro', 'Mancuernas', 'Lying_Rear_Delt_Raise', '{"shoulders"}', NULL),
  ('Lying Supine Dumbbell Curl', 'Brazo', 'Mancuernas', 'Lying_Supine_Dumbbell_Curl', '{"biceps"}', NULL),
  ('Lying T-Bar Row', 'Espalda', 'Máquina', 'Lying_T-Bar_Row', '{"middle back"}', '{"biceps","lats"}'),
  ('Lying Triceps Press', 'Brazo', 'Barra Z', 'Lying_Triceps_Press', '{"triceps"}', NULL),
  ('Machine Bench Press', 'Pecho', 'Máquina', 'Machine_Bench_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Machine Bicep Curl', 'Brazo', 'Máquina', 'Machine_Bicep_Curl', '{"biceps"}', NULL),
  ('Machine Preacher Curls', 'Brazo', 'Máquina', 'Machine_Preacher_Curls', '{"biceps"}', NULL),
  ('Machine Shoulder (Military) Press', 'Hombro', 'Máquina', 'Machine_Shoulder_Military_Press', '{"shoulders"}', '{"triceps"}'),
  ('Machine Triceps Extension', 'Brazo', 'Máquina', 'Machine_Triceps_Extension', '{"triceps"}', NULL),
  ('Middle Back Shrug', 'Espalda', 'Mancuernas', 'Middle_Back_Shrug', '{"middle back"}', NULL),
  ('Mixed Grip Chin', 'Espalda', 'Otro', 'Mixed_Grip_Chin', '{"middle back"}', '{"biceps","lats"}'),
  ('Monster Walk', 'Pierna', 'Banda elástica', 'Monster_Walk', '{"abductors"}', NULL),
  ('Mountain Climbers', 'Pierna', 'Otro', 'Mountain_Climbers', '{"quadriceps"}', '{"chest","hamstrings","shoulders"}'),
  ('Muscle Snatch', 'Pierna', 'Barra', 'Muscle_Snatch', '{"hamstrings"}', '{"glutes","lower back","quadriceps","shoulders","triceps"}'),
  ('Muscle Up', 'Espalda', 'Otro', 'Muscle_Up', '{"lats"}', '{"abdominals","biceps","forearms","middle back","shoulders","traps","triceps"}'),
  ('Narrow Stance Hack Squats', 'Pierna', 'Máquina', 'Narrow_Stance_Hack_Squats', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Narrow Stance Leg Press', 'Pierna', 'Máquina', 'Narrow_Stance_Leg_Press', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Narrow Stance Squats', 'Pierna', 'Barra', 'Narrow_Stance_Squats', '{"quadriceps"}', '{"calves","glutes","hamstrings","lower back"}'),
  ('Natural Glute Ham Raise', 'Pierna', 'Peso corporal', 'Natural_Glute_Ham_Raise', '{"hamstrings"}', '{"calves","glutes","lower back"}'),
  ('Neck Press', 'Pecho', 'Barra', 'Neck_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Oblique Crunches', 'Core', 'Peso corporal', 'Oblique_Crunches', '{"abdominals"}', NULL),
  ('Oblique Crunches - On The Floor', 'Core', 'Peso corporal', 'Oblique_Crunches_-_On_The_Floor', '{"abdominals"}', NULL),
  ('Olympic Squat', 'Pierna', 'Barra', 'Olympic_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('One Arm Chin-Up', 'Espalda', 'Otro', 'One_Arm_Chin-Up', '{"middle back"}', '{"biceps","forearms","lats"}'),
  ('One Arm Dumbbell Bench Press', 'Pecho', 'Mancuernas', 'One_Arm_Dumbbell_Bench_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('One Arm Dumbbell Preacher Curl', 'Brazo', 'Mancuernas', 'One_Arm_Dumbbell_Preacher_Curl', '{"biceps"}', NULL),
  ('One Arm Floor Press', 'Brazo', 'Barra', 'One_Arm_Floor_Press', '{"triceps"}', '{"chest","shoulders"}'),
  ('One Arm Lat Pulldown', 'Espalda', 'Polea', 'One_Arm_Lat_Pulldown', '{"lats"}', '{"biceps","middle back"}'),
  ('One Arm Pronated Dumbbell Triceps Extension', 'Brazo', 'Mancuernas', 'One_Arm_Pronated_Dumbbell_Triceps_Extension', '{"triceps"}', NULL),
  ('One Arm Supinated Dumbbell Triceps Extension', 'Brazo', 'Mancuernas', 'One_Arm_Supinated_Dumbbell_Triceps_Extension', '{"triceps"}', NULL),
  ('One Leg Barbell Squat', 'Pierna', 'Barra', 'One_Leg_Barbell_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('One-Arm Dumbbell Row', 'Espalda', 'Mancuernas', 'One-Arm_Dumbbell_Row', '{"middle back"}', '{"biceps","lats","shoulders"}'),
  ('One-Arm Flat Bench Dumbbell Flye', 'Pecho', 'Mancuernas', 'One-Arm_Flat_Bench_Dumbbell_Flye', '{"chest"}', NULL),
  ('One-Arm High-Pulley Cable Side Bends', 'Core', 'Polea', 'One-Arm_High-Pulley_Cable_Side_Bends', '{"abdominals"}', NULL),
  ('One-Arm Incline Lateral Raise', 'Hombro', 'Mancuernas', 'One-Arm_Incline_Lateral_Raise', '{"shoulders"}', NULL),
  ('One-Arm Kettlebell Clean', 'Pierna', 'Pesa rusa', 'One-Arm_Kettlebell_Clean', '{"hamstrings"}', '{"glutes","lower back","shoulders","traps"}'),
  ('One-Arm Kettlebell Clean and Jerk', 'Hombro', 'Pesa rusa', 'One-Arm_Kettlebell_Clean_and_Jerk', '{"shoulders"}', NULL),
  ('One-Arm Kettlebell Floor Press', 'Pecho', 'Pesa rusa', 'One-Arm_Kettlebell_Floor_Press', '{"chest"}', '{"triceps"}'),
  ('One-Arm Kettlebell Jerk', 'Hombro', 'Pesa rusa', 'One-Arm_Kettlebell_Jerk', '{"shoulders"}', '{"calves","quadriceps","triceps"}'),
  ('One-Arm Kettlebell Military Press To The Side', 'Hombro', 'Pesa rusa', 'One-Arm_Kettlebell_Military_Press_To_The_Side', '{"shoulders"}', '{"triceps"}'),
  ('One-Arm Kettlebell Para Press', 'Hombro', 'Pesa rusa', 'One-Arm_Kettlebell_Para_Press', '{"shoulders"}', '{"triceps"}'),
  ('One-Arm Kettlebell Push Press', 'Hombro', 'Pesa rusa', 'One-Arm_Kettlebell_Push_Press', '{"shoulders"}', '{"calves","quadriceps","triceps"}'),
  ('One-Arm Kettlebell Row', 'Espalda', 'Pesa rusa', 'One-Arm_Kettlebell_Row', '{"middle back"}', '{"biceps","lats"}'),
  ('One-Arm Kettlebell Snatch', 'Hombro', 'Pesa rusa', 'One-Arm_Kettlebell_Snatch', '{"shoulders"}', '{"calves","glutes","hamstrings","lower back","traps","triceps"}'),
  ('One-Arm Kettlebell Split Jerk', 'Hombro', 'Pesa rusa', 'One-Arm_Kettlebell_Split_Jerk', '{"shoulders"}', '{"glutes","hamstrings","quadriceps","triceps"}'),
  ('One-Arm Kettlebell Split Snatch', 'Hombro', 'Pesa rusa', 'One-Arm_Kettlebell_Split_Snatch', '{"shoulders"}', '{"hamstrings","quadriceps"}'),
  ('One-Arm Kettlebell Swings', 'Pierna', 'Pesa rusa', 'One-Arm_Kettlebell_Swings', '{"hamstrings"}', '{"calves","glutes","lower back","shoulders"}'),
  ('One-Arm Long Bar Row', 'Espalda', 'Barra', 'One-Arm_Long_Bar_Row', '{"middle back"}', '{"biceps","lats"}'),
  ('One-Arm Medicine Ball Slam', 'Core', 'Balón medicinal', 'One-Arm_Medicine_Ball_Slam', '{"abdominals"}', '{"lats","shoulders"}'),
  ('One-Arm Open Palm Kettlebell Clean', 'Pierna', 'Pesa rusa', 'One-Arm_Open_Palm_Kettlebell_Clean', '{"hamstrings"}', '{"forearms","glutes","lower back","quadriceps","shoulders"}'),
  ('One-Arm Overhead Kettlebell Squats', 'Pierna', 'Pesa rusa', 'One-Arm_Overhead_Kettlebell_Squats', '{"quadriceps"}', '{"calves","glutes","hamstrings","shoulders"}'),
  ('One-Arm Side Deadlift', 'Pierna', 'Barra', 'One-Arm_Side_Deadlift', '{"quadriceps"}', '{"abdominals","calves","glutes","hamstrings","lower back","traps"}'),
  ('One-Arm Side Laterals', 'Hombro', 'Mancuernas', 'One-Arm_Side_Laterals', '{"shoulders"}', NULL),
  ('One-Legged Cable Kickback', 'Pierna', 'Polea', 'One-Legged_Cable_Kickback', '{"glutes"}', '{"hamstrings"}'),
  ('Open Palm Kettlebell Clean', 'Pierna', 'Pesa rusa', 'Open_Palm_Kettlebell_Clean', '{"hamstrings"}', '{"glutes","lower back","quadriceps","shoulders"}'),
  ('Otis-Up', 'Core', 'Otro', 'Otis-Up', '{"abdominals"}', '{"chest","shoulders","triceps"}'),
  ('Overhead Cable Curl', 'Brazo', 'Polea', 'Overhead_Cable_Curl', '{"biceps"}', NULL),
  ('Overhead Squat', 'Pierna', 'Barra', 'Overhead_Squat', '{"quadriceps"}', '{"abdominals","calves","glutes","hamstrings","lower back","shoulders","triceps"}'),
  ('Pallof Press', 'Core', 'Polea', 'Pallof_Press', '{"abdominals"}', '{"chest","shoulders","triceps"}'),
  ('Pallof Press With Rotation', 'Core', 'Polea', 'Pallof_Press_With_Rotation', '{"abdominals"}', '{"chest","shoulders","triceps"}'),
  ('Palms-Down Dumbbell Wrist Curl Over A Bench', 'Antebrazo', 'Mancuernas', 'Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench', '{"forearms"}', NULL),
  ('Palms-Down Wrist Curl Over A Bench', 'Antebrazo', 'Barra', 'Palms-Down_Wrist_Curl_Over_A_Bench', '{"forearms"}', NULL),
  ('Palms-Up Barbell Wrist Curl Over A Bench', 'Antebrazo', 'Barra', 'Palms-Up_Barbell_Wrist_Curl_Over_A_Bench', '{"forearms"}', NULL),
  ('Palms-Up Dumbbell Wrist Curl Over A Bench', 'Antebrazo', 'Mancuernas', 'Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench', '{"forearms"}', NULL),
  ('Parallel Bar Dip', 'Brazo', 'Otro', 'Parallel_Bar_Dip', '{"triceps"}', '{"chest","shoulders"}'),
  ('Physioball Hip Bridge', 'Pierna', 'Fitball', 'Physioball_Hip_Bridge', '{"glutes"}', '{"hamstrings"}'),
  ('Pin Presses', 'Brazo', 'Barra', 'Pin_Presses', '{"triceps"}', '{"chest","forearms","lats","middle back","shoulders"}'),
  ('Plank', 'Core', 'Peso corporal', 'Plank', '{"abdominals"}', NULL),
  ('Plate Pinch', 'Antebrazo', 'Otro', 'Plate_Pinch', '{"forearms"}', NULL),
  ('Plate Twist', 'Core', 'Otro', 'Plate_Twist', '{"abdominals"}', NULL),
  ('Platform Hamstring Slides', 'Pierna', 'Otro', 'Platform_Hamstring_Slides', '{"hamstrings"}', '{"glutes"}'),
  ('Plie Dumbbell Squat', 'Pierna', 'Mancuernas', 'Plie_Dumbbell_Squat', '{"quadriceps"}', '{"abdominals","calves","glutes","hamstrings"}'),
  ('Plyo Kettlebell Pushups', 'Pecho', 'Pesa rusa', 'Plyo_Kettlebell_Pushups', '{"chest"}', '{"shoulders","triceps"}'),
  ('Power Clean', 'Pierna', 'Barra', 'Power_Clean', '{"hamstrings"}', '{"calves","forearms","glutes","lower back","middle back","quadriceps","shoulders","traps","triceps"}'),
  ('Power Clean from Blocks', 'Pierna', 'Barra', 'Power_Clean_from_Blocks', '{"hamstrings"}', '{"quadriceps"}'),
  ('Power Jerk', 'Pierna', 'Barra', 'Power_Jerk', '{"quadriceps"}', '{"abdominals","calves","glutes","hamstrings","shoulders","triceps"}'),
  ('Power Partials', 'Hombro', 'Mancuernas', 'Power_Partials', '{"shoulders"}', NULL),
  ('Power Snatch', 'Pierna', 'Barra', 'Power_Snatch', '{"hamstrings"}', '{"calves","glutes","lower back","quadriceps","shoulders","traps","triceps"}'),
  ('Power Snatch from Blocks', 'Pierna', 'Barra', 'Power_Snatch_from_Blocks', '{"quadriceps"}', '{"calves","forearms","glutes","hamstrings","lower back","shoulders","traps","triceps"}'),
  ('Preacher Curl', 'Brazo', 'Barra', 'Preacher_Curl', '{"biceps"}', NULL),
  ('Preacher Hammer Dumbbell Curl', 'Brazo', 'Mancuernas', 'Preacher_Hammer_Dumbbell_Curl', '{"biceps"}', '{"forearms"}'),
  ('Press Sit-Up', 'Core', 'Barra', 'Press_Sit-Up', '{"abdominals"}', '{"chest","shoulders","triceps"}'),
  ('Prone Manual Hamstring', 'Pierna', 'Otro', 'Prone_Manual_Hamstring', '{"hamstrings"}', NULL),
  ('Pull Through', 'Pierna', 'Polea', 'Pull_Through', '{"glutes"}', '{"hamstrings","lower back"}'),
  ('Pullups', 'Espalda', 'Peso corporal', 'Pullups', '{"lats"}', '{"biceps","middle back"}'),
  ('Push Press', 'Hombro', 'Barra', 'Push_Press', '{"shoulders"}', '{"quadriceps","triceps"}'),
  ('Push Press - Behind the Neck', 'Hombro', 'Barra', 'Push_Press_-_Behind_the_Neck', '{"shoulders"}', '{"calves","quadriceps","triceps"}'),
  ('Push Up to Side Plank', 'Pecho', 'Peso corporal', 'Push_Up_to_Side_Plank', '{"chest"}', '{"abdominals","shoulders","triceps"}'),
  ('Push-Up Wide', 'Pecho', 'Peso corporal', 'Push-Up_Wide', '{"chest"}', '{"abdominals","shoulders","triceps"}'),
  ('Push-Ups - Close Triceps Position', 'Brazo', 'Peso corporal', 'Push-Ups_-_Close_Triceps_Position', '{"triceps"}', '{"chest","shoulders"}'),
  ('Push-Ups With Feet Elevated', 'Pecho', 'Peso corporal', 'Push-Ups_With_Feet_Elevated', '{"chest"}', '{"shoulders","triceps"}'),
  ('Push-Ups With Feet On An Exercise Ball', 'Pecho', 'Fitball', 'Push-Ups_With_Feet_On_An_Exercise_Ball', '{"chest"}', '{"shoulders","triceps"}'),
  ('Pushups', 'Pecho', 'Peso corporal', 'Pushups', '{"chest"}', '{"shoulders","triceps"}'),
  ('Pushups (Close and Wide Hand Positions)', 'Pecho', 'Peso corporal', 'Pushups_Close_and_Wide_Hand_Positions', '{"chest"}', '{"shoulders","triceps"}'),
  ('Rack Delivery', 'Hombro', 'Barra', 'Rack_Delivery', '{"shoulders"}', '{"forearms","traps"}'),
  ('Rack Pull with Bands', 'Espalda', 'Barra', 'Rack_Pull_with_Bands', '{"lower back"}', '{"forearms","glutes","hamstrings","quadriceps","traps"}'),
  ('Rack Pulls', 'Espalda', 'Barra', 'Rack_Pulls', '{"lower back"}', '{"forearms","glutes","hamstrings","traps"}'),
  ('Reverse Band Bench Press', 'Brazo', 'Barra', 'Reverse_Band_Bench_Press', '{"triceps"}', '{"chest","forearms","lats","middle back","shoulders"}'),
  ('Reverse Band Box Squat', 'Pierna', 'Barra', 'Reverse_Band_Box_Squat', '{"quadriceps"}', '{"abductors","adductors","calves","forearms","glutes","hamstrings","lower back"}'),
  ('Reverse Band Deadlift', 'Espalda', 'Barra', 'Reverse_Band_Deadlift', '{"lower back"}', '{"abductors","adductors","calves","glutes","hamstrings","quadriceps"}'),
  ('Reverse Band Power Squat', 'Pierna', 'Barra', 'Reverse_Band_Power_Squat', '{"quadriceps"}', '{"adductors","calves","glutes","hamstrings","lower back"}'),
  ('Reverse Band Sumo Deadlift', 'Pierna', 'Barra', 'Reverse_Band_Sumo_Deadlift', '{"hamstrings"}', '{"abductors","adductors","calves","forearms","glutes","lower back","quadriceps","traps"}'),
  ('Reverse Barbell Curl', 'Brazo', 'Barra', 'Reverse_Barbell_Curl', '{"biceps"}', '{"forearms"}'),
  ('Reverse Barbell Preacher Curls', 'Brazo', 'Barra Z', 'Reverse_Barbell_Preacher_Curls', '{"biceps"}', '{"forearms"}'),
  ('Reverse Cable Curl', 'Brazo', 'Polea', 'Reverse_Cable_Curl', '{"biceps"}', '{"forearms"}'),
  ('Reverse Crunch', 'Core', 'Peso corporal', 'Reverse_Crunch', '{"abdominals"}', NULL),
  ('Reverse Flyes', 'Hombro', 'Mancuernas', 'Reverse_Flyes', '{"shoulders"}', NULL),
  ('Reverse Flyes With External Rotation', 'Hombro', 'Mancuernas', 'Reverse_Flyes_With_External_Rotation', '{"shoulders"}', NULL),
  ('Reverse Grip Bent-Over Rows', 'Espalda', 'Barra', 'Reverse_Grip_Bent-Over_Rows', '{"middle back"}', '{"biceps","lats","shoulders"}'),
  ('Reverse Grip Triceps Pushdown', 'Brazo', 'Polea', 'Reverse_Grip_Triceps_Pushdown', '{"triceps"}', NULL),
  ('Reverse Hyperextension', 'Pierna', 'Máquina', 'Reverse_Hyperextension', '{"hamstrings"}', '{"calves","glutes"}'),
  ('Reverse Machine Flyes', 'Hombro', 'Máquina', 'Reverse_Machine_Flyes', '{"shoulders"}', NULL),
  ('Reverse Plate Curls', 'Brazo', 'Otro', 'Reverse_Plate_Curls', '{"biceps"}', '{"forearms"}'),
  ('Reverse Triceps Bench Press', 'Brazo', 'Barra', 'Reverse_Triceps_Bench_Press', '{"triceps"}', '{"chest","shoulders"}'),
  ('Ring Dips', 'Brazo', 'Otro', 'Ring_Dips', '{"triceps"}', '{"chest","shoulders"}'),
  ('Rocking Standing Calf Raise', 'Pierna', 'Barra', 'Rocking_Standing_Calf_Raise', '{"calves"}', NULL),
  ('Rocky Pull-Ups/Pulldowns', 'Espalda', 'Otro', 'Rocky_Pull-Ups_Pulldowns', '{"lats"}', '{"biceps","middle back","shoulders"}'),
  ('Romanian Deadlift', 'Pierna', 'Barra', 'Romanian_Deadlift', '{"hamstrings"}', '{"calves","glutes","lower back"}'),
  ('Romanian Deadlift from Deficit', 'Pierna', 'Barra', 'Romanian_Deadlift_from_Deficit', '{"hamstrings"}', '{"forearms","glutes","lower back","traps"}'),
  ('Rope Climb', 'Espalda', 'Otro', 'Rope_Climb', '{"lats"}', '{"biceps","forearms","middle back","shoulders"}'),
  ('Rope Crunch', 'Core', 'Polea', 'Rope_Crunch', '{"abdominals"}', NULL),
  ('Rope Straight-Arm Pulldown', 'Espalda', 'Polea', 'Rope_Straight-Arm_Pulldown', '{"lats"}', NULL),
  ('Russian Twist', 'Core', 'Peso corporal', 'Russian_Twist', '{"abdominals"}', '{"lower back"}'),
  ('Scapular Pull-Up', 'Trapecio', 'Otro', 'Scapular_Pull-Up', '{"traps"}', '{"lats","middle back"}'),
  ('Seated Band Hamstring Curl', 'Pierna', 'Otro', 'Seated_Band_Hamstring_Curl', '{"hamstrings"}', NULL),
  ('Seated Barbell Military Press', 'Hombro', 'Barra', 'Seated_Barbell_Military_Press', '{"shoulders"}', '{"triceps"}'),
  ('Seated Barbell Twist', 'Core', 'Barra', 'Seated_Barbell_Twist', '{"abdominals"}', NULL),
  ('Seated Bent-Over One-Arm Dumbbell Triceps Extension', 'Brazo', 'Mancuernas', 'Seated_Bent-Over_One-Arm_Dumbbell_Triceps_Extension', '{"triceps"}', NULL),
  ('Seated Bent-Over Rear Delt Raise', 'Hombro', 'Mancuernas', 'Seated_Bent-Over_Rear_Delt_Raise', '{"shoulders"}', NULL),
  ('Seated Bent-Over Two-Arm Dumbbell Triceps Extension', 'Brazo', 'Mancuernas', 'Seated_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension', '{"triceps"}', NULL),
  ('Seated Cable Rows', 'Espalda', 'Polea', 'Seated_Cable_Rows', '{"middle back"}', '{"biceps","lats","shoulders"}'),
  ('Seated Cable Shoulder Press', 'Hombro', 'Polea', 'Seated_Cable_Shoulder_Press', '{"shoulders"}', '{"triceps"}'),
  ('Seated Calf Raise', 'Pierna', 'Máquina', 'Seated_Calf_Raise', '{"calves"}', NULL),
  ('Seated Close-Grip Concentration Barbell Curl', 'Brazo', 'Barra', 'Seated_Close-Grip_Concentration_Barbell_Curl', '{"biceps"}', NULL),
  ('Seated Dumbbell Curl', 'Brazo', 'Mancuernas', 'Seated_Dumbbell_Curl', '{"biceps"}', NULL),
  ('Seated Dumbbell Inner Biceps Curl', 'Brazo', 'Mancuernas', 'Seated_Dumbbell_Inner_Biceps_Curl', '{"biceps"}', NULL),
  ('Seated Dumbbell Palms-Down Wrist Curl', 'Antebrazo', 'Mancuernas', 'Seated_Dumbbell_Palms-Down_Wrist_Curl', '{"forearms"}', NULL),
  ('Seated Dumbbell Palms-Up Wrist Curl', 'Antebrazo', 'Mancuernas', 'Seated_Dumbbell_Palms-Up_Wrist_Curl', '{"forearms"}', NULL),
  ('Seated Dumbbell Press', 'Hombro', 'Mancuernas', 'Seated_Dumbbell_Press', '{"shoulders"}', '{"triceps"}'),
  ('Seated Flat Bench Leg Pull-In', 'Core', 'Peso corporal', 'Seated_Flat_Bench_Leg_Pull-In', '{"abdominals"}', NULL),
  ('Seated Good Mornings', 'Espalda', 'Barra', 'Seated_Good_Mornings', '{"lower back"}', '{"glutes"}'),
  ('Seated Head Harness Neck Resistance', 'Trapecio', 'Otro', 'Seated_Head_Harness_Neck_Resistance', '{"neck"}', NULL),
  ('Seated Leg Curl', 'Pierna', 'Máquina', 'Seated_Leg_Curl', '{"hamstrings"}', NULL),
  ('Seated Leg Tucks', 'Core', 'Peso corporal', 'Seated_Leg_Tucks', '{"abdominals"}', NULL),
  ('Seated One-arm Cable Pulley Rows', 'Espalda', 'Polea', 'Seated_One-arm_Cable_Pulley_Rows', '{"middle back"}', '{"biceps","lats","traps"}'),
  ('Seated One-Arm Dumbbell Palms-Down Wrist Curl', 'Antebrazo', 'Mancuernas', 'Seated_One-Arm_Dumbbell_Palms-Down_Wrist_Curl', '{"forearms"}', NULL),
  ('Seated One-Arm Dumbbell Palms-Up Wrist Curl', 'Antebrazo', 'Mancuernas', 'Seated_One-Arm_Dumbbell_Palms-Up_Wrist_Curl', '{"forearms"}', NULL),
  ('Seated Palm-Up Barbell Wrist Curl', 'Antebrazo', 'Barra', 'Seated_Palm-Up_Barbell_Wrist_Curl', '{"forearms"}', NULL),
  ('Seated Palms-Down Barbell Wrist Curl', 'Antebrazo', 'Barra', 'Seated_Palms-Down_Barbell_Wrist_Curl', '{"forearms"}', NULL),
  ('Seated Side Lateral Raise', 'Hombro', 'Mancuernas', 'Seated_Side_Lateral_Raise', '{"shoulders"}', NULL),
  ('Seated Triceps Press', 'Brazo', 'Mancuernas', 'Seated_Triceps_Press', '{"triceps"}', NULL),
  ('Seated Two-Arm Palms-Up Low-Pulley Wrist Curl', 'Antebrazo', 'Polea', 'Seated_Two-Arm_Palms-Up_Low-Pulley_Wrist_Curl', '{"forearms"}', NULL),
  ('See-Saw Press (Alternating Side Press)', 'Hombro', 'Mancuernas', 'See-Saw_Press_Alternating_Side_Press', '{"shoulders"}', '{"abdominals","triceps"}'),
  ('Shotgun Row', 'Espalda', 'Polea', 'Shotgun_Row', '{"lats"}', '{"biceps","middle back"}'),
  ('Shoulder Press - With Bands', 'Hombro', 'Banda elástica', 'Shoulder_Press_-_With_Bands', '{"shoulders"}', '{"triceps"}'),
  ('Side Bridge', 'Core', 'Peso corporal', 'Side_Bridge', '{"abdominals"}', '{"shoulders"}'),
  ('Side Jackknife', 'Core', 'Peso corporal', 'Side_Jackknife', '{"abdominals"}', NULL),
  ('Side Lateral Raise', 'Hombro', 'Mancuernas', 'Side_Lateral_Raise', '{"shoulders"}', NULL),
  ('Side Laterals to Front Raise', 'Hombro', 'Mancuernas', 'Side_Laterals_to_Front_Raise', '{"shoulders"}', '{"traps"}'),
  ('Side To Side Chins', 'Espalda', 'Otro', 'Side_To_Side_Chins', '{"lats"}', '{"biceps","forearms","middle back","shoulders"}'),
  ('Single Dumbbell Raise', 'Hombro', 'Mancuernas', 'Single_Dumbbell_Raise', '{"shoulders"}', '{"forearms","traps"}'),
  ('Single Leg Glute Bridge', 'Pierna', 'Peso corporal', 'Single_Leg_Glute_Bridge', '{"glutes"}', '{"hamstrings"}'),
  ('Single-Arm Cable Crossover', 'Pecho', 'Polea', 'Single-Arm_Cable_Crossover', '{"chest"}', NULL),
  ('Single-Arm Linear Jammer', 'Hombro', 'Barra', 'Single-Arm_Linear_Jammer', '{"shoulders"}', '{"chest","triceps"}'),
  ('Single-Arm Push-Up', 'Pecho', 'Peso corporal', 'Single-Arm_Push-Up', '{"chest"}', '{"shoulders","triceps"}'),
  ('Single-Leg High Box Squat', 'Pierna', 'Otro', 'Single-Leg_High_Box_Squat', '{"quadriceps"}', '{"glutes","hamstrings"}'),
  ('Single-Leg Leg Extension', 'Pierna', 'Máquina', 'Single-Leg_Leg_Extension', '{"quadriceps"}', NULL),
  ('Sit-Up', 'Core', 'Peso corporal', 'Sit-Up', '{"abdominals"}', NULL),
  ('Sled Overhead Backward Walk', 'Hombro', 'Otro', 'Sled_Overhead_Backward_Walk', '{"shoulders"}', '{"calves","middle back","quadriceps"}'),
  ('Sled Overhead Triceps Extension', 'Brazo', 'Otro', 'Sled_Overhead_Triceps_Extension', '{"triceps"}', NULL),
  ('Sled Reverse Flye', 'Hombro', 'Otro', 'Sled_Reverse_Flye', '{"shoulders"}', NULL),
  ('Sled Row', 'Espalda', 'Otro', 'Sled_Row', '{"middle back"}', '{"biceps","lats"}'),
  ('Smith Incline Shoulder Raise', 'Hombro', 'Barra', 'Smith_Incline_Shoulder_Raise', '{"shoulders"}', '{"chest"}'),
  ('Smith Machine Behind the Back Shrug', 'Trapecio', 'Máquina', 'Smith_Machine_Behind_the_Back_Shrug', '{"traps"}', '{"shoulders"}'),
  ('Smith Machine Bench Press', 'Pecho', 'Máquina', 'Smith_Machine_Bench_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Smith Machine Bent Over Row', 'Espalda', 'Máquina', 'Smith_Machine_Bent_Over_Row', '{"middle back"}', '{"biceps","lats","shoulders"}'),
  ('Smith Machine Calf Raise', 'Pierna', 'Máquina', 'Smith_Machine_Calf_Raise', '{"calves"}', NULL),
  ('Smith Machine Close-Grip Bench Press', 'Brazo', 'Máquina', 'Smith_Machine_Close-Grip_Bench_Press', '{"triceps"}', '{"chest","shoulders"}'),
  ('Smith Machine Decline Press', 'Pecho', 'Máquina', 'Smith_Machine_Decline_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Smith Machine Hang Power Clean', 'Pierna', 'Máquina', 'Smith_Machine_Hang_Power_Clean', '{"hamstrings"}', '{"glutes","lower back","quadriceps","shoulders","traps"}'),
  ('Smith Machine Hip Raise', 'Core', 'Máquina', 'Smith_Machine_Hip_Raise', '{"abdominals"}', NULL),
  ('Smith Machine Incline Bench Press', 'Pecho', 'Máquina', 'Smith_Machine_Incline_Bench_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Smith Machine Leg Press', 'Pierna', 'Máquina', 'Smith_Machine_Leg_Press', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Smith Machine One-Arm Upright Row', 'Hombro', 'Máquina', 'Smith_Machine_One-Arm_Upright_Row', '{"shoulders"}', '{"biceps","traps"}'),
  ('Smith Machine Overhead Shoulder Press', 'Hombro', 'Máquina', 'Smith_Machine_Overhead_Shoulder_Press', '{"shoulders"}', '{"triceps"}'),
  ('Smith Machine Pistol Squat', 'Pierna', 'Máquina', 'Smith_Machine_Pistol_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Smith Machine Reverse Calf Raises', 'Pierna', 'Máquina', 'Smith_Machine_Reverse_Calf_Raises', '{"calves"}', NULL),
  ('Smith Machine Squat', 'Pierna', 'Máquina', 'Smith_Machine_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings","lower back"}'),
  ('Smith Machine Stiff-Legged Deadlift', 'Pierna', 'Máquina', 'Smith_Machine_Stiff-Legged_Deadlift', '{"hamstrings"}', '{"glutes","lower back"}'),
  ('Smith Machine Upright Row', 'Trapecio', 'Máquina', 'Smith_Machine_Upright_Row', '{"traps"}', '{"biceps","middle back","shoulders"}'),
  ('Smith Single-Leg Split Squat', 'Pierna', 'Máquina', 'Smith_Single-Leg_Split_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Snatch', 'Pierna', 'Barra', 'Snatch', '{"quadriceps"}', '{"biceps","glutes","hamstrings","lower back","shoulders","traps","triceps"}'),
  ('Snatch Balance', 'Pierna', 'Barra', 'Snatch_Balance', '{"quadriceps"}', '{"calves","glutes","hamstrings","shoulders","triceps"}'),
  ('Snatch Deadlift', 'Pierna', 'Barra', 'Snatch_Deadlift', '{"hamstrings"}', '{"forearms","glutes","hamstrings","lower back","quadriceps","traps"}'),
  ('Snatch from Blocks', 'Pierna', 'Barra', 'Snatch_from_Blocks', '{"quadriceps"}', '{"calves","forearms","glutes","hamstrings","lower back","shoulders","traps","triceps"}'),
  ('Snatch Pull', 'Pierna', 'Barra', 'Snatch_Pull', '{"hamstrings"}', '{"calves","glutes","lower back","quadriceps","traps"}'),
  ('Snatch Shrug', 'Trapecio', 'Barra', 'Snatch_Shrug', '{"traps"}', '{"forearms","shoulders"}'),
  ('Speed Band Overhead Triceps', 'Brazo', 'Banda elástica', 'Speed_Band_Overhead_Triceps', '{"triceps"}', NULL),
  ('Speed Box Squat', 'Pierna', 'Barra', 'Speed_Box_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Speed Squats', 'Pierna', 'Barra', 'Speed_Squats', '{"quadriceps"}', '{"calves","glutes","hamstrings","lower back"}'),
  ('Spell Caster', 'Core', 'Mancuernas', 'Spell_Caster', '{"abdominals"}', '{"glutes","shoulders"}'),
  ('Spider Crawl', 'Core', 'Peso corporal', 'Spider_Crawl', '{"abdominals"}', '{"chest","shoulders","triceps"}'),
  ('Spider Curl', 'Brazo', 'Barra Z', 'Spider_Curl', '{"biceps"}', NULL),
  ('Split Clean', 'Pierna', 'Barra', 'Split_Clean', '{"quadriceps"}', '{"calves","forearms","glutes","hamstrings","lower back","shoulders","traps"}'),
  ('Split Jerk', 'Pierna', 'Barra', 'Split_Jerk', '{"quadriceps"}', '{"glutes","hamstrings","shoulders","triceps"}'),
  ('Split Snatch', 'Pierna', 'Barra', 'Split_Snatch', '{"hamstrings"}', '{"calves","forearms","glutes","hamstrings","lower back","quadriceps","shoulders","traps","triceps"}'),
  ('Split Squat with Dumbbells', 'Pierna', 'Mancuernas', 'Split_Squat_with_Dumbbells', '{"quadriceps"}', '{"glutes","hamstrings"}'),
  ('Squat Jerk', 'Pierna', 'Barra', 'Squat_Jerk', '{"quadriceps"}', '{"calves","glutes","hamstrings","shoulders","triceps"}'),
  ('Squat with Bands', 'Pierna', 'Barra', 'Squat_with_Bands', '{"quadriceps"}', '{"adductors","calves","glutes","hamstrings","lower back"}'),
  ('Squat with Chains', 'Pierna', 'Barra', 'Squat_with_Chains', '{"quadriceps"}', '{"adductors","calves","glutes","hamstrings","lower back"}'),
  ('Squat with Plate Movers', 'Pierna', 'Barra', 'Squat_with_Plate_Movers', '{"quadriceps"}', '{"abductors","adductors","calves","glutes","hamstrings"}'),
  ('Squats - With Bands', 'Pierna', 'Banda elástica', 'Squats_-_With_Bands', '{"quadriceps"}', '{"calves","glutes","hamstrings","lower back"}'),
  ('Standing Alternating Dumbbell Press', 'Hombro', 'Mancuernas', 'Standing_Alternating_Dumbbell_Press', '{"shoulders"}', '{"triceps"}'),
  ('Standing Barbell Calf Raise', 'Pierna', 'Barra', 'Standing_Barbell_Calf_Raise', '{"calves"}', NULL),
  ('Standing Barbell Press Behind Neck', 'Hombro', 'Barra', 'Standing_Barbell_Press_Behind_Neck', '{"shoulders"}', '{"triceps"}'),
  ('Standing Bent-Over One-Arm Dumbbell Triceps Extension', 'Brazo', 'Mancuernas', 'Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension', '{"triceps"}', '{"shoulders"}'),
  ('Standing Bent-Over Two-Arm Dumbbell Triceps Extension', 'Brazo', 'Mancuernas', 'Standing_Bent-Over_Two-Arm_Dumbbell_Triceps_Extension', '{"triceps"}', NULL),
  ('Standing Biceps Cable Curl', 'Brazo', 'Polea', 'Standing_Biceps_Cable_Curl', '{"biceps"}', NULL),
  ('Standing Bradford Press', 'Hombro', 'Barra', 'Standing_Bradford_Press', '{"shoulders"}', '{"triceps"}'),
  ('Standing Cable Chest Press', 'Pecho', 'Polea', 'Standing_Cable_Chest_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Standing Cable Lift', 'Core', 'Polea', 'Standing_Cable_Lift', '{"abdominals"}', '{"shoulders"}'),
  ('Standing Cable Wood Chop', 'Core', 'Polea', 'Standing_Cable_Wood_Chop', '{"abdominals"}', '{"shoulders"}'),
  ('Standing Calf Raises', 'Pierna', 'Máquina', 'Standing_Calf_Raises', '{"calves"}', NULL),
  ('Standing Concentration Curl', 'Brazo', 'Mancuernas', 'Standing_Concentration_Curl', '{"biceps"}', '{"forearms"}'),
  ('Standing Dumbbell Calf Raise', 'Pierna', 'Mancuernas', 'Standing_Dumbbell_Calf_Raise', '{"calves"}', NULL),
  ('Standing Dumbbell Press', 'Hombro', 'Mancuernas', 'Standing_Dumbbell_Press', '{"shoulders"}', '{"triceps"}'),
  ('Standing Dumbbell Reverse Curl', 'Brazo', 'Mancuernas', 'Standing_Dumbbell_Reverse_Curl', '{"biceps"}', '{"forearms"}'),
  ('Standing Dumbbell Straight-Arm Front Delt Raise Above Head', 'Hombro', 'Mancuernas', 'Standing_Dumbbell_Straight-Arm_Front_Delt_Raise_Above_Head', '{"shoulders"}', NULL),
  ('Standing Dumbbell Triceps Extension', 'Brazo', 'Mancuernas', 'Standing_Dumbbell_Triceps_Extension', '{"triceps"}', NULL),
  ('Standing Dumbbell Upright Row', 'Trapecio', 'Mancuernas', 'Standing_Dumbbell_Upright_Row', '{"traps"}', '{"biceps","shoulders"}'),
  ('Standing Front Barbell Raise Over Head', 'Hombro', 'Barra', 'Standing_Front_Barbell_Raise_Over_Head', '{"shoulders"}', NULL),
  ('Standing Inner-Biceps Curl', 'Brazo', 'Mancuernas', 'Standing_Inner-Biceps_Curl', '{"biceps"}', NULL),
  ('Standing Leg Curl', 'Pierna', 'Máquina', 'Standing_Leg_Curl', '{"hamstrings"}', NULL),
  ('Standing Low-Pulley Deltoid Raise', 'Hombro', 'Polea', 'Standing_Low-Pulley_Deltoid_Raise', '{"shoulders"}', '{"forearms"}'),
  ('Standing Low-Pulley One-Arm Triceps Extension', 'Brazo', 'Polea', 'Standing_Low-Pulley_One-Arm_Triceps_Extension', '{"triceps"}', '{"chest","shoulders"}'),
  ('Standing Military Press', 'Hombro', 'Barra', 'Standing_Military_Press', '{"shoulders"}', '{"triceps"}'),
  ('Standing Olympic Plate Hand Squeeze', 'Antebrazo', 'Otro', 'Standing_Olympic_Plate_Hand_Squeeze', '{"forearms"}', '{"biceps"}'),
  ('Standing One-Arm Cable Curl', 'Brazo', 'Polea', 'Standing_One-Arm_Cable_Curl', '{"biceps"}', NULL),
  ('Standing One-Arm Dumbbell Curl Over Incline Bench', 'Brazo', 'Mancuernas', 'Standing_One-Arm_Dumbbell_Curl_Over_Incline_Bench', '{"biceps"}', NULL),
  ('Standing One-Arm Dumbbell Triceps Extension', 'Brazo', 'Mancuernas', 'Standing_One-Arm_Dumbbell_Triceps_Extension', '{"triceps"}', '{"chest","shoulders"}'),
  ('Standing Overhead Barbell Triceps Extension', 'Brazo', 'Barra', 'Standing_Overhead_Barbell_Triceps_Extension', '{"triceps"}', '{"shoulders"}'),
  ('Standing Palm-In One-Arm Dumbbell Press', 'Hombro', 'Mancuernas', 'Standing_Palm-In_One-Arm_Dumbbell_Press', '{"shoulders"}', '{"triceps"}'),
  ('Standing Palms-In Dumbbell Press', 'Hombro', 'Mancuernas', 'Standing_Palms-In_Dumbbell_Press', '{"shoulders"}', '{"triceps"}'),
  ('Standing Palms-Up Barbell Behind The Back Wrist Curl', 'Antebrazo', 'Barra', 'Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl', '{"forearms"}', NULL),
  ('Standing Rope Crunch', 'Core', 'Polea', 'Standing_Rope_Crunch', '{"abdominals"}', NULL),
  ('Standing Towel Triceps Extension', 'Brazo', 'Peso corporal', 'Standing_Towel_Triceps_Extension', '{"triceps"}', NULL),
  ('Step-up with Knee Raise', 'Pierna', 'Peso corporal', 'Step-up_with_Knee_Raise', '{"glutes"}', '{"hamstrings","quadriceps"}'),
  ('Stiff Leg Barbell Good Morning', 'Espalda', 'Barra', 'Stiff_Leg_Barbell_Good_Morning', '{"lower back"}', '{"glutes","hamstrings"}'),
  ('Stiff-Legged Barbell Deadlift', 'Pierna', 'Barra', 'Stiff-Legged_Barbell_Deadlift', '{"hamstrings"}', '{"glutes","lower back"}'),
  ('Stiff-Legged Dumbbell Deadlift', 'Pierna', 'Mancuernas', 'Stiff-Legged_Dumbbell_Deadlift', '{"hamstrings"}', '{"glutes","lower back"}'),
  ('Straight Bar Bench Mid Rows', 'Espalda', 'Barra', 'Straight_Bar_Bench_Mid_Rows', '{"middle back"}', '{"biceps","lats"}'),
  ('Straight Raises on Incline Bench', 'Hombro', 'Barra', 'Straight_Raises_on_Incline_Bench', '{"shoulders"}', '{"traps"}'),
  ('Straight-Arm Dumbbell Pullover', 'Pecho', 'Mancuernas', 'Straight-Arm_Dumbbell_Pullover', '{"chest"}', '{"lats","shoulders","triceps"}'),
  ('Straight-Arm Pulldown', 'Espalda', 'Polea', 'Straight-Arm_Pulldown', '{"lats"}', NULL),
  ('Sumo Deadlift', 'Pierna', 'Barra', 'Sumo_Deadlift', '{"hamstrings"}', '{"adductors","forearms","glutes","lower back","middle back","quadriceps","traps"}'),
  ('Sumo Deadlift with Bands', 'Pierna', 'Barra', 'Sumo_Deadlift_with_Bands', '{"hamstrings"}', '{"adductors","forearms","glutes","lower back","middle back","quadriceps","traps"}'),
  ('Sumo Deadlift with Chains', 'Pierna', 'Barra', 'Sumo_Deadlift_with_Chains', '{"hamstrings"}', '{"abductors","adductors","forearms","glutes","lower back","middle back","quadriceps","traps"}'),
  ('Suspended Fallout', 'Core', 'Otro', 'Suspended_Fallout', '{"abdominals"}', '{"chest","lower back","shoulders"}'),
  ('Suspended Push-Up', 'Pecho', 'Otro', 'Suspended_Push-Up', '{"chest"}', '{"shoulders","triceps"}'),
  ('Suspended Reverse Crunch', 'Core', 'Otro', 'Suspended_Reverse_Crunch', '{"abdominals"}', NULL),
  ('Suspended Row', 'Espalda', 'Otro', 'Suspended_Row', '{"middle back"}', '{"biceps","lats"}'),
  ('Suspended Split Squat', 'Pierna', 'Otro', 'Suspended_Split_Squat', '{"quadriceps"}', '{"abductors","adductors","calves","glutes","hamstrings"}'),
  ('Svend Press', 'Pecho', 'Otro', 'Svend_Press', '{"chest"}', '{"forearms","shoulders","triceps"}'),
  ('T-Bar Row with Handle', 'Espalda', 'Barra', 'T-Bar_Row_with_Handle', '{"middle back"}', '{"biceps","lats"}'),
  ('Tate Press', 'Brazo', 'Mancuernas', 'Tate_Press', '{"triceps"}', '{"chest","shoulders"}'),
  ('Thigh Abductor', 'Pierna', 'Máquina', 'Thigh_Abductor', '{"abductors"}', '{"glutes"}'),
  ('Thigh Adductor', 'Pierna', 'Máquina', 'Thigh_Adductor', '{"adductors"}', '{"glutes","hamstrings"}'),
  ('Trap Bar Deadlift', 'Pierna', 'Otro', 'Trap_Bar_Deadlift', '{"quadriceps"}', '{"glutes","hamstrings"}'),
  ('Tricep Dumbbell Kickback', 'Brazo', 'Mancuernas', 'Tricep_Dumbbell_Kickback', '{"triceps"}', NULL),
  ('Triceps Overhead Extension with Rope', 'Brazo', 'Polea', 'Triceps_Overhead_Extension_with_Rope', '{"triceps"}', NULL),
  ('Triceps Pushdown', 'Brazo', 'Polea', 'Triceps_Pushdown', '{"triceps"}', NULL),
  ('Triceps Pushdown - Rope Attachment', 'Brazo', 'Polea', 'Triceps_Pushdown_-_Rope_Attachment', '{"triceps"}', NULL),
  ('Triceps Pushdown - V-Bar Attachment', 'Brazo', 'Polea', 'Triceps_Pushdown_-_V-Bar_Attachment', '{"triceps"}', NULL),
  ('Tuck Crunch', 'Core', 'Peso corporal', 'Tuck_Crunch', '{"abdominals"}', NULL),
  ('Two-Arm Dumbbell Preacher Curl', 'Brazo', 'Mancuernas', 'Two-Arm_Dumbbell_Preacher_Curl', '{"biceps"}', NULL),
  ('Two-Arm Kettlebell Clean', 'Hombro', 'Pesa rusa', 'Two-Arm_Kettlebell_Clean', '{"shoulders"}', '{"calves","glutes","hamstrings","lower back","traps"}'),
  ('Two-Arm Kettlebell Jerk', 'Hombro', 'Pesa rusa', 'Two-Arm_Kettlebell_Jerk', '{"shoulders"}', '{"calves","quadriceps","triceps"}'),
  ('Two-Arm Kettlebell Military Press', 'Hombro', 'Pesa rusa', 'Two-Arm_Kettlebell_Military_Press', '{"shoulders"}', '{"triceps"}'),
  ('Two-Arm Kettlebell Row', 'Espalda', 'Pesa rusa', 'Two-Arm_Kettlebell_Row', '{"middle back"}', '{"biceps","lats"}'),
  ('Underhand Cable Pulldowns', 'Espalda', 'Polea', 'Underhand_Cable_Pulldowns', '{"lats"}', '{"biceps","middle back","shoulders"}'),
  ('Upright Barbell Row', 'Hombro', 'Barra', 'Upright_Barbell_Row', '{"shoulders"}', '{"traps"}'),
  ('Upright Cable Row', 'Trapecio', 'Polea', 'Upright_Cable_Row', '{"traps"}', '{"shoulders"}'),
  ('Upright Row - With Bands', 'Trapecio', 'Banda elástica', 'Upright_Row_-_With_Bands', '{"traps"}', '{"shoulders"}'),
  ('V-Bar Pulldown', 'Espalda', 'Polea', 'V-Bar_Pulldown', '{"lats"}', '{"biceps","middle back","shoulders"}'),
  ('V-Bar Pullup', 'Espalda', 'Peso corporal', 'V-Bar_Pullup', '{"lats"}', '{"biceps","middle back","shoulders"}'),
  ('Weighted Ball Hyperextension', 'Espalda', 'Fitball', 'Weighted_Ball_Hyperextension', '{"lower back"}', '{"glutes","hamstrings","middle back"}'),
  ('Weighted Ball Side Bend', 'Core', 'Fitball', 'Weighted_Ball_Side_Bend', '{"abdominals"}', NULL),
  ('Weighted Bench Dip', 'Brazo', 'Otro', 'Weighted_Bench_Dip', '{"triceps"}', '{"chest","shoulders"}'),
  ('Weighted Crunches', 'Core', 'Balón medicinal', 'Weighted_Crunches', '{"abdominals"}', NULL),
  ('Weighted Jump Squat', 'Pierna', 'Barra', 'Weighted_Jump_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings","lower back"}'),
  ('Weighted Pull Ups', 'Espalda', 'Otro', 'Weighted_Pull_Ups', '{"lats"}', '{"biceps","middle back"}'),
  ('Weighted Sissy Squat', 'Pierna', 'Barra', 'Weighted_Sissy_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Weighted Sit-Ups - With Bands', 'Core', 'Otro', 'Weighted_Sit-Ups_-_With_Bands', '{"abdominals"}', NULL),
  ('Weighted Squat', 'Pierna', 'Otro', 'Weighted_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Wide Stance Barbell Squat', 'Pierna', 'Barra', 'Wide_Stance_Barbell_Squat', '{"quadriceps"}', '{"calves","glutes","hamstrings","lower back"}'),
  ('Wide Stance Stiff Legs', 'Pierna', 'Barra', 'Wide_Stance_Stiff_Legs', '{"hamstrings"}', '{"adductors","glutes","lower back"}'),
  ('Wide-Grip Barbell Bench Press', 'Pecho', 'Barra', 'Wide-Grip_Barbell_Bench_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Wide-Grip Decline Barbell Bench Press', 'Pecho', 'Barra', 'Wide-Grip_Decline_Barbell_Bench_Press', '{"chest"}', '{"shoulders","triceps"}'),
  ('Wide-Grip Decline Barbell Pullover', 'Pecho', 'Barra', 'Wide-Grip_Decline_Barbell_Pullover', '{"chest"}', '{"shoulders","triceps"}'),
  ('Wide-Grip Lat Pulldown', 'Espalda', 'Polea', 'Wide-Grip_Lat_Pulldown', '{"lats"}', '{"biceps","middle back","shoulders"}'),
  ('Wide-Grip Pulldown Behind The Neck', 'Espalda', 'Polea', 'Wide-Grip_Pulldown_Behind_The_Neck', '{"lats"}', '{"biceps","middle back","shoulders"}'),
  ('Wide-Grip Rear Pull-Up', 'Espalda', 'Peso corporal', 'Wide-Grip_Rear_Pull-Up', '{"lats"}', '{"biceps","middle back","shoulders"}'),
  ('Wide-Grip Standing Barbell Curl', 'Brazo', 'Barra', 'Wide-Grip_Standing_Barbell_Curl', '{"biceps"}', NULL),
  ('Wind Sprints', 'Core', 'Peso corporal', 'Wind_Sprints', '{"abdominals"}', NULL),
  ('Wrist Roller', 'Antebrazo', 'Otro', 'Wrist_Roller', '{"forearms"}', '{"shoulders"}'),
  ('Wrist Rotations with Straight Bar', 'Antebrazo', 'Barra', 'Wrist_Rotations_with_Straight_Bar', '{"forearms"}', NULL),
  ('Zercher Squats', 'Pierna', 'Barra', 'Zercher_Squats', '{"quadriceps"}', '{"calves","glutes","hamstrings"}'),
  ('Zottman Curl', 'Brazo', 'Mancuernas', 'Zottman_Curl', '{"biceps"}', '{"forearms"}'),
  ('Zottman Preacher Curl', 'Brazo', 'Mancuernas', 'Zottman_Preacher_Curl', '{"biceps"}', '{"forearms"}'),
  ('Bridge 3 apoyo inferior', 'Pierna', 'Peso corporal', NULL, NULL, NULL),
  ('AMI - Glúteos 1 pierna 3 apoyos', 'Pierna', 'Máquina', NULL, NULL, NULL),
  ('Elevación de pierna alternativa en plancha', 'Core', 'Peso corporal', NULL, NULL, NULL),
  ('Flexión de cadera en plancha lateral', 'Core', 'Peso corporal', NULL, NULL, NULL);

-- <<< generado

-- ── Rutinas ────────────────────────────────────────────────────────────────

INSERT INTO routines (id, nombre, descripcion, nivel, semanas, status, owner_id, author_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001',
   'Fuerza intermedia 5×',
   'Bloque de doce semanas con progresión lineal en los básicos y trabajo accesorio en volumen. Sube 2,5 kg cuando completes todas las series.',
   'Intermedio', 12, 'activa',
   '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),

  ('aaaaaaaa-0000-0000-0000-000000000002',
   'Push / Pull / Legs',
   'Rotación clásica de seis días con dos ciclos por semana.',
   'Avanzado', 8, 'activa',
   '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),

  ('aaaaaaaa-0000-0000-0000-000000000003',
   'Full body 3×',
   'Tres sesiones completas para semanas con poco tiempo.',
   'Principiante', 6, 'guardada',
   '11111111-1111-1111-1111-111111111111', NULL),

  ('aaaaaaaa-0000-0000-0000-000000000004',
   'Hipertrofia superior',
   'Enfoque en torso, seis series por grupo y sesión.',
   'Intermedio', 10, 'guardada',
   '11111111-1111-1111-1111-111111111111', NULL),

  ('aaaaaaaa-0000-0000-0000-000000000005',
   'Descarga activa',
   'Semana de descarga al 60% del volumen habitual.',
   'Todos', 1, 'guardada',
   '11111111-1111-1111-1111-111111111111', NULL),

  ('aaaaaaaa-0000-0000-0000-000000000006',
   'Preparación media maratón',
   'Fuerza de apoyo para bloque de carrera.',
   'Intermedio', 10, 'borrador',
   '11111111-1111-1111-1111-111111111111', NULL);

-- ── Días de "Fuerza intermedia 5×" ─────────────────────────────────────────

INSERT INTO routine_days (id, routine_id, orden, codigo, nombre, titulo, subtitulo, duracion_min, descanso_defecto_s, progresion) VALUES
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 0, 'A', 'Tirón',
   'Día A — Tirón',           'Espalda, bíceps, cadena posterior', 65, 120, 'lineal'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 1, 'B', 'Empuje',
   'Día B — Empuje',          'Pecho, hombro, tríceps',            62,  90, 'lineal'),
  ('bbbbbbbb-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000001', 2, 'C', 'Pierna',
   'Día C — Pierna',          'Cuádriceps, femoral, gemelo',       70, 120, 'lineal'),
  ('bbbbbbbb-0000-0000-0000-00000000000d', 'aaaaaaaa-0000-0000-0000-000000000001', 3, 'D', 'Torso',
   'Día D — Torso completo',  'Volumen medio, series al fallo controlado', 55, 90, 'doble'),
  ('bbbbbbbb-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-000000000001', 4, 'E', 'Accesorio',
   'Día E — Accesorio y core','Sesión corta, prehabilitación',     40,  60, 'manual');

-- Ejercicios por día. `carga_kg` es la carga objetivo de la semana en curso.
-- Se enlaza por `fedb_id`, no por nombre: el catálogo ya no tiene nombres en
-- español (arriba), y enlazar por texto es justo el bug que perdía una fila
-- del Día D en silencio (ver la comprobación después del INSERT). El nombre
-- en español va como comentario, solo para poder leer la tabla.
INSERT INTO routine_exercises (routine_day_id, exercise_id, orden, series, tipo, reps, carga_kg, carga_texto, descanso_s)
SELECT d.id, e.id, v.orden, v.series, v.tipo::effort_kind, v.reps, v.carga_kg, v.carga_texto, v.descanso_s
FROM (VALUES
  -- Día A
  ('A', 'Barbell_Deadlift',                          0, 4, 'reps',   '5',    132.5, NULL,        180), -- Peso muerto
  ('A', 'Weighted_Pull_Ups',                         1, 4, 'reps',   '6',     17.5, '+17,5 kg',  150), -- Dominadas lastradas
  ('A', 'Bent_Over_Barbell_Row',                     2, 4, 'reps',   '8',     70.0, NULL,        120), -- Remo con barra
  ('A', 'Wide-Grip_Lat_Pulldown',                    3, 3, 'reps',   '12',    55.0, NULL,         90), -- Jalón al pecho
  ('A', 'EZ-Bar_Curl',                               4, 3, 'reps',   '12',    27.5, NULL,         60), -- Curl con barra Z
  -- Día B
  ('B', 'Barbell_Bench_Press_-_Medium_Grip',         0, 4, 'reps',   '8',     72.5, NULL,        150), -- Press banca
  ('B', 'Standing_Military_Press',                   1, 4, 'reps',   '8',     42.5, NULL,        120), -- Press militar
  ('B', 'Incline_Dumbbell_Press',                    2, 3, 'reps',   '10',    24.0, NULL,         90), -- Press inclinado mancuernas
  ('B', 'Dips_-_Chest_Version',                      3, 3, 'reps',   '10',     0.0, 'Peso corp.', 90), -- Fondos en paralelas
  ('B', 'Triceps_Pushdown',                          4, 3, 'reps',   '12',    27.5, NULL,         60), -- Extensión tríceps en polea
  -- Día C
  ('C', 'Barbell_Squat',                             0, 5, 'reps',   '5',    105.0, NULL,        180), -- Sentadilla trasera
  ('C', 'Leg_Press',                                 1, 4, 'reps',   '10',   180.0, NULL,        120), -- Prensa 45°
  ('C', 'Lying_Leg_Curls',                           2, 4, 'reps',   '12',    45.0, NULL,         90), -- Curl femoral tumbado
  ('C', 'Dumbbell_Lunges',                           3, 3, 'reps',   '12',    20.0, NULL,         90), -- Zancadas con mancuernas
  ('C', 'Standing_Calf_Raises',                      4, 4, 'reps',   '15',    70.0, NULL,         60), -- Elevación de gemelo
  -- Día D
  ('D', 'Barbell_Incline_Bench_Press_-_Medium_Grip', 0, 4, 'reps',   '8',     60.0, NULL,        120), -- Press banca inclinado
  ('D', 'T-Bar_Row_with_Handle',                     1, 4, 'reps',   '10',    50.0, NULL,        120), -- Remo en T (antes 'Remo en punta': errata que perdía la fila)
  ('D', 'Side_Lateral_Raise',                        2, 4, 'reps',   '15',    10.0, NULL,         60), -- Elevaciones laterales
  ('D', 'Face_Pull',                                 3, 3, 'reps',   '15',    25.0, NULL,         60), -- Face pull
  -- Día E — la plancha es el único bloque por tiempo del seed.
  ('E', 'Barbell_Hip_Thrust',                        0, 4, 'reps',   '10',    90.0, NULL,         90), -- Hip thrust
  ('E', 'One-Arm_Dumbbell_Row',                      1, 3, 'reps',   '12',    32.0, NULL,         75), -- Remo con mancuerna
  ('E', 'Plank',                                     2, 3, 'tiempo', '45 s',  10.0, '+10 kg',     60), -- Plancha con lastre
  ('E', 'Ab_Roller',                                 3, 3, 'reps',   '12',     0.0, 'Peso corp.', 60)  -- Rueda abdominal
) AS v (codigo, fedb, orden, series, tipo, reps, carga_kg, carga_texto, descanso_s)
JOIN routine_days d
  ON d.routine_id = 'aaaaaaaa-0000-0000-0000-000000000001' AND d.codigo = v.codigo
JOIN exercises e ON e.fedb_id = v.fedb;

-- El JOIN de arriba es INNER: si algún fedb_id no existiera en el catálogo, la
-- fila desaparecería sin error — el bug que perdió un ejercicio del Día D en
-- silencio (era 'Remo en punta', y el catálogo tenía 'Remo en T'). Que no
-- vuelva a pasar callado.
DO $$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n
  FROM routine_exercises re
  JOIN routine_days d ON d.id = re.routine_day_id
  WHERE d.routine_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  IF v_n <> 23 THEN
    RAISE EXCEPTION 'El seed perdió ejercicios: esperaba 23 en routine_exercises y hay %. Algún fedb_id no existe en el catálogo.', v_n;
  END IF;
END $$;

-- Días esqueleto para el resto de rutinas: sin ejercicios todavía, pero con el
-- número de días correcto (de ahí sale la adherencia esperada de cada alumno).
INSERT INTO routine_days (routine_id, orden, codigo, nombre, titulo, subtitulo, duracion_min)
SELECT r.id,
       g - 1,
       chr(64 + g),
       'Sesión ' || g,
       'Día ' || chr(64 + g) || ' — Sesión ' || g,
       'Plantilla pendiente de detallar',
       50
FROM routines r
CROSS JOIN LATERAL generate_series(1, CASE r.nombre
    WHEN 'Push / Pull / Legs'         THEN 6
    WHEN 'Full body 3×'               THEN 3
    WHEN 'Hipertrofia superior'       THEN 4
    WHEN 'Descarga activa'            THEN 4
    WHEN 'Preparación media maratón'  THEN 2
    ELSE 0
  END) AS g
WHERE r.id <> 'aaaaaaaa-0000-0000-0000-000000000001';

-- ── Asignaciones ───────────────────────────────────────────────────────────

-- Laura solo tiene a Marco: el panel de entrenador sale con una fila.
INSERT INTO assignments (routine_id, coach_id, client_id, started_on)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111', (current_date - 35));

-- ── Alias de ejercicio ─────────────────────────────────────────────────────
-- El catálogo viene de free-exercise-db y está en inglés; en el gimnasio nadie
-- dice "Wide-Grip Lat Pulldown". Estas dos filas enseñan la regla entera:
--
--   · El de Laura llega a Marco por `routines.author_id` — ella escribió
--     "Fuerza intermedia 5×" —, así que lo ve en la rutina y en la sesión,
--     pero NO en su biblioteca: allí manda él.
--   · El de Marco es suyo y lo ve en todas partes.
--
-- Si además le pone alias al jalón, el suyo gana también dentro de la rutina.
INSERT INTO exercise_aliases (user_id, exercise_id, alias)
SELECT v.user_id::uuid, e.id, v.alias
FROM (VALUES
  ('22222222-2222-2222-2222-222222222222', 'Wide-Grip_Lat_Pulldown', 'Jalón al pecho'),
  ('11111111-1111-1111-1111-111111111111', 'Barbell_Deadlift',       'Peso muerto')
) AS v (user_id, fedb, alias)
JOIN exercises e ON e.fedb_id = v.fedb;

-- ═══════════════════════════════════════════════════════════════════════════
-- Historial: 12 semanas de entrenamientos de Marco.
-- Las cargas suben ~2% por semana, así que el gráfico de volumen crece igual
-- que en el prototipo (≈11.200 kg la primera semana → ≈18.200 kg la última).
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user   uuid := '11111111-1111-1111-1111-111111111111';
  v_semana int;
  v_dia    record;
  v_ses    uuid;
  v_ini    timestamptz;
  v_factor numeric;
  v_serie  int;
  v_kg     numeric;
  v_reps   int;
  v_bloque int;
  v_ex     record;
BEGIN
  FOR v_semana IN 0..11 LOOP
    -- La carga sube un escalón cada tres semanas (0,62 → 1,00 del objetivo),
    -- con microdescargas en las semanas 2, 5 y 8: así el gráfico de volumen
    -- tiene la forma de sierra ascendente del diseño y los PRs caen en un
    -- tercio de las sesiones, no en todas.
    v_factor := 0.62 + 0.1267 * floor(v_semana / 3.0);
    IF v_semana IN (2, 5, 8) THEN
      v_factor := v_factor * 0.92;
    END IF;

    FOR v_dia IN
      SELECT * FROM routine_days
      WHERE routine_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      ORDER BY orden
    LOOP
      -- Adherencia realista: se salta el día E una de cada tres semanas.
      CONTINUE WHEN v_dia.codigo = 'E' AND v_semana % 3 = 0;

      v_ini := date_trunc('week', now())
               - make_interval(weeks => 11 - v_semana)
               + make_interval(days => v_dia.orden, hours => 18, mins => 30);

      -- Nada en el futuro.
      CONTINUE WHEN v_ini > now() - interval '2 hours';

      INSERT INTO workout_sessions (user_id, routine_id, routine_day_id, titulo, status, started_at, ended_at)
      VALUES (v_user, 'aaaaaaaa-0000-0000-0000-000000000001', v_dia.id, v_dia.titulo, 'terminada',
              v_ini, v_ini + make_interval(mins => coalesce(v_dia.duracion_min, 55) + (v_semana % 7)))
      RETURNING id INTO v_ses;

      v_bloque := 0;
      FOR v_ex IN
        SELECT re.*, ex.nombre FROM routine_exercises re
        JOIN exercises ex ON ex.id = re.exercise_id
        WHERE re.routine_day_id = v_dia.id ORDER BY re.orden
      LOOP
        FOR v_serie IN 1..v_ex.series LOOP
          -- Carga redondeada al múltiplo de 2,5 kg más cercano.
          v_kg := round((coalesce(v_ex.carga_kg, 0) * v_factor) / 2.5) * 2.5;

          IF v_ex.tipo = 'tiempo' THEN
            -- Sin repeticiones inventadas: aguanta unos segundos menos según
            -- avanza el ejercicio, y no aporta volumen.
            INSERT INTO set_logs (session_id, exercise_id, routine_exercise_id,
                                  bloque, orden, kg, reps, segundos, done_at)
            VALUES (v_ses, v_ex.exercise_id, v_ex.id, v_bloque, v_serie, v_kg, 0,
                    greatest(5, segundos_planificados(v_ex.reps) - (v_serie - 1) * 5),
                    v_ini + make_interval(mins => v_bloque * 11 + v_serie * 2));
          ELSE
            -- Las últimas series caen una o dos reps.
            v_reps := greatest(1,
              reps_planificadas(v_ex.reps) - CASE WHEN v_serie > 2 THEN 1 ELSE 0 END);

            INSERT INTO set_logs (session_id, exercise_id, routine_exercise_id,
                                  bloque, orden, kg, reps, done_at)
            VALUES (v_ses, v_ex.exercise_id, v_ex.id, v_bloque, v_serie, v_kg, v_reps,
                    v_ini + make_interval(mins => v_bloque * 11 + v_serie * 2));
          END IF;
        END LOOP;
        v_bloque := v_bloque + 1;
      END LOOP;

      PERFORM registrar_prs(v_ses);
    END LOOP;
  END LOOP;
END $$;

-- ── Sesión en curso de Marco (Día B — Empuje) ──────────────────────────────
-- Reproduce la pantalla del prototipo: cronómetro corriendo, series aún sin
-- confirmar y la columna "Anterior" resuelta desde el historial de arriba.

DO $$
DECLARE
  v_dia   uuid := 'bbbbbbbb-0000-0000-0000-00000000000b';
  v_ses   uuid;
  v_ex    record;
  v_bloque int := 0;
  v_serie int;
BEGIN
  INSERT INTO workout_sessions (user_id, routine_id, routine_day_id, titulo, status, started_at)
  VALUES ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
          v_dia, 'Día B — Empuje', 'en_curso', now() - interval '30 minutes 47 seconds')
  RETURNING id INTO v_ses;

  FOR v_ex IN
    SELECT * FROM routine_exercises WHERE routine_day_id = v_dia ORDER BY orden
  LOOP
    FOR v_serie IN 1..v_ex.series LOOP
      INSERT INTO set_logs (session_id, exercise_id, routine_exercise_id,
                            bloque, orden, kg, reps, segundos, done_at)
      VALUES (v_ses, v_ex.exercise_id, v_ex.id, v_bloque, v_serie,
              coalesce(v_ex.carga_kg, 0),
              CASE WHEN v_ex.tipo = 'tiempo' THEN 0 ELSE reps_planificadas(v_ex.reps) END,
              CASE WHEN v_ex.tipo = 'tiempo' THEN segundos_planificados(v_ex.reps) END,
              NULL);
    END LOOP;
    v_bloque := v_bloque + 1;
  END LOOP;
END $$;

COMMIT;

-- Comprobación rápida.
SELECT
  (SELECT count(*) FROM users)            AS usuarios,
  (SELECT count(*) FROM exercises)        AS ejercicios,
  (SELECT count(*) FROM routines)         AS rutinas,
  (SELECT count(*) FROM workout_sessions) AS sesiones,
  (SELECT count(*) FROM set_logs)         AS series,
  (SELECT count(*) FROM personal_records) AS records;
