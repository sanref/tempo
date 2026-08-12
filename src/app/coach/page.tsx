import Link from "next/link";

import { getClientes, getResumenCoach, getRutinasAsignables } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";
import { desde } from "@/lib/format";

import { AsignarRutina } from "./asignar-rutina";

export const dynamic = "force-dynamic";

/** Por debajo de este porcentaje el cliente se marca en riesgo. */
const RIESGO = 65;

export default async function CoachPage() {
  const user = await getCurrentUser();

  // El alumno ve el panel de su propio entrenador; el entrenador, el suyo.
  const coachId = user.role === "alumno" ? user.coachId : user.id;

  if (!coachId) {
    return <p className="empty">No tenés entrenador asignado.</p>;
  }

  const [clientes, resumen, rutinas] = await Promise.all([
    getClientes(coachId),
    getResumenCoach(coachId),
    getRutinasAsignables(coachId),
  ]);

  // Asignar es cosa del entrenador: el alumno ve el panel de solo lectura.
  const puedeAsignar = user.role !== "alumno";
  const alumnos = clientes.map((c) => ({ id: c.id, nombre: c.nombre, plan: c.plan }));

  return (
    <div>
      <div className="screen-head screen-head--split">
        <div>
          <div className="eyebrow">Vista entrenador</div>
          <h1>Clientes</h1>
          <p className="text-muted">
            {resumen.activos} activos · {resumen.riesgo} requieren atención esta semana
          </p>
        </div>
        {puedeAsignar ? (
          <AsignarRutina alumnos={alumnos} rutinas={rutinas} etiqueta="Asignar rutina" />
        ) : (
          <Link className="btn btn-secondary" href="/rutinas">
            Ver rutinas
          </Link>
        )}
      </div>

      <div style={{ padding: 20 }} className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Plan</th>
              <th>Semana</th>
              <th>Adherencia</th>
              <th>Última sesión</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => {
              const riesgo = c.adherencia < RIESGO;
              return (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  <td className="text-muted">{c.plan}</td>
                  <td>{c.semana}</td>
                  <td>
                    {/* Riesgo señalado con un gris más apagado, no con un
                        segundo color: el sistema es monocromo. */}
                    <div className="adherence" data-risk={riesgo}>
                      <div className="adherence-track" data-risk={riesgo}>
                        <div style={{ width: `${c.adherencia}%` }} />
                      </div>
                      <span className="adherence-pct">{c.adherencia}%</span>
                    </div>
                  </td>
                  <td className="text-muted">{desde(c.ultima)}</td>
                  <td>
                    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {c.routineId && (
                        <Link className="btn btn-ghost" href={`/rutinas/${c.routineId}`}>
                          Ver plan
                        </Link>
                      )}
                      {puedeAsignar && (
                        <AsignarRutina
                          alumnos={alumnos}
                          rutinas={rutinas}
                          alumnoFijo={{ id: c.id, nombre: c.nombre, plan: c.plan }}
                          etiqueta={c.routineId ? "Cambiar" : "Asignar"}
                          variante="btn-ghost"
                        />
                      )}
                      {!c.routineId && !puedeAsignar && <span className="text-muted">—</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
