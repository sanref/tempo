"use client";

import { useActionState, useEffect, useState } from "react";

import {
  iniciarSesion,
  registrarse,
  solicitarRecuperacion,
  type EstadoAuth,
} from "@/app/actions";

type Modo = "login" | "registro" | "recuperar";

/**
 * Entrar, crear cuenta y pedir enlace de recuperación en el mismo panel.
 *
 * El envío es una server action, no un fetch: la cookie de sesión solo se
 * puede escribir desde el servidor, y así el formulario sigue funcionando
 * mientras el JavaScript no haya cargado.
 */
export function LoginForm({ volver }: { volver?: string }) {
  const [modo, setModo] = useState<Modo>("login");

  const [estadoLogin, accionLogin, pendienteLogin] = useActionState<EstadoAuth, FormData>(
    iniciarSesion,
    null,
  );
  const [estadoRegistro, accionRegistro, pendienteRegistro] = useActionState<
    EstadoAuth,
    FormData
  >(registrarse, null);
  const [estadoRecuperar, accionRecuperar, pendienteRecuperar] = useActionState<
    EstadoAuth,
    FormData
  >(solicitarRecuperacion, null);

  // Si en el panel de Supabase todavía no está autorizada `/recuperar` en
  // Redirect URLs, Supabase aterriza en el Site URL (`/login#...type=recovery`).
  // El navegador conserva el hash en el redirect y aquí lo reenviamos limpio.
  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) {
      window.location.replace(`/recuperar${window.location.hash}`);
    }
  }, []);

  if (modo === "recuperar") {
    return (
      <>
        <div className="screen-head login-head">
          <div className="eyebrow">Recuperar acceso</div>
          <h1>Restablecer contraseña</h1>
          <p className="text-muted">
            Escribí tu email y te enviamos un enlace para elegir una contraseña nueva.
          </p>
        </div>

        <form action={accionRecuperar} className="login-form">
          <div className="field">
            <label htmlFor="email-recuperar">Email</label>
            <input
              id="email-recuperar"
              name="email"
              type="email"
              className="input"
              autoComplete="email"
              required
            />
          </div>

          {estadoRecuperar?.error && (
            <p className="login-error" role="alert">
              {estadoRecuperar.error}
            </p>
          )}

          {estadoRecuperar?.ok && (
            <p className="aviso-comun" role="status">
              {estadoRecuperar.ok}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={pendienteRecuperar}
          >
            {pendienteRecuperar ? "Enviando…" : "Enviar enlace"}
          </button>
        </form>

        <p className="login-alt">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setModo("login")}
          >
            Volver a iniciar sesión
          </button>
        </p>
      </>
    );
  }

  const esRegistro = modo === "registro";
  const estado = esRegistro ? estadoRegistro : estadoLogin;
  const accion = esRegistro ? accionRegistro : accionLogin;
  const pendiente = esRegistro ? pendienteRegistro : pendienteLogin;

  return (
    <>
      <div className="screen-head login-head">
        <div className="eyebrow">{esRegistro ? "Nueva cuenta" : "Acceso"}</div>
        <h1>{esRegistro ? "Crear cuenta" : "Iniciar sesión"}</h1>
        <p className="text-muted">Seguí tu plan de entrenamiento.</p>
      </div>

      <form action={accion} className="login-form">
        {volver && <input type="hidden" name="volver" value={volver} />}

        {esRegistro && (
          <div className="field">
            <label htmlFor="nombre">Nombre</label>
            <input
              id="nombre"
              name="nombre"
              className="input"
              autoComplete="name"
              required
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            autoComplete="email"
            required
          />
        </div>

        <div className="field">
          <div className="login-label-fila">
            <label htmlFor="password">Contraseña</label>
            {!esRegistro && (
              <button
                type="button"
                className="login-olvide"
                onClick={() => setModo("recuperar")}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            autoComplete={esRegistro ? "new-password" : "current-password"}
            required
          />
        </div>

        {estado?.error && (
          <p className="login-error" role="alert">
            {estado.error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={pendiente}>
          {pendiente ? "Un momento…" : esRegistro ? "Crear cuenta" : "Entrar"}
        </button>
      </form>

      <p className="login-alt">
        <span className="text-muted">
          {esRegistro ? "¿Ya tenés cuenta?" : "¿Todavía no tenés cuenta?"}
        </span>{" "}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setModo(esRegistro ? "login" : "registro")}
        >
          {esRegistro ? "Iniciar sesión" : "Crear cuenta"}
        </button>
      </p>
    </>
  );
}
