import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  value: string;
  variationPct?: number | null;
  delta?: number;
  icon?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  isAdmin?: boolean;
};

const CARD =
  "bg-white border border-slate-200 rounded-xl shadow-sm";

export default function KPICard({
  title,
  subtitle,
  value,
  variationPct = null,
  delta,
  icon,
  iconBg = "bg-blue-100",
  iconColor = "text-blue-600",
  isAdmin = false,
}: Props) {
  const isPositive =
    typeof variationPct === "number" && variationPct > 0;

  const isNegative =
    typeof variationPct === "number" && variationPct < 0;

  const variationColor = isPositive
    ? "text-emerald-600"
    : isNegative
    ? "text-red-600"
    : "text-slate-500";

  return (
    <div className={`${CARD} min-h-[150px] p-6`}>
      <div className="flex items-start gap-4">
        {/* Icono */}
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}
        >
          {icon}
        </div>

        {/* Contenido */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p>

          {subtitle && (
            <p className="mt-0.5 text-xs font-medium uppercase text-blue-600">
              {subtitle}
            </p>
          )}

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          {isAdmin && typeof variationPct === "number" && (
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`text-sm font-semibold ${variationColor}`}
              >
                {isPositive ? "↑" : isNegative ? "↓" : ""}
                {" "}
                {isPositive ? "+" : ""}
                {variationPct.toFixed(0)}%
              </span>

              <span className="text-xs text-slate-500">
                Respecto al mes anterior
              </span>
            </div>
          )}

          {isAdmin && typeof delta === "number" && (
            <p className="mt-1 text-xs text-slate-500">
              {delta > 0 ? "+" : ""}
              {delta} pólizas
            </p>
          )}
        </div>
      </div>
    </div>
  );
}