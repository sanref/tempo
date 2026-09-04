import Link from "next/link";

import { ExerciseName, nombreVisible } from "@/components/exercise-name";
import { ExercisePhoto } from "@/components/exercise-photo";
import { MuscleDiagram } from "@/components/muscle-diagram";
import {
  getEjercicios,
  getEquipos,
  getGrupos,
  getRutinasConDias,
  getUsosEjerciciosPropios,
} from "@/db/queries";
import { esAdmin, getCurrentUser } from "@/lib/auth";
import { motivoUso } from "@/lib/format";

import { AccionesEjercicio } from "./acciones-ejercicio";
import { AgregarARutina } from "./agregar-a-rutina";
import { AliasEjercicio } from "./alias-ejercicio";
import { NuevoEjercicio } from "./nuevo-ejercicio";

export const dynamic = "force-dynamic";

// ~48 tarjetas por página: a 656+ ejercicios traerlos todos de una vez es
// justo lo que ExercisePhoto no soporta bien (ver ese componente) y vuelve
// pesada la carga inicial. 48 son ~7 MB de fotos, no los ~92 MB del catálogo
// entero.
const POR_PAGINA = 48;

export default async function EjerciciosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; grupo?: string; equipo?: string; p?: string }>;
}) {
  const { q = "", grupo, equipo, p } = await searchParams;
  const user = await getCurrentUser();
  const admin = esAdmin(user);

  const pagina = Math.max(1, Number(p) || 1);

  const [{ ejercicios, total }, grupos, equipos, usos, rutinas] = await Promise.all([
    getEjercicios(user.id, {
      q,
      grupo,
      equipo,
      limite: POR_PAGINA,
      offset: (pagina - 1) * POR_PAGINA,
    }),
    getGrupos(),
    getEquipos(user.id),
    // El admin edita y borra todo el catálogo, así que necesita los usos de
    // todo: son los que sostienen el aviso de "está en N rutinas".
    getUsosEjerciciosPropios(user.id, admin),
    // Para "Añadir a rutina": las mismas en las 48 tarjetas, una sola carga.
    getRutinasConDias(user.id),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  /**
   * Un enlace conservando el resto del filtrado, con lo que se le pase encima.
   *
   * Uno solo para los chips y para las páginas: con dos filtros y la búsqueda
   * son ya tres cosas que arrastrar, y tenerlas repartidas en dos funciones
   * era cómo un filtro nuevo se perdía al paginar.
   *
   * Cambiar de filtro vuelve a la página 1 a propósito, y sale gratis: `p`
   * solo se pone si se pide explícitamente.
   */
  const href = (cambio: { grupo?: string; equipo?: string; p?: number } = {}) => {
    const params = new URLSearchParams();
    // `"grupo" in cambio` y no `cambio.grupo`: pasar undefined a propósito es
    // cómo el chip "Todos" limpia ese filtro sin tocar el otro.
    const g = "grupo" in cambio ? cambio.grupo : grupo;
    const eq = "equipo" in cambio ? cambio.equipo : equipo;
    if (q) params.set("q", q);
    if (g) params.set("grupo", g);
    if (eq) params.set("equipo", eq);
    if (cambio.p && cambio.p > 1) params.set("p", String(cambio.p));
    const s = params.toString();
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
            {equipo && <input type="hidden" name="equipo" value={equipo} />}
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

      {/* Dos filas de chips, no una: son ejes distintos y se combinan —"Pierna"
          con "Mancuernas"—. La etiqueta de cada una desambigua los dos "Todos",
          y su ancho fijo alinea el primer chip de ambas. */}
      <div className="filter-row">
        <span className="filter-label">Grupo</span>
        <Link
          className={!grupo ? "tag tag-outline" : "tag tag-neutral"}
          href={href({ grupo: undefined })}
        >
          Todos
        </Link>
        {grupos.map((g) => (
          <Link
            key={g}
            className={grupo === g ? "tag tag-outline" : "tag tag-neutral"}
            href={href({ grupo: g })}
          >
            {g}
          </Link>
        ))}
      </div>

      <div className="filter-row">
        <span className="filter-label">Equipo</span>
        <Link
          className={!equipo ? "tag tag-outline" : "tag tag-neutral"}
          href={href({ equipo: undefined })}
        >
          Todos
        </Link>
        {equipos.map((eq) => (
          <Link
            key={eq}
            className={equipo === eq ? "tag tag-outline" : "tag tag-neutral"}
            href={href({ equipo: eq })}
          >
            {eq}
          </Link>
        ))}
      </div>

      {ejercicios.length === 0 ? (
        <p className="empty">Ningún ejercicio coincide con la búsqueda.</p>
      ) : (
        <div className="library-grid">
          {ejercicios.map((e) => {
            // Editar y borrar solo salen sobre lo propio; para un admin, sobre
            // todo. El aviso de "está en N rutinas" explica el borrado, así que
            // acompaña a esos mismos botones y no se pinta sin ellos.
            const puedeTocarlo = e.esMio || admin;
            const uso = usos[e.id] ?? { rutinas: 0, series: 0 };
            const motivo = puedeTocarlo ? motivoUso(uso) : null;

            return (
              <div className="library-card" key={e.id}>
                {/* La foto y el nombre llevan al detalle, donde está el diagrama
                    muscular. Es una lectura, así que va por <Link>: las
                    mutaciones nunca cuelgan de un GET. */}
                <Link className="library-thumb" href={`/ejercicios/${e.id}`}>
                  <ExercisePhoto fedbId={e.fedbId} imagenUrl={e.imagenUrl} nombre={nombreVisible(e)} />
                </Link>
                <div className="library-body">
                  {/* Mismo distintivo que el kicker de las tarjetas de rutina. */}
                  {e.esMio && <div className="kicker">Mío</div>}
                  <Link className="library-nombre" href={`/ejercicios/${e.id}`}>
                    <strong>
                      <ExerciseName nombre={e.nombre} alias={e.alias} />
                    </strong>
                  </Link>
                  <span className="text-muted">
                    {e.grupo} · {e.equipo}
                  </span>
                  {/* En la rejilla solo los nombres: el dibujo pide más sitio del
                      que da una tarjeta de 230px y se ve en el detalle. */}
                  <MuscleDiagram
                    primarios={e.musculosPrimarios}
                    secundarios={e.musculosSecundarios}
                    compacto
                  />
                  {/* Las cuatro acciones en una sola línea de iconos. La fila la
                      dibuja la tarjeta y no cada componente: son tres piezas
                      distintas —y la última ni siquiera aparece siempre— así que
                      si cada una traía su envoltorio salían tres renglones. */}
                  <div className="library-acciones">
                    <AgregarARutina
                      ejercicio={{ id: e.id, nombre: nombreVisible(e) }}
                      rutinas={rutinas}
                    />
                    {/* Fuera del `esMio || admin` de al lado a propósito: ponerle
                        tu nombre a una fila del catálogo común lo puede hacer
                        cualquiera — no cambia el catálogo, solo cómo lo ves vos. */}
                    <AliasEjercicio ejercicio={{ id: e.id, nombre: e.nombre, alias: e.alias }} />
                    {puedeTocarlo && (
                      <AccionesEjercicio
                        compacto
                        ejercicio={{
                          id: e.id,
                          nombre: e.nombre,
                          grupo: e.grupo,
                          equipo: e.equipo,
                          fedbId: e.fedbId,
                          nombreEn: e.nombreEn,
                          esPublico: e.esPublico,
                        }}
                        uso={uso}
                        grupos={grupos}
                        equipos={equipos}
                        esAdmin={admin}
                      />
                    )}
                  </div>

                  {/* Debajo de la fila, no dentro: es una frase, no un botón. */}
                  {motivo && <span className="library-uso">Está {motivo}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPaginas > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            marginTop: "var(--space-4)",
          }}
        >
          {pagina > 1 ? (
            <Link className="btn btn-secondary" href={href({ p: pagina - 1 })}>
              ← Anterior
            </Link>
          ) : (
            <button className="btn btn-secondary" disabled>
              ← Anterior
            </button>
          )}
          <span className="text-muted">
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Link className="btn btn-secondary" href={href({ p: pagina + 1 })}>
              Siguiente →
            </Link>
          ) : (
            <button className="btn btn-secondary" disabled>
              Siguiente →
            </button>
          )}
        </div>
      )}

      {/* Los diagramas de wger son CC-BY-SA 3.0 y la atribución es parte de la
          licencia, no cortesía. Las fotos son de dominio público y no la
          exigen; se citan igual porque cuesta lo mismo. */}
      <p className="creditos">
        Fotos de{" "}
        <a href="https://github.com/yuhonas/free-exercise-db" rel="noreferrer noopener" target="_blank">
          free-exercise-db
        </a>{" "}
        (dominio público). Diagramas musculares de{" "}
        <a href="https://wger.de" rel="noreferrer noopener" target="_blank">
          wger
        </a>
        , bajo{" "}
        <a
          href="https://creativecommons.org/licenses/by-sa/3.0/deed.es"
          rel="noreferrer noopener"
          target="_blank"
        >
          CC BY-SA 3.0
        </a>
        .
      </p>
    </div>
  );
}
