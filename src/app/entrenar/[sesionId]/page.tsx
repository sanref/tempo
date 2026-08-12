import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSesion } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";

import { SessionClient } from "./session-client";

export const dynamic = "force-dynamic";

export default async function SesionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sesionId: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { sesionId } = await params;
  const { editar } = await searchParams;
  const user = await getCurrentUser();

  const sesion = await getSesion(sesionId, user.id);
  if (!sesion) notFound();

  // `?editar=1` abre un entrenamiento ya cerrado para corregirlo. No se
  // reabre la sesión (el índice único solo admite una en curso, y el
  // cronómetro no tiene sentido en algo de hace tres semanas): es la misma
  // pantalla en modo corrección.
  const corrigiendo = sesion.status !== "en_curso";
  if (corrigiendo && editar !== "1") redirect("/historial");

  if (sesion.bloques.length === 0) {
    return (
      <div className="empty">
        Esta sesión no tiene ejercicios. Volvé a <Link href="/rutinas">Rutinas</Link> y elegí un día
        con contenido.
      </div>
    );
  }

  return (
    <SessionClient
      sesionId={sesion.id}
      titulo={sesion.titulo}
      corrigiendo={corrigiendo}
      startedAt={sesion.startedAt.getTime()}
      // Corrigiendo, el reloj queda congelado en lo que duró de verdad.
      ahora={corrigiendo ? (sesion.endedAt?.getTime() ?? sesion.startedAt.getTime()) : Date.now()}
      bloques={sesion.bloques.map((b) => ({
        ...b,
        series: b.series.map((s) => ({
          ...s,
          kg: String(s.kg),
          reps: String(s.reps),
          segundos: s.segundos == null ? "" : String(s.segundos),
        })),
      }))}
    />
  );
}
