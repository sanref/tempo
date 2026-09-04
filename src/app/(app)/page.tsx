import Link from "next/link";

import { empezarSesion } from "@/app/actions";
import { ExerciseName } from "@/components/exercise-name";
import { StatStrip } from "@/components/stat-strip";
import { WeeklyVolumeChart } from "@/components/weekly-volume-chart";
import {
  getPlanActivo,
  getProximoDia,
  getRecordsRecientes,
  getResumenSemana,
  getVolumenSemanal,
} from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { carga, duracionCorta, fechaLarga, kg, miles } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InicioPage() {
  const user = await getCurrentUser();

  const [resumen, plan, dia, semanas, records] = await Promise.all([
    getResumenSemana(user.id),
    getPlanActivo(user.id),
    getProximoDia(user.id),
    getVolumenSemanal(user.id, 12),
    getRecordsRecientes(user.id, 3),
  ]);

  const nombrePila = user.nombre.split(" ")[0];

  return (
    <div>
      <div className="home-head">
        <div className="eyebrow">{fechaLarga(new Date())}</div>
        <h1>Hola, {nombrePila}</h1>
        <p className="text-muted">
          {plan
            ? `Semana ${plan.semanaActual} de ${plan.semanas} — ${plan.routineNombre}${
                plan.coachNombre ? ` · Plan de ${plan.coachNombre}` : ""
              }`
            : "Sin plan asignado todavía"}
        </p>
      </div>

      <StatStrip
        stats={[
          {
            label: "Sesiones",
            value: (
              <>
                {resumen.sesionesHechas}
                <span className="stat-unit--muted">/{resumen.sesionesPlan}</span>
              </>
            ),
          },
          { label: "Volumen", value: miles(resumen.volumenKg), unidad: "kg" },
          { label: "Racha", value: resumen.rachaSemanas, unidad: "sem" },
          { label: "Tiempo", value: duracionCorta(resumen.tiempoS) },
        ]}
      />

      <div className="split">
        <section>
          <h6>Próxima sesión</h6>
          {dia ? (
            <div className="next-session">
              <div className="next-session-title">
                <h3>{dia.titulo}</h3>
                <span className="tag tag-accent">{dia.ejercicios.length} ejercicios</span>
              </div>
              <p className="text-muted">
                {dia.subtitulo}
                {dia.duracionMin ? ` · ~${dia.duracionMin} min` : ""}
              </p>

              <div className="rows">
                {dia.ejercicios.map((e) => (
                  <div className="row" key={e.id}>
                    <ExerciseName nombre={e.nombre} alias={e.alias} />
                    <span className="text-muted">
                      {e.series} × {e.reps} · {carga(e.cargaKg, e.cargaTexto)}
                    </span>
                  </div>
                ))}
              </div>

              {/* POST, no enlace: crear la sesión es una mutación. */}
              <form action={empezarSesion.bind(null, dia.id)}>
                <button className="btn btn-primary btn-block" type="submit">
                  Empezar entrenamiento →
                </button>
              </form>
            </div>
          ) : (
            <p className="text-muted">
              No hay ningún plan activo. Pedile uno a tu entrenador o creá una rutina en{" "}
              <Link href="/rutinas">Rutinas</Link>.
            </p>
          )}
        </section>

        <section>
          <h6>Volumen por semana</h6>
          <WeeklyVolumeChart semanas={semanas} />

          <h6 style={{ margin: "28px 0 12px" }}>Récords recientes</h6>
          {records.length > 0 ? (
            <div className="rows">
              {records.map((r, i) => (
                <div className="row row--tall" key={`${r.nombre}-${i}`}>
                  <ExerciseName nombre={r.nombre} alias={r.alias} />
                  <span className="num">
                    {kg(r.kg)} kg × {r.reps}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted" style={{ fontSize: 13 }}>
              Todavía no hay marcas registradas.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
