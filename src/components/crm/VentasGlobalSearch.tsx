type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function VentasGlobalSearch({ value, onChange }: Props) {
  return (
    <div className="bg-white ">

      {/* LABEL */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Búsqueda global
        </label>

        {value.trim().length >= 2 && (
          <span className="text-[11px] text-slate-400">
            Ignora filtros
          </span>
        )}
      </div>

      {/* INPUT */}
      <div className="relative">
        {/* ICONO */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Tomador, póliza, DNI"
          className="
            w-full
            pl-10 pr-4 py-2.5
            text-sm
            rounded-lg
            border border-slate-300
            focus:outline-none
            focus:ring-2 focus:ring-slate-400/40
            focus:border-slate-400
            transition
          "
        />
      </div>

      {/* AYUDA */}
      <p className="mt-2 text-xs text-slate-400">
        La búsqueda global ignora mes, año y filtros
      </p>
    </div>
  );
}
