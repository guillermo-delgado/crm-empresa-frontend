export default function VentasSearchSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-pulse">
      {/* Cabecera simulada */}
      <div className="px-4 py-3 border-b bg-slate-50 flex gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-3 w-20 bg-slate-200 rounded"
          />
        ))}
      </div>

      {/* Filas simuladas */}
      <div className="divide-y">
        {Array.from({ length: 6 }).map((_, row) => (
          <div
            key={row}
            className="px-4 py-4 flex gap-4"
          >
            {Array.from({ length: 7 }).map((_, col) => (
              <div
                key={col}
                className="h-4 w-20 bg-slate-300 rounded"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
