"use client";

import { useEffect, useRef, useState } from "react";

import {
  buscarCatalogo,
  crearEjercicio,
  editarEjercicio,
  type EjercicioNuevo,
} from "@/app/actions";
import { fotosEjercicio } from "@/lib/ejercicios-externos";

/** Lo que devuelve el buscador del catálogo externo. */
type Candidato = {
  id: string;
  nombre: string;
  primarios: string[];
  secundarios: string[];
};

export type EjercicioEditable = {
  id: string;
  nombre: string;
  grupo: string;
  equipo: string;
  descripcion?: string;
  fedbId?: string | null;
  nombreEn?: string | null;
  esPublico?: boolean;
};

/** Valor del `<option>` que abre el campo de texto; no puede ser un equipo real. */
const EQUIPO_NUEVO = "\0nuevo";

/**
 * Alta y edición de ejercicio. Solo los campos: quien lo envuelve decide si va
 * en un diálogo suelto (/ejercicios) o dentro del selector del editor.
 *
 * Con `ejercicio` edita esa fila; sin él, crea una nueva.
 *
 * El grupo se elige con radios: son ocho valores fijos y verlos todos a la vez
 * —sin desplegar— pega con el resto de la app. El equipamiento sí es un
 * `<select>` porque la lista es más larga y abierta; «Añadir nuevo…» revela un
 * campo de texto para dar de alta uno que no esté.
 *
 * `esAdmin` abre dos cosas que nadie más ve: publicar/despublicar, y editar
 * filas del catálogo común. Es solo la mitad de la puerta — la otra la
 * comprueba `ejercicioEditable()` en el servidor, que es la que cuenta.
 */
