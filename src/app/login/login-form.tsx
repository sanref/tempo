"use client";

import { useActionState, useState } from "react";

import { iniciarSesion, registrarse, type EstadoAuth } from "@/app/actions";

/**
 * Entrar y crear cuenta en el mismo formulario, como en el móvil.
 *
 * El envío es una server action, no un fetch: la cookie de sesión solo se
 * puede escribir desde el servidor, y así el formulario sigue funcionando
 * mientras el JavaScript no haya cargado.
 */
export function LoginForm({ volver }: { volver?: string }) {
  const [esRegistro, setEsRegistro] = useState(false);
  const [estado, accion, pendiente] = useActionState<EstadoAuth, FormData>(
    esRegistro ? registrarse : iniciarSesion,
    null,
  );

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
          <label htmlFor="password">Contraseña</label>
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
          onClick={() => setEsRegistro((v) => !v)}
        >
          {esRegistro ? "Iniciar sesión" : "Crear cuenta"}
        </button>
      </p>
    </>
  );
}
