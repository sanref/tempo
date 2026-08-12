import Link from "next/link";

import { getEjercicios, getEquipos, getGrupos, getUsosEjerciciosPropios } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";

import { AccionesEjercicio } from "./acciones-ejercicio";
import { NuevoEjercicio } from "./nuevo-ejercicio";

export const dynamic = "force-dynamic";

export default async function EjerciciosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; grupo?: string }>;
}) {
  const { q = "", grupo } = await searchParams;
  const user = await getCurrentUser();

  const [ejercicios, grupos, equipos, usos] = await Promise.all([
    getEjercicios(user.id, { q, grupo }),
    getGrupos(),
    getEquipos(),
    getUsosEjerciciosPropios(user.id),
  ]);

  const href = (g?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (g) p.set("grupo", g);
    const s = p.toString();
    return s ? `/ejercicios?${s}` : "/ejercicios";
  };

  return (
    <div>
      <div className="screen-head screen-head--split">
        <div style={{ flex: 1 }}>
          <h1 style={{ marginBottom: 10 }}>Ejercicios</h1>
          {/* Búsqueda por GET: sobrevive al refresco y es enlazable. */}
          <form>
            {grupo && <input type="hidden" name="grupo" value={grupo} />}
            <input
              className="input"
              style={{ maxWidth: 420 }}
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar ejercicio, grupo o equipamiento"
              aria-label="Buscar ejercicio"
            />
          </form>
        </div>
        <NuevoEjercicio grupos={grupos} equipos={equipos} />
      </div>

      <div className="filter-row">
        <Link className={!grupo ? "tag tag-outline" : "tag tag-neutral"} href={href()}>
          Todos
        </Link>
        {grupos.map((g) => (
          <Link key={g} className={grupo === g ? "tag tag-outline" : "tag tag-neutral"} href={href(g)}>
            {g}
          </Link>
        ))}
      </div>

      {ejercicios.length === 0 ? (
        <p className="empty">Ningún ejercicio coincide con la búsqueda.</p>
      ) : (
        <div className="library-grid">
          {ejercicios.map((e) => (
            <div className="library-card" key={e.id}>
              <div className="library-thumb">
                {/* Placeholder del diseño. Al poner foto real, envolverla en .grayscale */}
                <span>{e.imagenUrl ? "" : "Imagen pendiente"}</span>
              </div>
              <div className="library-body">
                {/* Mismo distintivo que el kicker de las tarjetas de rutina. */}
                {e.esMio && <div className="kicker">Mío</div>}
                <strong>{e.nombre}</strong>
                <span className="text-muted">
                  {e.grupo} · {e.equipo}
                </span>
                {e.esMio && (
                  <AccionesEjercicio
                    ejercicio={{
                      id: e.id,
                      nombre: e.nombre,
                      grupo: e.grupo,
                      equipo: e.equipo,
                    }}
                    uso={usos[e.id] ?? { rutinas: 0, series: 0 }}
                    grupos={grupos}
                    equipos={equipos}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
