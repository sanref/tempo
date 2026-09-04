import Link from "next/link";
import { redirect } from "next/navigation";

import { empezarSesion } from "@/app/actions";
import { ExerciseName } from "@/components/exercise-name";
import { getProximoDia, getSesionEnCurso } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { carga } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Antesala de la sesión.
 *
 * Si hay una sesión abierta se reanuda directo. Si no, se confirma con un
 * POST: empezar un entrenamiento crea filas, y una navegación GET no debe
 * hacerlo — Next prefetchea los enlaces al pasar el ratón y acabaríamos
 * abriendo sesiones fantasma.
 */
export default async function EntrenarPage() {
  const user = await getCurrentUser();

  const enCurso = await getSesionEnCurso(user.id);
  if (enCurso) redirect(`/entrenar/${enCurso}`);

  const dia = await getProximoDia(user.id);

  if (!dia) {
    return (
      <div className="empty">
        No tenés ningún plan activo. Elegí una rutina en <Link href="/rutinas">Rutinas</Link> para
        empezar a entrenar.
      </div>
    );
  }

  return (
    <div>
      <div className="screen-head">
        <div className="eyebrow">Hoy toca</div>
        <h1>{dia.titulo}</h1>
        <p className="text-muted">
          {dia.subtitulo}
          {dia.duracionMin ? ` · ~${dia.duracionMin} min` : ""}
        </p>
      </div>

      <section style={{ padding: "24px 20px", maxWidth: 620 }}>
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

        <form action={empezarSesion.bind(null, dia.id)}>
          <button className="btn btn-primary btn-block" type="submit">
            Empezar entrenamiento →
          </button>
        </form>

        <Link className="btn btn-ghost" href="/rutinas" style={{ marginTop: 12 }}>
          Elegir otro día
        </Link>
      </section>
    </div>
  );
}
