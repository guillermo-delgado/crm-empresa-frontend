type RamoTotal = {
  ramo: string;
  total: number;
};

type Props = {
  data: RamoTotal[];
  aseguradora: string;
  onAseguradoraChange: (value: string) => void;
};

const CARD = "bg-white border border-slate-200 rounded-[12px]";

export default function ProduccionPorRamo({
  data,
  aseguradora,
  onAseguradoraChange,
}: Props) {
  return (
    <div className={CARD}>

      {/* HEADER */}
      <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">
            Producción por ramo
          </h3>
          <p className="text-xs text-slate-400">
            Total agrupado por tipo de seguro
          </p>
        </div>

        <select
          value={aseguradora}
          onChange={(e) => onAseguradoraChange(e.target.value)}
          className="
            border border-slate-300 rounded-md
            px-3 py-1.5 text-sm
            cursor-pointer bg-white
            focus:outline-none focus:ring-2 focus:ring-slate-300
          "
        >
          <option value="ALL">Todas</option>
          <option value="Mapfre">Mapfre</option>
          <option value="Verti">Verti</option>
        </select>
      </div>

      {/* CONTENIDO */}
      <div className="px-4 py-3">
        <table className="w-full text-sm">

          <thead className="text-slate-500">
            <tr>
              <th className="py-2 text-left font-medium">
                Ramo
              </th>
              <th className="py-2 text-right font-medium">
                Producción
              </th>
            </tr>
          </thead>

          <tbody>
            {data.map((r) => (
              <tr
                key={r.ramo}
                className="border-t border-slate-100 hover:bg-slate-50 transition"
              >
                <td className="py-2 font-medium text-slate-700">
                  {r.ramo}
                </td>
                <td className="py-2 text-right font-semibold text-slate-900">
                  {r.total.toFixed(2)} €
                </td>
              </tr>
            ))}

            {data.length === 0 && (
              <tr>
                <td
                  colSpan={2}
                  className="py-6 text-center text-slate-400"
                >
                  No hay datos para este filtro
                </td>
              </tr>
            )}
          </tbody>

        </table>
      </div>
    </div>
  );
}
