export default function ProduccionRamoSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-[12px] p-6 animate-pulse">
      <div className="h-3 w-40 bg-slate-200 rounded mb-4" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="border border-slate-200 rounded-md px-3 py-2 space-y-2"
          >
            <div className="h-3 w-24 bg-slate-200 rounded" />
            <div className="h-4 w-16 bg-slate-300 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
