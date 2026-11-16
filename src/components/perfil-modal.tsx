"use client";

import { User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cambiarPasswordPerfil, guardarPerfil } from "@/app/actions";

type Props = {
  nombre: string;
  email: string;
  role: string;
  coachNombre: string | null;
};

/**
 * Ventana modal de perfil encima de cualquier pantalla.
 *
 * Se monta en `document.body` con portal para salir del contexto de apilamiento
 * de `.site-header` (`z-index: 30`) y quedar por encima de `.tabbar` (`40`).
 * Igual que el formulario de ejercicio, no se cierra al tocar fuera ni con
 * Escape para no perder lo que se esté escribiendo: solo desde su botón Cerrar.
 */
export function PerfilModal({ nombre: nombreInicial, email, role, coachNombre }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);

  const [nombre, setNombre] = useState(nombreInicial);
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [okDatos, setOkDatos] = useState<string | null>(null);

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [guardandoPass, setGuardandoPass] = useState(false);
  const [errorPass, setErrorPass] = useState<string | null>(null);
  const [okPass, setOkPass] = useState<string | null>(null);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    setNombre(nombreInicial);
  }, [nombreInicial]);

  const abrir = () => {
    setNombre(nombreInicial);
    setErrorDatos(null);
    setOkDatos(null);
    setActual("");
    setNueva("");
    setRepetir("");
    setErrorPass(null);
    setOkPass(null);
    setAbierto(true);
  };

  const cerrar = () => {
    if (guardandoDatos || guardandoPass) return;
    setAbierto(false);
  };

  const enviarDatos = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setGuardandoDatos(true);
    setErrorDatos(null);
    setOkDatos(null);
    try {
      const r = await guardarPerfil(nombre);
      if ("error" in r) {
        setErrorDatos(r.error);
      } else {
        setOkDatos("Nombre actualizado.");
        router.refresh();
      }
    } catch {
      setErrorDatos("No se pudo guardar el nombre.");
    } finally {
      setGuardandoDatos(false);
    }
  };

  const enviarPass = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setGuardandoPass(true);
    setErrorPass(null);
    setOkPass(null);
    try {
      const r = await cambiarPasswordPerfil(actual, nueva, repetir);
      if ("error" in r) {
        setErrorPass(r.error);
      } else {
        setActual("");
        setNueva("");
        setRepetir("");
        setOkPass("Contraseña actualizada.");
      }
    } catch {
      setErrorPass("No se pudo cambiar la contraseña.");
    } finally {
      setGuardandoPass(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="user-chip user-chip--btn"
        onClick={abrir}
        title="Editar perfil y contraseña"
      >
        <UserIcon size={13} aria-hidden="true" />
        <strong>{nombreInicial}</strong>
        {role}
      </button>

      <button
        type="button"
        className="btn btn-icon user-btn-movil"
        onClick={abrir}
        title="Mi perfil"
        aria-label="Mi perfil"
      >
        <UserIcon size={16} />
      </button>

      {abierto &&
        montado &&
        createPortal(
          <div className="dialog-backdrop">
            <div
              className="dialog perfil-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Mi perfil"
            >
              <div className="dialog-title">Mi perfil</div>

              <div className="rows perfil-ficha">
                <div className="row">
                  <span className="text-muted">Email</span>
                  <span>{email}</span>
                </div>
                <div className="row">
                  <span className="text-muted">Rol</span>
                  <span>{role}</span>
                </div>
                {coachNombre && (
                  <div className="row">
                    <span className="text-muted">Entrenador</span>
                    <span>{coachNombre}</span>
                  </div>
                )}
              </div>

              <form onSubmit={(ev) => void enviarDatos(ev)} className="perfil-bloque">
                <div className="seccion-titulo">Datos personales</div>
                <div className="field">
                  <label htmlFor="perfil-nombre">Nombre</label>
                  <input
                    id="perfil-nombre"
                    className="input"
                    value={nombre}
                    onChange={(ev) => setNombre(ev.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>

                {errorDatos && <p className="login-error">{errorDatos}</p>}
                {okDatos && <p className="aviso-comun">{okDatos}</p>}

                <div className="perfil-accion">
                  <button
                    type="submit"
                    className="btn btn-secondary"
                    disabled={guardandoDatos || nombre.trim() === nombreInicial.trim()}
                  >
                    {guardandoDatos ? "Guardando…" : "Guardar nombre"}
                  </button>
                </div>
              </form>

              <form onSubmit={(ev) => void enviarPass(ev)} className="perfil-bloque">
                <div className="seccion-titulo">Cambiar contraseña</div>
                <div className="field">
                  <label htmlFor="perfil-pass-actual">Contraseña actual</label>
                  <input
                    id="perfil-pass-actual"
                    type="password"
                    className="input"
                    value={actual}
                    onChange={(ev) => setActual(ev.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="perfil-pass-nueva">Nueva contraseña</label>
                  <input
                    id="perfil-pass-nueva"
                    type="password"
                    className="input"
                    value={nueva}
                    onChange={(ev) => setNueva(ev.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="perfil-pass-repetir">Repetir nueva contraseña</label>
                  <input
                    id="perfil-pass-repetir"
                    type="password"
                    className="input"
                    value={repetir}
                    onChange={(ev) => setRepetir(ev.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>

                {errorPass && <p className="login-error">{errorPass}</p>}
                {okPass && <p className="aviso-comun">{okPass}</p>}

                <div className="perfil-accion">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={guardandoPass}
                  >
                    {guardandoPass ? "Actualizando…" : "Actualizar contraseña"}
                  </button>
                </div>
              </form>

              <div className="dialog-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={cerrar}
                  disabled={guardandoDatos || guardandoPass}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
