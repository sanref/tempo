import { Sk, SkPantalla } from "@/components/skeleton";

/**
 * La barra superior va sobre fondo oscuro, así que sus bloques no se pintan
 * con `.sk` (gris claro sobre negro chillaría): se dejan huecos del alto justo
 * para que el reloj y las cifras aparezcan sin mover nada.
 */
export default function Loading() {
  return (
    <SkPantalla>
      <div className="session">
        <div className="session-sticky">
          <div className="session-topbar">
            <div>
              {/* Sin etiqueta: la pantalla puede abrirse en curso o corrigiendo,
                  y adelantar la equivocada da un parpadeo raro. */}
              <div className="eyebrow" style={{ opacity: 0.4 }}>
                &nbsp;
              </div>
              <div className="session-clock" style={{ opacity: 0.4 }}>
                --:--
              </div>
            </div>
            <div className="session-meta" style={{ opacity: 0.4 }}>
              <div>
                <div className="session-meta-label">Series</div>
                <div className="session-meta-value">—</div>
              </div>
              <div>
                <div className="session-meta-label">Volumen</div>
                <div className="session-meta-value">—</div>
              </div>
            </div>
          </div>

          <div className="session-progress" />
        </div>

        {Array.from({ length: 3 }, (_, b) => (
          <section className="exercise-block" key={b}>
            <div className="exercise-head">
              <div className="exercise-name">
                <Sk ancho="180px" alto="subtitulo" />
              </div>
              <Sk ancho="88px" alto="tag" />
            </div>

            <div className="set-grid set-head">
              <div>Ser</div>
              <div>Anterior</div>
              <div>Kg</div>
              <div>Reps</div>
              <div />
            </div>

            {Array.from({ length: 4 }, (_, s) => (
              <div className="set-grid set-row" key={s}>
                <Sk ancho="14px" alto="texto" />
                <Sk ancho="70%" alto="texto" />
                <Sk ancho="100%" alto="boton" style={{ height: 36 }} />
                <Sk ancho="100%" alto="boton" style={{ height: 36 }} />
                <Sk ancho="34px" alto="boton" style={{ height: 32 }} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </SkPantalla>
  );
}
