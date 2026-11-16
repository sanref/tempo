import { E1rmChart } from "@/components/e1rm-chart";
import { ExerciseName, nombreVisible } from "@/components/exercise-name";
import {
  getE1rmSemanal,
  getEjercicioDestacado,
  getMarcasPersonales,
  getSeriesPorGrupo,
} from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { fechaCorta, kg } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProgresoPage() {
  const user = await getCurrentUser();

  const [destacado, grupos, marcas] = await Promise.all([
    getEjercicioDestacado(user.id),
    getSeriesPorGrupo(user.id),
    getMarcasPersonales(user.id),
  ]);

  const serie = destacado ? await getE1rmSemanal(user.id, destacado.id, 12) : [];
  const puntos = serie.map((s) => s.e1rm);
  const conDatos = puntos.filter((p) => p > 0);
  const actual = conDatos.at(-1) ?? 0;
  const anterior = conDatos.at(-2) ?? actual;
  const delta = actual - anterior;

  const topeGrupo = Math.max(...grupos.map((g) => g.series), 1);

  return (
    <div>
      <div className="screen-head">
        <h1>Progreso</h1>
        <p className="text-muted">Últimas 12 semanas</p>
      </div>

      <div className="split progress-split">
        <section>
          {/* El <h6> del sistema va en versalitas y a 10px: el par en dos
              líneas no cabe ahí, así que el nombre real se queda fuera. Está a
              un clic en la biblioteca, y esta cabecera dice de qué es el
              gráfico, no identifica una fila del catálogo. */}
          <h6>{destacado ? `${nombreVisible(destacado)} — 1RM estimado` : "1RM estimado"}</h6>
          <div className="big-figure">
            {kg(actual)} kg{" "}
            {delta !== 0 && (
              <span>
                {delta > 0 ? "+" : ""}
                {kg(delta)}
              </span>
            )}
          </div>
          <E1rmChart puntos={puntos} />
        </section>

        <section>
          <h6>Series por grupo muscular · últimos 7 días</h6>
          {grupos.map((g) => (
            <div className="mg-row" key={g.grupo}>
              <span>{g.grupo}</span>
              <div className="track">
                <div style={{ width: `${Math.round((g.series / topeGrupo) * 100)}%` }} />
              </div>
              <span className="mg-value">{g.series}</span>
            </div>
          ))}
        </section>
      </div>

      <section style={{ padding: "24px 20px" }}>
        <h6>Marcas personales</h6>
        {marcas.length === 0 ? (
          <p className="text-muted" style={{ fontSize: "calc(13px * var(--escala-texto))" }}>
            Todavía no hay marcas registradas.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Ejercicio</th>
                  <th>Marca</th>
                  <th>Fecha</th>
                  <th>Cambio</th>
                </tr>
              </thead>
              <tbody>
                {marcas.map((m) => (
                  <tr key={m.nombre}>
                    <td style={{ fontWeight: 600 }}>
                      <ExerciseName nombre={m.nombre} alias={m.alias} />
                    </td>
                    <td>
                      {kg(m.kg)} kg × {m.reps}
                    </td>
                    <td className="text-muted">{fechaCorta(m.fecha)}</td>
                    <td className={m.deltaKg > 0 ? "pr-delta" : "text-muted"}>
                      {m.deltaKg > 0 ? `+${kg(m.deltaKg)} kg` : "="}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
