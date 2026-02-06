import { useMemo } from "react";

export default function Dashboard() {
  // 🔢 MOCK DATA (luego vendrá del backend)
  const stats = useMemo(() => ({
    ventasMes: 128,
    variacionVentas: 12.4,
    primaTotal: 84230,
    primaMedia: 658,
    incidencias: 6,
    ratioIncidencias: 4.6,
  }), []);

  return (
    <div className="space-y-10">

      {/* ================= CABECERA ================= */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Dashboard CRM
          </h1>
          <p className="text-slate-500 mt-1">
            Visión general del negocio
          </p>
        </div>

        <div className="text-sm text-slate-500">
          Actualizado: {new Date().toLocaleString()}
        </div>
      </div>

      {/* ================= KPIs ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        <KpiCard
          title="Ventas"
          value={stats.ventasMes}
          sub={`+${stats.variacionVentas}% vs mes anterior`}
        />

        <KpiCard
          title="Prima neta total"
          value={`${stats.primaTotal.toLocaleString()} €`}
          sub={`Media ${stats.primaMedia} € / venta`}
        />

        <KpiCard
          title="Incidencias"
          value={stats.incidencias}
          sub={`${stats.ratioIncidencias}% del total`}
          warning
        />

        <KpiCard
          title="Estado del sistema"
          value="Atención"
          sub="Revisiones pendientes"
          status="warning"
        />
      </div>

      {/* ================= GRÁFICA (PLACEHOLDER) ================= */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Evolución de ventas
        </h2>

        <div className="h-64 flex items-center justify-center text-slate-400 border-2 border-dashed rounded-lg">
          Gráfica temporal (ventas / prima)
        </div>
      </div>

      {/* ================= ALERTAS + ACTIVIDAD ================= */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* 🔔 ALERTAS */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Alertas del sistema
          </h2>

          <ul className="space-y-3 text-sm">
            <AlertItem type="danger" text="2 ventas con prima incoherente" />
            <AlertItem type="warning" text="4 ventas pendientes de revisión" />
            <AlertItem type="warning" text="1 usuario sin actividad reciente" />
          </ul>
        </div>

        {/* 🕒 ACTIVIDAD */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Actividad reciente
          </h2>

          <ul className="space-y-3 text-sm text-slate-600">
            <li>Juan creó una venta (Hogar) — hoy 10:12</li>
            <li>Admin rehabilitó venta #234 — ayer 18:44</li>
            <li>Nueva solicitud pendiente — ayer 17:10</li>
          </ul>
        </div>
      </div>

      {/* ================= ACCESOS RÁPIDOS ================= */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Accesos rápidos
        </h2>

        <div className="flex flex-wrap gap-4">
          <QuickLink label="Libro de ventas" />
          <QuickLink label="Ventas pendientes" />
          <QuickLink label="Gestión de usuarios" />
          <QuickLink label="Horario CRM" />
        </div>
      </div>

    </div>
  );
}

/* ======================================================
   COMPONENTES AUXILIARES
====================================================== */

function KpiCard({
  title,
  value,
  sub,
  warning,
  status,
}: {
  title: string;
  value: string | number;
  sub: string;
  warning?: boolean;
  status?: "warning";
}) {
  return (
    <div className={`rounded-xl border p-6 shadow-sm bg-white
      ${warning ? "border-amber-300" : "border-slate-200"}
    `}>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-3xl font-bold text-slate-800 mt-2">{value}</p>
      <p className={`text-sm mt-1 ${
        status === "warning" ? "text-amber-600" : "text-slate-500"
      }`}>
        {sub}
      </p>
    </div>
  );
}

function AlertItem({
  type,
  text,
}: {
  type: "danger" | "warning";
  text: string;
}) {
  return (
    <li
      className={`px-4 py-3 rounded-md border text-sm font-medium
      ${type === "danger"
        ? "bg-red-50 border-red-300 text-red-700"
        : "bg-amber-50 border-amber-300 text-amber-700"}
    `}
    >
      {text}
    </li>
  );
}

function QuickLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="px-5 py-3 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100"
    >
      {label}
    </button>
  );
}
