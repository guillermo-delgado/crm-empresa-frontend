export default function PeriodoSelectorSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex items-center justify-between animate-pulse">

      {/* Botón izquierdo */}
      <div className="w-9 h-9 rounded-full bg-slate-200" />

      {/* Texto central */}
      <div className="flex flex-col items-center gap-2">
        <div className="h-3 w-20 bg-slate-200 rounded" />
        <div className="h-6 w-32 bg-slate-300 rounded" />
      </div>

      {/* Botón derecho */}
      <div className="w-9 h-9 rounded-full bg-slate-200" />

    </div>
  );
}
