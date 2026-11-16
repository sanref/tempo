"use client";

import { Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { guardarAlias } from "@/app/actions";

/**
 * "Mi nombre": cómo llama esta persona a un ejercicio.
 *
 * Aparece en **todos** los ejercicios visibles, no solo en los propios — al
 * revés que `AccionesEjercicio`, que edita el catálogo. El caso principal es
 * justo el contrario: ponerle tu nombre a una fila del catálogo común, que en
 * este dataset viene en inglés y que no podés renombrar sin cambiársela a todo
 * el mundo.
 *
 * Escribe en el acto, sin "Guardar" diferido como el editor de rutinas: es una
 * fila suelta que no forma parte de ninguna transacción mayor, y vaciar el
 * campo la borra.
 */
export function AliasEjercicio({
  ejercicio,
  variante = "boton",
}: {
  ejercicio: { id: string; nombre: string; alias: string | null };
  /**
   * `boton` es el icono de la rejilla, que comparte línea con las demás
   * acciones de la tarjeta; `seccion`, la versión con etiqueta y explicación
   * del detalle, donde hay sitio para contar la regla.
   */
  variante?: "boton" | "seccion";
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [alias, setAlias] = useState(ejercicio.alias ?? "");
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const abrir = () => {
    // Se rearma con lo que hay guardado: si abriste, escribiste y cancelaste,
    // volver a abrir tiene que enseñar el alias de verdad, no el descarte.
    setAlias(ejercicio.alias ?? "");
    setFallo(null);
    setAbierto(true);
  };

  const enviar = async () => {
    setGuardando(true);
    setFallo(null);
    try {
      await guardarAlias(ejercicio.id, alias);
      setAbierto(false);
      router.refresh();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo guardar el nombre.");
    } finally {
      setGuardando(false);
    }
  };

  const campos = (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        void enviar();
      }}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
    >
      <div className="field">
        <label htmlFor={`alias-${ejercicio.id}`}>Cómo lo llamás vos</label>
        <input
          id={`alias-${ejercicio.id}`}
          className="input"
          value={alias}
          onChange={(ev) => setAlias(ev.target.value)}
          placeholder={ejercicio.nombre}
          autoFocus
        />
      </div>

      <p className="text-muted" style={{ fontSize: "calc(12px * var(--escala-texto))", margin: 0 }}>
        Solo lo ves vos. El nombre del catálogo se sigue leyendo debajo, y dejarlo
        vacío vuelve a él.
      </p>

      {fallo && <p className="editor-error">{fallo}</p>}

      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );

  if (variante === "seccion") {
    return (
      <section>
        <h2 className="seccion-titulo">Cómo lo llamás vos</h2>
        {abierto ? (
          campos
        ) : (
          <>
            <p className="detalle-cifra">
              {ejercicio.alias ?? <span className="text-muted">{ejercicio.nombre}</span>}
            </p>
            <p className="text-muted" style={{ fontSize: "calc(13px * var(--escala-texto))", maxWidth: "48ch" }}>
              {ejercicio.alias
                ? "Es tu nombre para este ejercicio: lo ves en la biblioteca, en tus rutinas y mientras entrenás. Nadie más lo ve."
                : "Podés ponerle el nombre con el que lo conocés. Solo lo verías vos, y el del catálogo seguiría debajo."}
            </p>
            <button className="btn btn-secondary" onClick={abrir}>
              {ejercicio.alias ? "Cambiar mi nombre" : "Ponerle mi nombre"}
            </button>
          </>
        )}
      </section>
    );
  }

  // El estado ya se ve en la tarjeta —con alias, el nombre grande es el suyo y
  // el del catálogo queda debajo—, así que el icono no tiene que repetirlo: le
  // basta con decir en el título qué va a pasar al pulsarlo.
  const etiqueta = ejercicio.alias
    ? `Cambiar tu nombre para ${ejercicio.nombre} («${ejercicio.alias}»)`
    : `Ponerle tu nombre a ${ejercicio.nombre}`;

  return (
    <>
      <button
        className="btn btn-ghost btn-icon"
        onClick={abrir}
        title={etiqueta}
        aria-label={etiqueta}
      >
        <Tag size={16} />
      </button>

      {abierto && (
        <div
          className="dialog-backdrop"
          onClick={() => setAbierto(false)}
          onKeyDown={(ev) => ev.key === "Escape" && setAbierto(false)}
        >
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Cómo llamás a ${ejercicio.nombre}`}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="dialog-title">{ejercicio.nombre}</div>
            {campos}
          </div>
        </div>
      )}
    </>
  );
}
