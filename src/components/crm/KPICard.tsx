type Props = {
  title: string;
  value: string;
  variationPct?: number | null;
  delta?: number;
  isAdmin?: boolean;
};

const CARD = "bg-white border border-slate-200 rounded-[12px]";

export default function KPICard({
  title,
  value,
  variationPct,
  delta,
}: Props) {
  const isPositive = variationPct !== null && variationPct !== undefined && variationPct > 0;
  const isNegative = variationPct !== null && variationPct !== undefined && variationPct < 0;
  const isNeutral = variationPct === 0;

  return (
    <div className={`${CARD} px-5 py-4`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {title}
      </p>

      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </p>

      {variationPct !== undefined && variationPct !== null && (
  <div className="mt-2 flex items-center gap-3 text-sm font-semibold">
    {/* VARIACIÓN */}
    <span
      className={`flex items-center gap-1 ${
        isPositive
          ? "text-emerald-600"
          : isNegative
          ? "text-red-600"
          : "text-slate-500"
      }`}
    >
      {isPositive && "▲"}
      {isNegative && "▼"}
      {isNeutral && "•"}
      {isPositive && "+"}
      {variationPct.toFixed(2)}%
    </span>

    {/* PÓLIZAS */}
    {typeof delta === "number" && (
      <span className="flex items-center gap-1">
        <span className="text-slate-900 font-medium">
          Pólizas:
        </span>
        <span
          className={
            delta > 0
              ? "text-emerald-600"
              : delta < 0
              ? "text-red-600"
              : "text-slate-500"
          }
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
      </span>
    )}
  </div>
)}


    </div>
  );
}