export function ExerciseForm({
  grupos,
  equipos,
  ejercicio,
  nombreInicial = "",
  onGuardado,
  onCancelar,
  textoEnvio,
  esAdmin = false,
}: {
  grupos: string[];
  equipos: string[];
  ejercicio?: EjercicioEditable;
  nombreInicial?: string;
  onGuardado: (ejercicio: EjercicioNuevo) => void | Promise<void>;
  onCancelar: () => void;
  textoEnvio?: string;
  esAdmin?: boolean;
}) {
  const [nombre, setNombre] = useState(ejercicio?.nombre ?? nombreInicial);
  const [grupo, setGrupo] = useState(ejercicio?.grupo ?? grupos[0] ?? "Pecho");

  // El equipamiento se elige de la lista; «Añadir nuevo…» abre un campo de
  // texto. Arranca abierto si se edita un ejercicio cuyo equipamiento ya no
  // está en el catálogo visible, para no perderlo.
  const opcionesEquipo = equipos.filter(Boolean);
  const [equipo, setEquipo] = useState(ejercicio?.equipo ?? "");
  const [equipoNuevo, setEquipoNuevo] = useState(
    !!ejercicio?.equipo && !opcionesEquipo.includes(ejercicio.equipo),
  );
  const [descripcion, setDescripcion] = useState(ejercicio?.descripcion ?? "");
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  // Enlace al catálogo externo. `undefined` significa "no se tocó": es lo que
  // deja al servidor la columna como estaba, distinto de `null`, que la borra.
  const [enlace, setEnlace] = useState<{ id: string | null; nombre: string | null } | undefined>();
  const enlaceActual =
    enlace ?? { id: ejercicio?.fedbId ?? null, nombre: ejercicio?.nombreEn ?? null };

  const esComun = ejercicio?.esPublico ?? false;
  const [esPublico, setEsPublico] = useState(esComun);

  const enviar = async () => {
    setEnviando(true);
    setFallo(null);
    try {
      const guardado = ejercicio
        ? await editarEjercicio(ejercicio.id, {
            nombre,
            grupo,
            equipo,
            // Quien abre el formulario sin haber traído la descripcion no la
            // manda: `undefined` la deja como está en vez de vaciarla.
            descripcion: ejercicio.descripcion === undefined ? undefined : descripcion,
            fedbId: enlace?.id,
            esPublico: esAdmin ? esPublico : undefined,
          })
        : await crearEjercicio({ nombre, grupo, equipo, descripcion, fedbId: enlace?.id });
      await onGuardado(guardado);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo guardar el ejercicio.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        void enviar();
      }}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
    >
      {esComun && (
        <p className="aviso-comun">
          Estás editando un ejercicio del catálogo común. El cambio lo ve todo el mundo.
        </p>
      )}

      <div className="field">
        <label htmlFor="ej-nombre">Nombre</label>
        <input
          id="ej-nombre"
          className="input"
          value={nombre}
          onChange={(ev) => setNombre(ev.target.value)}
          placeholder="Remo con banda"
          autoFocus
          required
        />
      </div>

      <div className="field">
        <label>Grupo muscular</label>
        <div className="grupo-grid">
          {grupos.map((g) => (
            <label className="radio" key={g}>
              <input type="radio" name="grupo" checked={grupo === g} onChange={() => setGrupo(g)} />
              <span className="dot" />
              {g}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="ej-equipo">Equipamiento</label>
        <select
          id="ej-equipo"
          className="input"
          value={equipoNuevo ? EQUIPO_NUEVO : equipo}
          onChange={(ev) => {
            const v = ev.target.value;
            if (v === EQUIPO_NUEVO) {
              setEquipoNuevo(true);
              // Un valor concreto ya elegido se limpia: «Añadir nuevo…» pide
              // teclear uno, no reaprovechar el anterior.
              if (opcionesEquipo.includes(equipo)) setEquipo("");
            } else {
              setEquipoNuevo(false);
              setEquipo(v);
            }
          }}
          required
        >
          <option value="" disabled>
            Elegí…
          </option>
          {/* Elegir de lo que ya hay evita acabar con "mancuernas",
              "Mancuernas" y "mancuerna" como tres equipamientos distintos. */}
          {opcionesEquipo.map((e) => (
            <option value={e} key={e}>
              {e}
            </option>
          ))}
          <option value={EQUIPO_NUEVO}>Añadir nuevo…</option>
        </select>
        {equipoNuevo && (
          <input
            className="input"
            style={{ marginTop: "var(--space-2)" }}
            value={equipo}
            onChange={(ev) => setEquipo(ev.target.value)}
            placeholder="Banda elástica"
            aria-label="Nuevo equipamiento"
            autoFocus
            required
          />
        )}
      </div>

      {(!ejercicio || ejercicio.descripcion !== undefined) && (
        <div className="field">
          <label htmlFor="ej-descripcion">Descripción</label>
          <textarea
            id="ej-descripcion"
            className="input"
            value={descripcion}
            onChange={(ev) => setDescripcion(ev.target.value)}
            placeholder="Cómo se hace, en qué fijarse, errores típicos. Opcional."
            maxLength={2000}
          />
        </div>
      )}

      <BuscadorCatalogo
        actual={enlaceActual}
        nombreEjercicio={nombre}
        onElegir={(c) => setEnlace(c ? { id: c.id, nombre: c.nombre } : { id: null, nombre: null })}
      />

      {esAdmin && (
        <label className="check">
          <input
            type="checkbox"
            checked={esPublico}
            onChange={(ev) => setEsPublico(ev.target.checked)}
          />
          <span>En el catálogo común</span>
        </label>
      )}

      {esAdmin && esComun && !esPublico && (
        <p className="aviso-comun">
          Al sacarlo del catálogo común desaparece de la biblioteca de los demás. Las rutinas
          que ya lo tengan lo siguen usando; simplemente nadie más podrá añadirlo. Pasa a ser
          tuyo y lo podés volver a publicar.
        </p>
      )}

      <p className="text-muted" style={{ fontSize: "calc(12px * var(--escala-texto))", margin: 0 }}>
        {ejercicio
          ? "El nombre nuevo sale en todas las rutinas y en el historial: se guarda por id."
          : "Será tuyo y no aparecerá en el catálogo de los demás."}
      </p>

      {fallo && <p className="editor-error">{fallo}</p>}

      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando
            ? "Guardando…"
            : (textoEnvio ?? (ejercicio ? "Guardar cambios" : "Crear ejercicio"))}
        </button>
      </div>
    </form>
  );
}

/**
 * Elegir la foto enlazando con free-exercise-db.
 *
 * La búsqueda va por server action y no contra un catálogo en el cliente: son
 * 139 KB que no tienen por qué viajar. Acepta español —el término pasa por el
 * glosario en el servidor—, así que se puede buscar "sentadilla búlgara".
 *
 * Se enseña la foto de cada candidato porque es el único modo de elegir bien:
 * entre `Barbell Squat` y `Front Barbell Squat` decide la imagen, no el nombre.
 */
function BuscadorCatalogo({
  actual,
  nombreEjercicio,
  onElegir,
}: {
  actual: { id: string | null; nombre: string | null };
  nombreEjercicio: string;
  onElegir: (c: Candidato | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [termino, setTermino] = useState("");
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [buscando, setBuscando] = useState(false);
  const pedido = useRef(0);

  // Debounce: se teclea más rápido de lo que conviene ir al servidor. El
  // contador descarta respuestas viejas que lleguen tarde y pisen a una nueva.
  useEffect(() => {
    if (!abierto) return;
    const t = termino.trim();
    if (t.length < 3) {
      setCandidatos([]);
      return;
    }

    const mio = ++pedido.current;
    setBuscando(true);
    const id = setTimeout(() => {
      void buscarCatalogo(t)
        .then((r) => {
          if (mio === pedido.current) setCandidatos(r);
        })
        .finally(() => {
          if (mio === pedido.current) setBuscando(false);
        });
    }, 300);

    return () => clearTimeout(id);
  }, [termino, abierto]);

  const abrir = () => {
    setAbierto(true);
    // Arranca con el nombre del ejercicio: casi siempre es la búsqueda buena.
    setTermino(nombreEjercicio.trim());
  };

  return (
    <div className="field">
      <label>Foto del movimiento</label>

      {actual.id ? (
        <div className="enlace-actual">
          <span className="enlace-thumb">
            <img className="grayscale" src={fotosEjercicio(actual.id)![0]} alt="" />
          </span>
          <span className="enlace-texto">
            <strong>{actual.nombre ?? actual.id}</strong>
            <small className="text-muted">Enlazado a free-exercise-db</small>
          </span>
          <button type="button" className="btn btn-ghost" onClick={() => onElegir(null)}>
            Quitar
          </button>
        </div>
      ) : (
        <p className="text-muted" style={{ fontSize: "calc(12px * var(--escala-texto))", margin: 0 }}>
          Sin foto. Se pinta «Imagen pendiente».
        </p>
      )}

      {!abierto ? (
        <button type="button" className="btn btn-ghost enlace-buscar" onClick={abrir}>
          {actual.id ? "Cambiar foto" : "Buscar foto"}
        </button>
      ) : (
        <>
          <input
            className="input"
            value={termino}
            onChange={(ev) => setTermino(ev.target.value)}
            placeholder="Buscar en el catálogo (en español o inglés)"
            aria-label="Buscar en el catálogo externo"
          />

          {termino.trim().length < 3 ? (
            <p className="text-muted" style={{ fontSize: "calc(12px * var(--escala-texto))", margin: 0 }}>
              Escribí al menos tres letras.
            </p>
          ) : buscando ? (
            <p className="text-muted" style={{ fontSize: "calc(12px * var(--escala-texto))", margin: 0 }}>
              Buscando…
            </p>
          ) : candidatos.length === 0 ? (
            <p className="text-muted" style={{ fontSize: "calc(12px * var(--escala-texto))", margin: 0 }}>
              Nada parecido. Puede que este ejercicio no exista en el catálogo — se queda sin
              foto, que es mejor que enseñar otro movimiento.
            </p>
          ) : (
            <div className="candidatos">
              {candidatos.map((c) => (
                <button
                  type="button"
                  className="candidato"
                  key={c.id}
                  onClick={() => {
                    onElegir(c);
                    setAbierto(false);
                  }}
                >
                  <span className="enlace-thumb">
                    <img className="grayscale" src={fotosEjercicio(c.id)![0]} alt="" loading="lazy" />
                  </span>
                  <span className="enlace-texto">
                    <strong>{c.nombre}</strong>
                    <small className="text-muted">{c.primarios.join(", ")}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
