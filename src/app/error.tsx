"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const esDb =
    error.message.includes("DATABASE_URL") ||
    error.message.includes("ECONNREFUSED") ||
    error.message.includes('relation "');

  const esAuth = error.message.includes("NEXT_PUBLIC_SUPABASE");

  return (
    <div style={{ padding: "48px 20px", maxWidth: "72ch" }}>
      <div className="eyebrow">Error</div>
      <h1 style={{ fontSize: 34, margin: "6px 0 10px" }}>
        {esDb
          ? "No hay conexión con la base"
          : esAuth
            ? "Falta la configuración de Supabase Auth"
            : "Algo se rompió"}
      </h1>

      {esAuth ? (
        <>
          <p className="text-muted">
            El login necesita las claves del proyecto de Supabase en <code>.env</code>{" "}
            (Project Settings → API):
          </p>
          <pre
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-divider)",
              padding: 16,
              fontSize: 13,
              overflowX: "auto",
            }}
          >
            {`NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…`}
          </pre>
        </>
      ) : esDb ? (
        <>
          <p className="text-muted">
            Tempo lee todo de Postgres. Comprobá que el servidor esté levantado y que el
            esquema esté creado:
          </p>
          <pre
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-divider)",
              padding: 16,
              fontSize: 13,
              overflowX: "auto",
            }}
          >
            {`npm run db:create
npm run db:seed`}
          </pre>
        </>
      ) : (
        <p className="text-muted">{error.message}</p>
      )}

      <button className="btn btn-primary" onClick={reset} style={{ marginTop: 8 }}>
        Reintentar
      </button>
    </div>
  );
}
