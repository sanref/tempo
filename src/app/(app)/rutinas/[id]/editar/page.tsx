import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { getEjercicios, getEquipos, getGrupos, getRutina } from "@/db/queries";
import { assignments, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

import { EditorClient } from "./editor-client";

export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  const rutina = await getRutina(id, user.id);
  if (!rutina) notFound();

  const [asignados, catalogo, grupos, equipos] = await Promise.all([
    db
      .select({ nombre: users.nombre })
      .from(assignments)
      .innerJoin(users, eq(users.id, assignments.clientId))
      .where(and(eq(assignments.routineId, id), isNull(assignments.endedOn))),
    // El catálogo entero viaja con la página: son unas decenas de filas y así
    // el selector busca en local, sin ida y vuelta por cada tecla.
    getEjercicios(user.id),
    getGrupos(),
    getEquipos(),
  ]);

  return (
    <EditorClient
      routineId={rutina.id}
      nombreInicial={rutina.nombre}
      dias={rutina.dias}
      alumnos={asignados.map((a) => a.nombre).join(", ") || "Sin asignar"}
      catalogo={catalogo}
      grupos={grupos}
      equipos={equipos}
    />
  );
}
