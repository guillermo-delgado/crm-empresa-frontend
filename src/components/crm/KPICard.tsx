type Props = {
  title: string;
  value: string;
};

const CARD = "bg-white border border-slate-200 rounded-[12px]";

export default function KPICard({ title, value }: Props) {
  return (
    <div className={`${CARD} px-5 py-4`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {title}
      </p>

      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}
