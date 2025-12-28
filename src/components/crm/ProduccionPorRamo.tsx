type RamoTotal = {
  ramo: string;
  total: number;
};

type Props = {
  data: RamoTotal[];
  aseguradora: string;
  onAseguradoraChange: (value: string) => void;
};

export default function ProduccionPorRamo({
  data,
  aseguradora,
  onAseguradoraChange,
}: Props) {
  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">

      {/* CABECERA */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-700">
          Producción por ramo
        </h3>

        <select
          value={aseguradora}
          onChange={(e) => onAseguradoraChange(e.target.value)}
          className="border rounded px-3 py-2 text-sm cursor-pointer"
        >
          <option value="ALL">Todas las aseguradoras</option>
          <option value="Mapfre">Mapfre</option>
          <option value="Verti">Verti</option>
        </select>
      </div>

      {/* TABLA */}
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">Ramo</th>
            <th className="px-3 py-2 text-right">Producción</th>
          </tr>
        </thead>

        <tbody>
          {data.map((r) => (
            <tr key={r.ramo} className="border-t">
              <td className="px-3 py-2 font-medium">
                {r.ramo}
              </td>
              <td className="px-3 py-2 text-right font-semibold">
                {r.total.toFixed(2)} €
              </td>
            </tr>
          ))}

          {data.length === 0 && (
            <tr>
              <td
                colSpan={2}
                className="px-3 py-4 text-center text-slate-400"
              >
                No hay datos para este filtro
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
