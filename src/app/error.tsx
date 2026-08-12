"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const esDb =
    error.message.includes("DATABASE_URL") ||
    error.message.includes("ECONNREFUSED") ||
    error.message.includes("tempo.users") ||
    error.message.includes('relation "');

  return (
    <div style={{ padding: "48px 20px", maxWidth: "72ch" }}>
      <div className="eyebrow">Error</div>
      <h1 style={{ fontSize: 34, margin: "6px 0 10px" }}>
        {esDb ? "No hay conexión con la base" : "Algo se rompió"}
      </h1>

      {esDb ? (
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
            {`createdb tempo
psql "$DATABASE_URL" -f db/01_schema.sql
psql "$DATABASE_URL" -f db/02_seed.sql`}
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
