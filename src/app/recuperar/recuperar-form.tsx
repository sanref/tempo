"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import {
  activarSesionRecuperacion,
  completarRecuperacion,
  type EstadoAuth,
} from "@/app/actions";

type EstadoEnlace = "validando" | "listo" | "invalido";

export function RecuperarForm({
  sesionActiva,
  tokenHash,
  code,
  errorInicial,
}: {
  sesionActiva: boolean;
  tokenHash?: string;
  code?: string;
  errorInicial?: string;
}) {
  const [estadoEnlace, setEstadoEnlace] = useState<EstadoEnlace>(() => {
    if (errorInicial) return "invalido";
    if (sesionActiva && !tokenHash && !code) return "listo";
    return "validando";
  });
  const [motivoInvalido, setMotivoInvalido] = useState<string | null>(
    errorInicial ? "El enlace caducó o ya fue usado." : null,
  );

  const [estadoForm, accion, pendiente] = useActionState<EstadoAuth, FormData>(
    completarRecuperacion,
    null,
  );

  useEffect(() => {
    if (errorInicial) return;

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : "";
    const paramsHash = new URLSearchParams(hash);
    const errorHash = paramsHash.get("error_description") ?? paramsHash.get("error");
    const accessToken = paramsHash.get("access_token") ?? undefined;
    const refreshToken = paramsHash.get("refresh_token") ?? undefined;

    // Se limpia la barra de direcciones enseguida para no dejar el token a la vista.
    if (hash || tokenHash || code) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (errorHash) {
      setMotivoInvalido("El enlace caducó o ya fue usado.");
      setEstadoEnlace("invalido");
      return;
    }

    if (!accessToken && !tokenHash && !code) {
      if (sesionActiva) {
        setEstadoEnlace("listo");
      } else {
        setMotivoInvalido("Este enlace no es válido o ya caducó.");
        setEstadoEnlace("invalido");
      }
      return;
    }

    void activarSesionRecuperacion({
      accessToken,
      refreshToken,
      tokenHash,
      code,
    }).then((r) => {
      if ("ok" in r) {
        setEstadoEnlace("listo");
      } else {
        setMotivoInvalido(r.error);
        setEstadoEnlace("invalido");
      }
    });
  }, [sesionActiva, tokenHash, code, errorInicial]);

  if (estadoEnlace === "validando") {
    return (
      <div className="screen-head login-head">
        <div className="eyebrow">Recuperar acceso</div>
        <h1>Verificando enlace…</h1>
        <p className="text-muted">Un momento mientras comprobamos tu solicitud.</p>
      </div>
    );
  }

  if (estadoEnlace === "invalido") {
    return (
      <>
        <div className="screen-head login-head">
          <div className="eyebrow">Enlace vencido</div>
          <h1>No pudimos abrir el enlace</h1>
          <p className="text-muted">
            {motivoInvalido ?? "El enlace caducó o ya fue usado."}
          </p>
        </div>
        <div className="login-form">
          <Link href="/login" className="btn btn-primary btn-block">
            Pedir un enlace nuevo
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="screen-head login-head">
        <div className="eyebrow">Recuperar acceso</div>
        <h1>Nueva contraseña</h1>
        <p className="text-muted">Elegí una contraseña nueva de al menos 6 caracteres.</p>
      </div>

      <form action={accion} className="login-form">
        <div className="field">
          <label htmlFor="password-nueva">Nueva contraseña</label>
          <input
            id="password-nueva"
            name="password"
            type="password"
            className="input"
            autoComplete="new-password"
            minLength={6}
            required
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="password-repetir">Repetir contraseña</label>
          <input
            id="password-repetir"
            name="repetir"
            type="password"
            className="input"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        {estadoForm?.error && (
          <p className="login-error" role="alert">
            {estadoForm.error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar contraseña y entrar"}
        </button>
      </form>
    </>
  );
}
