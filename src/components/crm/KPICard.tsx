type Props = {
  title: string;
  value: string;
};

export default function KPICard({ title, value }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <p className="text-xs text-slate-500 uppercase tracking-wide">
        {title}
      </p>
      <p className="text-xl font-semibold text-slate-900 mt-1">
        {value}
      </p>
    </div>
  );
}
