import { SkCabecera, SkPantalla, SkTabla } from "@/components/skeleton";

export default function Loading() {
  return (
    <SkPantalla>
      <SkCabecera ancho="170px" accion eyebrow />

      <div style={{ padding: 20 }}>
        <SkTabla
          columnas={["Cliente", "Plan", "Semana", "Adherencia", "Última sesión", ""]}
          filas={6}
        />
      </div>
    </SkPantalla>
  );
}
