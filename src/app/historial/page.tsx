import { contarSesiones, getHistorial } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { diaMes, duracion, miles } from "@/lib/format";

import { AccionesSesion } from "./acciones-sesion";

export const dynamic = "force-dynamic";

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default async function HistorialPage() {
  const user = await getCurrentUser();
  const [sesiones, conteo] = await Promise.all([getHistorial(user.id), contarSesiones(user.id)]);

  return (
    <div>
      <div className="screen-head">
        <h1>Historial</h1>
        <p className="text-muted">
          {conteo.total} entrenamientos registrados
          {conteo.desde &&
            ` desde ${MESES_LARGOS[conteo.desde.getMonth()]} de ${conteo.desde.getFullYear()}`}
        </p>
      </div>

      {sesiones.length === 0 ? (
        <p className="empty">Todavía no hay entrenamientos registrados.</p>
      ) : (
        sesiones.map((s) => {
          const { dia, mes } = diaMes(s.fecha);
          return (
            <div className="history-row" key={s.id}>
              <div className="history-date">
                <div className="history-day">{dia}</div>
                <div className="history-month">{mes}</div>
              </div>
              <div>
                <div className="history-title">
                  <h5>{s.titulo}</h5>
                  {s.tuvoPr && <span className="tag tag-accent">PR</span>}
                </div>
                <div className="history-summary text-muted">
                  {s.series} series · {miles(s.volumenKg)} kg · {duracion(s.duracionS)}
                </div>
                <AccionesSesion
                  sesionId={s.id}
                  titulo={s.titulo}
                  series={s.series}
                  volumenKg={s.volumenKg}
                  tuvoPr={s.tuvoPr}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
