"use client";

import { useState } from "react";

import { crearEjercicio, editarEjercicio, type EjercicioNuevo } from "@/app/actions";

/**
 * Alta y edición de ejercicio. Solo los campos: quien lo envuelve decide si va
 * en un diálogo suelto (/ejercicios) o dentro del selector del editor.
 *
 * Con `ejercicio` edita esa fila; sin él, crea una nueva.
 *
 * El grupo se elige con radios, no con un `<select>` nativo: el sistema trae
 * sus propios controles y un desplegable del sistema operativo sería la única
 * pieza de la app con cromo ajeno.
 */
export function ExerciseForm({
  grupos,
  equipos,
  ejercicio,
  nombreInicial = "",
  onGuardado,
  onCancelar,
  textoEnvio,
}: {
  grupos: string[];
  equipos: string[];
  ejercicio?: { id: string; nombre: string; grupo: string; equipo: string };
  nombreInicial?: string;
  onGuardado: (ejercicio: EjercicioNuevo) => void | Promise<void>;
  onCancelar: () => void;
  textoEnvio?: string;
}) {
  const [nombre, setNombre] = useState(ejercicio?.nombre ?? nombreInicial);
  const [grupo, setGrupo] = useState(ejercicio?.grupo ?? grupos[0] ?? "Pecho");
  const [equipo, setEquipo] = useState(ejercicio?.equipo ?? "");
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const enviar = async () => {
    setEnviando(true);
    setFallo(null);
    try {
      const guardado = ejercicio
        ? await editarEjercicio(ejercicio.id, { nombre, grupo, equipo })
        : await crearEjercicio({ nombre, grupo, equipo });
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
              <input
                type="radio"
                name="grupo"
                checked={grupo === g}
                onChange={() => setGrupo(g)}
              />
              <span className="dot" />
              {g}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="ej-equipo">Equipamiento</label>
        <input
          id="ej-equipo"
          className="input"
          value={equipo}
          onChange={(ev) => setEquipo(ev.target.value)}
          placeholder="Banda elástica"
          list="equipos-conocidos"
          required
        />
        {/* Sugerencias de lo que ya hay, para no acabar con "mancuernas",
            "Mancuernas" y "mancuerna" como tres equipamientos distintos. */}
        <datalist id="equipos-conocidos">
          {equipos.map((e) => (
            <option value={e} key={e} />
          ))}
        </datalist>
      </div>

      <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
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
