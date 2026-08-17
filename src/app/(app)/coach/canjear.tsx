"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { canjearInvitacion, dejarEntrenador } from "@/app/actions";

/**
 * Canjear un código y, si ya hay entrenador, irse.
 *
 * El canje es la única forma de rellenar `users.coach_id`: hace falta un código
 * que generó el entrenador, así que el vínculo lo consienten los dos lados.
 * Irse, en cambio, es unilateral — nadie tiene que pedir permiso para dejar de
 * ser entrenado.
 */
export function Canjear({
  tieneCoach,
  coachNombre,
  tienePlan = false,
}: {
  tieneCoach: boolean;
  coachNombre?: string | null;
  tienePlan?: boolean;
}) {
  const router = useRouter();

  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const dejar = async () => {
    setEnviando(true);
    setFallo(null);
    try {
      await dejarEntrenador();
      setConfirmando(false);
      router.refresh();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo desvincular.");
    } finally {
      setEnviando(false);
    }
  };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setEnviando(true);
    setFallo(null);
    try {
      await canjearInvitacion(codigo);
      setCodigo("");
      router.refresh();
    } catch (e) {
      setFallo(e instanceof Error ? e.message : "No se pudo canjear el código.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="canjear">
      <div className="screen-head">
        <div className="eyebrow">Entrenador</div>
        <h1>{tieneCoach ? "Cambiar de entrenador" : "Todavía no tenés entrenador"}</h1>
        <p className="text-muted">
          {tieneCoach
            ? "Si te pasaron otro código, canjealo acá. Tu historial y tu plan actual no se tocan."
            : "Pedile un código a tu entrenador y canjealo acá para ver su panel y recibir planes."}
        </p>
      </div>

      <form onSubmit={enviar} className="canjear-form">
        <div className="field">
          <label htmlFor="codigo">Código de invitación</label>
          <input
            id="codigo"
            className="input canjear-input"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="ABCD2345"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
          />
        </div>

        {fallo && <p className="editor-error">{fallo}</p>}

        <button className="btn btn-primary btn-block" disabled={enviando || !codigo.trim()}>
          {enviando ? "Canjeando…" : "Canjear código"}
        </button>
      </form>

      {tieneCoach && (
        <div className="canjear-salir">
          <p className="text-muted">
            ¿Ya no entrenás con {coachNombre ?? "tu entrenador"}? Podés desvincularte sin
            canjear otro código.
          </p>
          <button className="btn btn-secondary" onClick={() => setConfirmando(true)}>
            Dejar a {coachNombre ?? "mi entrenador"}
          </button>
        </div>
      )}

      {confirmando && (
        <div className="dialog-backdrop" onClick={() => setConfirmando(false)}>
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmar desvinculación"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="dialog-title">¿Dejar a {coachNombre ?? "tu entrenador"}?</div>
            <p className="dialog-body">
              Dejás de ver su panel y no podrá asignarte rutinas.{" "}
              {tienePlan
                ? "Tu plan actual sigue en marcha y tu historial no se toca."
                : "Tu historial no se toca."}{" "}
              Para volver necesitarás un código suyo.
            </p>

            {fallo && <p className="editor-error">{fallo}</p>}

            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmando(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void dejar()}
                disabled={enviando}
              >
                {enviando ? "Desvinculando…" : "Desvincular"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
