import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { getCatalogoLigero, getEquipos, getGrupos, getRutina } from "@/db/queries";
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
    // El catálogo entero viaja con la página —656+ filas, pero solo los seis
    // campos que pinta el picker— y así el selector busca en local, sin ida y
    // vuelta por cada tecla.
    //
    // Con el autor de la rutina: el picker se abre al lado de la lista del día,
    // que hereda su alias. Sin esto, la misma fila saldría con un nombre a la
    // izquierda y otro a la derecha.
    getCatalogoLigero(user.id, rutina.autorId),
    getGrupos(),
    getEquipos(user.id),
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
