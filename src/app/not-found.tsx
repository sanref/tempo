import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "48px 20px" }}>
      <div className="eyebrow">404</div>
      <h1 style={{ fontSize: 34, margin: "6px 0 10px" }}>No encontramos esa página</h1>
      <p className="text-muted">Puede que la rutina o la sesión ya no exista.</p>
      <Link className="btn btn-primary" href="/">
        Volver a inicio
      </Link>
    </div>
  );
}
