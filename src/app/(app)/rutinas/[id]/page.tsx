import Link from "next/link";
import { notFound } from "next/navigation";

import { empezarSesion, duplicarRutina } from "@/app/actions";
import { DayTabs } from "@/components/day-tabs";
import { StatStrip } from "@/components/stat-strip";
import { getPlanActivo, getProximoDia, getRutina } from "@/db/queries";
import { getCurrentUser } from "@/lib/auth";

import { UsarComoMiPlan } from "./usar-como-mi-plan";

export const dynamic = "force-dynamic";

export default async function DetalleRutinaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const rutina = await getRutina(id, user.id);
  if (!rutina) notFound();

  const proximo = await getProximoDia(user.id);
  const diaAEmpezar = rutina.dias.find((d) => d.id === proximo?.id) ?? rutina.dias[0];

  // Activarla como plan solo tiene sentido si no lo es ya: `getPlanActivo()`
  // lee de `assignments`, y sin una fila ahí /entrenar y la home salen vacías
  // aunque la rutina esté hecha.
  const plan = await getPlanActivo(user.id);
  const yaEsMiPlan = plan?.routineId === rutina.id;
  const puedeActivarla = !yaEsMiPlan && rutina.dias.length > 0;

  return (
    <div>
      <div style={{ padding: "20px 20px 0" }}>
        <Link className="btn btn-ghost" href="/rutinas">
          ← Rutinas
        </Link>
      </div>

      <div className="detail-head">
        <div className="eyebrow">
          {rutina.autor
            ? `Plan asignado · ${rutina.autor}`
            : yaEsMiPlan
              ? "Mi plan actual"
              : "Rutina propia"}
        </div>
        <h1>{rutina.nombre}</h1>
        <p className="text-muted">{rutina.descripcion}</p>

        <div className="actions">
          {diaAEmpezar && (
            <form action={empezarSesion.bind(null, diaAEmpezar.id)}>
              <button className="btn btn-primary" type="submit">
                Empezar Día {diaAEmpezar.codigo}
              </button>
            </form>
          )}
          {puedeActivarla && (
            <UsarComoMiPlan
              routineId={rutina.id}
              nombre={rutina.nombre}
              planActual={plan?.routineNombre ?? null}
            />
          )}
          <Link className="btn btn-secondary" href={`/rutinas/${rutina.id}/editar`}>
            Editar
          </Link>
          <form action={duplicarRutina.bind(null, rutina.id)}>
            <button className="btn btn-secondary" type="submit">
              Duplicar
            </button>
          </form>
        </div>
      </div>

      <StatStrip
        compacta
        stats={[
          { label: "Duración", value: rutina.semanas, unidad: "sem" },
          { label: "Días/sem", value: rutina.dias.length },
          { label: "Series/sem", value: rutina.seriesPorSemana },
          { label: "Adherencia", value: `${rutina.adherencia}%`, acento: true },
        ]}
      />

      <DayTabs dias={rutina.dias} />
    </div>
  );
}
