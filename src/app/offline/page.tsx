import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sin conexión — Tempo",
};

/**
 * Último recurso del service worker: se sirve cuando no hay red y esa pantalla
 * concreta tampoco está en el caché.
 *
 * Se precachea en la instalación del SW, así que no puede leer de la base: es
 * estática a propósito. Si alguna vez necesita datos, deja de servir para lo
 * único que existe.
 */
export default function Offline() {
  return (
    <div style={{ padding: "48px 20px", maxWidth: "56ch" }}>
      <div className="eyebrow">Sin conexión</div>
      <h1 style={{ fontSize: "calc(34px * var(--escala-texto))", margin: "6px 0 10px" }}>Esta pantalla no está guardada</h1>
      <p className="text-muted">
        No hay red y de esta página no queda copia en el teléfono. Las que abriste antes sí
        siguen disponibles.
      </p>
      <p className="text-muted">
        Si estabas entrenando, tus series están guardadas en el teléfono y se subirán solas
        en cuanto vuelva la cobertura. No hace falta que apuntes nada.
      </p>
      <Link className="btn btn-primary" href="/" style={{ marginTop: 8 }}>
        Reintentar
      </Link>
    </div>
  );
}
