import Link from "next/link";

import {
  getClientes,
  getInvitaciones,
  getResumenCoach,
  getRutinasAsignables,
} from "@/db/queries";
import { esEntrenador, getCoach, getCurrentUser } from "@/lib/auth";
import { desde } from "@/lib/format";

import { AsignarRutina } from "./asignar-rutina";
import { Canjear } from "./canjear";
import { DesvincularAlumno } from "./desvincular-alumno";
import { Invitaciones } from "./invitaciones";

export const dynamic = "force-dynamic";

/** Por debajo de este porcentaje el cliente se marca en riesgo. */
const RIESGO = 65;

export default async function CoachPage() {
  const user = await getCurrentUser();

  // El alumno ve el panel de su propio entrenador; el entrenador, el suyo.
  const coachId = esEntrenador(user) ? user.id : user.coachId;

  // Un alumno suelto no se queda en un callejón: acá canjea el código que le
  // pasó su entrenador, que es lo único que escribe `users.coach_id`.
  if (!coachId) {
    return <Canjear tieneCoach={false} />;
  }

  const [clientes, resumen, rutinas] = await Promise.all([
    getClientes(coachId),
    getResumenCoach(coachId),
    getRutinasAsignables(coachId),
  ]);

  // Asignar e invitar son cosa del entrenador: el alumno ve el panel de solo
  // lectura del suyo.
  const puedeAsignar = esEntrenador(user);
  const invitaciones = puedeAsignar ? await getInvitaciones(user.id) : [];
  const alumnos = clientes.map((c) => ({ id: c.id, nombre: c.nombre, plan: c.plan }));

  // Para el pie del alumno: a quién deja y si al irse pierde algo de vista.
  const miCoach = puedeAsignar ? null : await getCoach(user);
  const miPlan = puedeAsignar ? false : Boolean(clientes.find((c) => c.id === user.id)?.routineId);

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

      {clientes.length === 0 ? (
        <p className="empty">
          {puedeAsignar
            ? "Todavía no tenés alumnos. Generá un código abajo y pasáselo a quien quieras sumar."
            : "Tu entrenador todavía no tiene alumnos registrados."}
        </p>
      ) : (
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
                        <>
                          <AsignarRutina
                            alumnos={alumnos}
                            rutinas={rutinas}
                            alumnoFijo={{ id: c.id, nombre: c.nombre, plan: c.plan }}
                            etiqueta={c.routineId ? "Cambiar" : "Asignar"}
                            variante="btn-ghost"
                          />
                          <DesvincularAlumno
                            alumno={{ id: c.id, nombre: c.nombre }}
                            tienePlan={Boolean(c.routineId)}
                          />
                        </>
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
      )}

      {puedeAsignar ? (
        <Invitaciones invitaciones={invitaciones} />
      ) : (
        <Canjear tieneCoach coachNombre={miCoach?.nombre} tienePlan={miPlan} />
      )}
    </div>
  );
}
