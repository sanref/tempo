import Link from "next/link";
import { notFound } from "next/navigation";

import { nombreVisible } from "@/components/exercise-name";
import { ExercisePhoto } from "@/components/exercise-photo";
import { MuscleDiagram } from "@/components/muscle-diagram";
import { getEjercicio, getEquipos, getGrupos } from "@/db/queries";
import { esAdmin, getCurrentUser } from "@/lib/auth";
import { miles } from "@/lib/format";

import { AccionesEjercicio } from "../acciones-ejercicio";
import { AliasEjercicio } from "../alias-ejercicio";

export const dynamic = "force-dynamic";

/**
 * Detalle de un ejercicio: qué es y qué trabaja.
 *
 * Es el sitio del diagrama muscular. En la rejilla de la biblioteca no cabe
 * —dos siluetas legibles piden más ancho del que da una tarjeta de 230 px, y
 * multiplicarlas por sesenta y nueve hace la página inmanejable—, así que allí
 * solo van los nombres y el dibujo vive aquí.
 *
 * `getEjercicio()` aplica el mismo filtro de visibilidad que la biblioteca, y
 * el `notFound()` cuelga de eso: sin él, esta ruta sería una forma de leer el
 * ejercicio privado de cualquiera sabiendo su id.
 */
export default async function DetalleEjercicioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const admin = esAdmin(user);

  const ejercicio = await getEjercicio(id, user.id);
  if (!ejercicio) notFound();

  const [grupos, equipos] = await Promise.all([getGrupos(), getEquipos(user.id)]);

  return (
    <div>
      <div style={{ padding: "20px 20px 0" }}>
        <Link className="btn btn-ghost" href="/ejercicios">
          ← Ejercicios
        </Link>
      </div>

      <div className="detail-head">
        <div className="eyebrow">
          {ejercicio.esMio ? "Ejercicio propio" : "Catálogo común"}
        </div>
        <h1>{nombreVisible(ejercicio)}</h1>
        <p className="text-muted">
          {/* Con alias, el nombre del catálogo abre la línea: aquí hay sitio y
              es el dato que ancla la fila. `nombreEn` va después y es otra cosa
              —del catálogo externo, no una traducción nuestra—, así que solo se
              repite si alguien llamó al ejercicio igual que se llama. */}
          {ejercicio.alias && `${ejercicio.nombre} · `}
          {ejercicio.grupo} · {ejercicio.equipo}
          {ejercicio.nombreEn && ` · ${ejercicio.nombreEn}`}
        </p>

        {(ejercicio.esMio || admin) && (
          <div className="actions">
            <AccionesEjercicio
              ejercicio={{
                id: ejercicio.id,
                nombre: ejercicio.nombre,
                grupo: ejercicio.grupo,
                equipo: ejercicio.equipo,
                fedbId: ejercicio.fedbId,
                nombreEn: ejercicio.nombreEn,
                esPublico: ejercicio.esPublico,
              }}
              uso={{ rutinas: ejercicio.rutinas.length, series: ejercicio.series }}
              grupos={grupos}
              equipos={equipos}
              esAdmin={admin}
            />
          </div>
        )}
      </div>

      <div className="ejercicio-detalle">
        <section>
          <h2 className="seccion-titulo">El movimiento</h2>
          <div className="detalle-foto">
            <ExercisePhoto
              fedbId={ejercicio.fedbId}
              imagenUrl={ejercicio.imagenUrl}
              nombre={nombreVisible(ejercicio)}
            />
          </div>
          {ejercicio.fedbId && !ejercicio.imagenUrl && (
            <p className="text-muted detalle-pie">
              Las dos posiciones del recorrido, alternándose.
            </p>
          )}
        </section>

        <section>
          <h2 className="seccion-titulo">Músculos que trabaja</h2>
          {ejercicio.musculosPrimarios?.length ? (
            <MuscleDiagram
              primarios={ejercicio.musculosPrimarios}
              secundarios={ejercicio.musculosSecundarios}
            />
          ) : (
            <p className="empty">
              Sin datos de músculos. Se rellenan al enlazar el ejercicio con el catálogo.
            </p>
          )}
        </section>
      </div>

      <div className="ejercicio-detalle">
        <AliasEjercicio
          ejercicio={{ id: ejercicio.id, nombre: ejercicio.nombre, alias: ejercicio.alias }}
          variante="seccion"
        />

        <section>
          <h2 className="seccion-titulo">Dónde lo usás</h2>
          {ejercicio.rutinas.length === 0 ? (
            <p className="empty">No está en ninguna de tus rutinas.</p>
          ) : (
            <ul className="lista-rutinas">
              {ejercicio.rutinas.map((r) => (
                <li key={r.id}>
                  <Link href={`/rutinas/${r.id}`}>{r.nombre}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="seccion-titulo">Tu historial</h2>
          <p className="detalle-cifra">
            {miles(ejercicio.series)}{" "}
            <span className="text-muted">
              {ejercicio.series === 1 ? "serie registrada" : "series registradas"}
            </span>
          </p>
        </section>
      </div>
    </div>
  );
}
