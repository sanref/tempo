import Link from "next/link";

import { crearRutina } from "@/app/actions";
import { getRutinas } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FILTROS = ["Todas", "Activa", "Del entrenador", "Guardada", "Borrador"] as const;

export default async function RutinasPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const user = await getCurrentUser();
  const { filtro = "Todas" } = await searchParams;

  const todas = await getRutinas(user.id);
  const rutinas = filtro === "Todas" ? todas : todas.filter((r) => r.kicker === filtro);

  const activas = todas.filter((r) => r.status === "activa").length;
  const guardadas = todas.filter((r) => r.status !== "activa").length;

  return (
    <div>
      <div className="screen-head screen-head--split">
        <div>
          <h1>Rutinas</h1>
          <p className="text-muted">
            {activas} {activas === 1 ? "plan activo" : "planes activos"} · {guardadas} guardados
          </p>
        </div>
        {/* POST: crear una rutina inserta filas, no puede colgar de un GET
            que Next prefetchea al pasar el ratón por encima. */}
        <form action={crearRutina}>
          <button className="btn btn-primary" type="submit">
            + Nueva rutina
          </button>
        </form>
      </div>

      <div className="filter-row">
        {FILTROS.map((f) => (
          <Link
            key={f}
            href={f === "Todas" ? "/rutinas" : `/rutinas?filtro=${encodeURIComponent(f)}`}
            className={f === filtro ? "tag tag-outline" : "tag tag-neutral"}
          >
            {f}
          </Link>
        ))}
      </div>

      {rutinas.length === 0 ? (
        <p className="empty">No hay rutinas con ese filtro.</p>
      ) : (
        <div className="routine-grid">
          {rutinas.map((r) => (
            <Link className="routine-card" href={`/rutinas/${r.id}`} key={r.id}>
              <div className="kicker">{r.kicker}</div>
              <h4>{r.nombre}</h4>
              <p className="text-muted">{r.descripcion}</p>
              <div className="routine-card-meta">
                <span>
                  {r.dias} {r.dias === 1 ? "día" : "días"}
                </span>
                <span>{r.semanas} sem</span>
                <span>{r.nivel}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
