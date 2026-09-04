import { capaUrl, resolverMusculos, siluetaUrl } from "@/lib/ejercicios-externos";

/**
 * Qué músculos trabaja un ejercicio, dibujado sobre las dos siluetas de wger.
 *
 * Server component: no tiene estado, solo apila capas. Cada capa es un SVG de
 * wger usado como **máscara**, no como imagen — así la forma la pone el archivo
 * y el color lo pone `--color-accent`, en vez del rojo que traen de origen.
 * De paso el asset se queda sin tocar, que con una licencia share-alike es lo
 * cómodo.
 *
 * Solo se pinta la silueta que tiene algo que enseñar: para un curl de bíceps
 * la espalda estaría vacía y una silueta en blanco parece un error de carga.
 *
 * El texto de debajo no es un pie de foto: es la respuesta completa. Cinco de
 * los diecisiete músculos del léxico no tienen SVG en wger, y para esos —
 * lumbares, antebrazos, aductores, abductores, cuello— la lista es lo único
 * que se ve. Por eso va siempre, aunque haya dibujo.
 */
export function MuscleDiagram({
  primarios,
  secundarios,
  compacto = false,
}: {
  primarios: string[] | null;
  secundarios: string[] | null;
  /** En la tarjeta de la biblioteca solo caben los nombres. */
  compacto?: boolean;
}) {
  const m = resolverMusculos(primarios, secundarios);

  if (!m.primarios.length && !m.secundarios.length) return null;

  // En la rejilla la lista se recorta. Un peso muerto arrastra ocho músculos
  // secundarios y, como todas las tarjetas de una fila crecen hasta la más
  // alta, una sola desalineaba la fila entera. Los primarios nunca se recortan:
  // son la respuesta a "qué entreno hoy".
  const TOPE = 3;
  const secus = compacto ? m.secundarios.slice(0, TOPE) : m.secundarios;
  const resto = compacto ? m.secundarios.length - secus.length : 0;

  return (
    <div className="musculos">
      {!compacto && m.hayDiagrama && (
        <div className="musculos-siluetas">
          {m.frente.length > 0 && <Silueta cara="frente" capas={m.frente} />}
          {m.espalda.length > 0 && <Silueta cara="espalda" capas={m.espalda} />}
        </div>
      )}

      <p className="musculos-lista">
        {m.primarios.length > 0 && (
          <>
            <span className="musculos-etiqueta">Trabaja</span> {m.primarios.join(", ")}
          </>
        )}
        {secus.length > 0 && (
          <>
            <span className="musculos-etiqueta"> También</span> {secus.join(", ")}
            {resto > 0 && ` y ${resto} más`}
          </>
        )}
      </p>
    </div>
  );
}

function Silueta({
  cara,
  capas,
}: {
  cara: "frente" | "espalda";
  capas: { wgerId: number; principal: boolean }[];
}) {
  return (
    <div className="musculos-cara">
      {/* La silueta ya viene en grises desde wger; no lleva .grayscale. */}
      <img src={siluetaUrl(cara)} alt={cara === "frente" ? "Vista de frente" : "Vista de espalda"} />
      {capas.map((c) => (
        <span
          key={c.wgerId}
          className={c.principal ? "musculos-capa" : "musculos-capa musculos-capa--secundaria"}
          style={{ maskImage: `url(${capaUrl(c.wgerId, c.principal)})` }}
        />
      ))}
    </div>
  );
}
