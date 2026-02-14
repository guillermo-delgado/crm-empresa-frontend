type Props = {
  title: string;

  // 📊 Producción por fecha de efecto
  value: string;
  variationPct?: number | null;
  delta?: number;

  // 🧾 Producción por createdAt (comercial)
  valueCreated?: string;
  variationPctCreated?: number | null;
  deltaCreated?: number;

  isAdmin?: boolean;
};

const CARD =
  "bg-white border border-slate-200 rounded-xl shadow-sm";

export default function KPICard({
  title,

  value,
  variationPct = null,
  delta,

  valueCreated,
  variationPctCreated = null,
  deltaCreated,

  isAdmin = false,
}: Props) {

  const renderMetric = (
    value: string,
    variation: number | null | undefined,
    deltaValue: number | undefined,
    small = false
  ) => {
    const isPositive = variation !== null && variation !== undefined && variation > 0;
    const isNegative = variation !== null && variation !== undefined && variation < 0;

    const variationColor = isPositive
      ? "text-emerald-600"
      : isNegative
      ? "text-red-600"
      : "text-slate-500";

    const deltaColor =
      typeof deltaValue !== "number"
        ? ""
        : deltaValue > 0
        ? "text-emerald-600"
        : deltaValue < 0
        ? "text-red-600"
        : "text-slate-500";

    const arrow = isPositive ? "▲" : isNegative ? "▼" : "";

    return (
      <>
        <p className={small
          ? "mt-1 text-xl font-semibold text-slate-800"
          : "mt-2 text-3xl font-semibold text-slate-900"
        }>
          {value}
        </p>

        {isAdmin && typeof variation === "number" && (
          <div className="mt-3 flex items-center gap-6">

            {/* Variación */}
            <div className={`flex items-center gap-1 text-sm font-semibold ${variationColor}`}>
              {arrow && <span>{arrow}</span>}
              <span>
                {isPositive && "+"}
                {variation.toFixed(2)}%
              </span>
            </div>

            {/* Separador */}
            {typeof deltaValue === "number" && (
              <>
                <div className="h-4 w-px bg-slate-300" />

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-600 font-medium">
                    Pólizas
                  </span>
                  <span className={`font-semibold ${deltaColor}`}>
                    {deltaValue > 0 ? `+${deltaValue}` : deltaValue}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <div className={`${CARD} px-6 py-6`}>

      {/* Título */}
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {title}
      </p>

      {/* =============================== */}
      {/* PRODUCCIÓN TÉCNICA (EFECTO) */}
      {/* =============================== */}
      {renderMetric(value, variationPct, delta)}

      {/* =============================== */}
      {/* PRODUCCIÓN COMERCIAL (CREATED) */}
      {/* =============================== */}
      {valueCreated && (
  <div className="mt-6 pt-5 border-t border-slate-200">

    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
      Producción comercial (registro)
    </p>

    {renderMetric(
      valueCreated,
      isAdmin ? variationPctCreated : null,
      isAdmin ? deltaCreated : undefined,
      true
    )}

  </div>
)}


    </div>
  );
}
