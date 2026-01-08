import { useEffect, useMemo, useState } from "react";
import KPICard from "../components/crm/KPICard";
import VentasTable from "../components/crm/VentasTable";
import InfoModal from "../components/ventas/InfoModal";
import EditVentaModal from "../components/ventas/EditVentaModal";
import ConfirmModal from "../components/ventas/ConfirmModal";
import api from "../services/api";
import { useNavigate } from "react-router-dom";




/* 🔔 SOCKET */
import { getSocket } from "../services/socket";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type VentaAPI = {
  _id: string;
  fechaEfecto: string;
  numeroPoliza: string;
  tomador: string;
  aseguradora: string;
  ramo: string;
  primaNeta: number;
  formaPago?: string;
  createdBy?: {
    nombre: string;
  };
};

type VentaEditando = {
  data: VentaAPI;
  original: VentaAPI;
  changedFields: string[];
  solicitudId?: string;
  fromSocket?: boolean;
};

type VentaAEliminar = VentaAPI & {
  solicitudId?: string;
};



export default function LibroVentas() {
  const navigate = useNavigate();

   /* =========================
     USUARIO ACTUAL
  ========================= */
  let currentUser: any = null;
try {
  currentUser = JSON.parse(localStorage.getItem("user") || "null");
} catch {
  currentUser = null;
}

  const isAdmin = currentUser?.role === "admin";

  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  // 📅 Límites de periodo (empleados)
const hoy = new Date();
const minPeriodo = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
const maxPeriodo = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 1);

const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);
const [showSolicitudesModal, setShowSolicitudesModal] = useState(false);
const [solicitudes, setSolicitudes] = useState<any[]>([]);
const [showDeleteInfo, setShowDeleteInfo] = useState(false);







  const [ventas, setVentas] = useState<VentaAPI[]>([]);
  const [loading, setLoading] = useState(false);

  const [ventaEditando, setVentaEditando] = useState<VentaEditando | null>(null);
const [ventaAEliminar, setVentaAEliminar] = useState<VentaAEliminar | null>(null);
  

  const [aseguradora, setAseguradora] = useState("ALL");
  const [usuario, setUsuario] = useState("ALL");
  const [ramo, setRamo] = useState("ALL");

  /* =========================
     SOLICITUDES PENDIENTES
  ========================= */

const cargarSolicitudes = async () => {
  try {
    const res = await api.get("/solicitudes");
    setSolicitudes(res.data || []);
    setSolicitudesPendientes(res.data.length);
  } catch {}
};

  const fetchLibroVentas = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/ventas/libro?month=${mes}&year=${anio}`);
      setVentas(Array.isArray(res.data.ventas) ? res.data.ventas : []);
    } catch (e) {
      console.error("Error cargando libro de ventas", e);
    } finally {
      setLoading(false);
    }
  };

// 1️⃣ Cargar ventas al cambiar periodo
useEffect(() => {
  fetchLibroVentas();
}, [mes, anio]);

// 2️⃣ Cargar solicitudes pendientes al entrar (ADMIN)
useEffect(() => {
  if (!isAdmin) return;
  cargarSolicitudes();
}, [isAdmin]);


// 3️⃣ Socket tiempo real
useEffect(() => {
  const socket = getSocket();
  if (!socket) return;

  const onVenta = () => {
    fetchLibroVentas();
  };

const onSolicitudCreada = () => {
  if (isAdmin) cargarSolicitudes();
};

const onSolicitudResuelta = () => {
  if (isAdmin) cargarSolicitudes();
};


  socket.on("VENTA_CREADA", (data) => {
  console.log("🟣 EVENTO VENTA_CREADA RECIBIDO:", data);
});

  socket.on("VENTA_ACTUALIZADA", onVenta);
  socket.on("VENTA_ELIMINADA", onVenta);
  socket.on("SOLICITUD_CREADA", onSolicitudCreada);
  socket.on("SOLICITUD_RESUELTA", onSolicitudResuelta);

  const solicitudesOrdenadas = [...solicitudes].sort(
  (a, b) =>
    new Date(a.createdAt).getTime() -
    new Date(b.createdAt).getTime()
);


  return () => {
    socket.off("VENTA_CREADA", onVenta);
    socket.off("VENTA_ACTUALIZADA", onVenta);
    socket.off("VENTA_ELIMINADA", onVenta);
    socket.off("SOLICITUD_CREADA", onSolicitudCreada);
    socket.off("SOLICITUD_RESUELTA", onSolicitudResuelta);
  };
}, [isAdmin, mes, anio]);




  /* =========================
     FILTROS
  ========================= */
  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      if (aseguradora !== "ALL" && v.aseguradora !== aseguradora) return false;
      if (usuario !== "ALL" && v.createdBy?.nombre !== usuario) return false;
      if (ramo !== "ALL" && v.ramo !== ramo) return false;
      return true;
    });
  }, [ventas, aseguradora, usuario, ramo]);

  /* =========================
     KPIs
  ========================= */
  const produccionTotal = ventasFiltradas.reduce(
    (acc, v) => acc + v.primaNeta,
    0
  );

  const produccionPorRamo = useMemo(() => {
    return ventasFiltradas.reduce<Record<string, number>>((acc, v) => {
      acc[v.ramo] = (acc[v.ramo] || 0) + v.primaNeta;
      return acc;
    }, {});
  }, [ventasFiltradas]);

  const aseguradoras = Array.from(new Set(ventas.map(v => v.aseguradora)));
  const usuarios = Array.from(new Set(ventas.map(v => v.createdBy?.nombre).filter(Boolean)));
  const ramos = Array.from(new Set(ventas.map(v => v.ramo)));
  /* =========================
     EXPORT EXCEL
  ========================= */
  const exportExcel = () => {
    const resumenData: any[][] = [];

    resumenData.push(["CRM · Libro de ventas"]);
    resumenData.push(["Control mensual de producción"]);
    resumenData.push([]);
    resumenData.push(["Periodo", `${mesNombre(mes)} ${anio}`]);
    resumenData.push([
      "Producción total",
      `${produccionTotal.toFixed(2)} €`,
    ]);
    resumenData.push([]);
    resumenData.push(["Producción por ramo"]);
    resumenData.push(["Ramo", "Producción (€)"]);

    Object.entries(produccionPorRamo).forEach(([ramo, total]) => {
      resumenData.push([ramo, total.toFixed(2)]);
    });

    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    wsResumen["!cols"] = [{ wch: 30 }, { wch: 25 }];

    const ventasData = ventasFiltradas.map(v => ({
      Fecha: new Date(v.fechaEfecto).toLocaleDateString(),
      Póliza: v.numeroPoliza,
      Tomador: v.tomador,
      Aseguradora: v.aseguradora,
      Ramo: v.ramo,
      "Prima (€)": v.primaNeta.toFixed(2),
      Usuario: v.createdBy?.nombre || "",
    }));

    const wsVentas = XLSX.utils.json_to_sheet(ventasData);
    wsVentas["!cols"] = [
      { wch: 12 }, { wch: 18 }, { wch: 25 },
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 22 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
    XLSX.utils.book_append_sheet(wb, wsVentas, "Ventas");

    XLSX.writeFile(wb, `libro-ventas-${mesNombre(mes)}-${anio}.xlsx`);
  };

  /* =========================
     EXPORT PDF
  ========================= */
  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 15;

    doc.setFontSize(16);
    doc.text("CRM · Libro de ventas", 14, y);

    y += 6;
    doc.setFontSize(10);
    doc.text("Control mensual de producción", 14, y);

    y += 10;

    doc.setFontSize(11);
    // doc.text(`${produccionTotal.toFixed(2)} €`, 18, y + 13);

    autoTable(doc, {
      startY: y + 20,
      head: [["Fecha", "Póliza", "Tomador", "Aseguradora", "Ramo", "Prima", "Usuario"]],
      body: ventasFiltradas.map(v => [
        new Date(v.fechaEfecto).toLocaleDateString(),
        v.numeroPoliza,
        v.tomador,
        v.aseguradora,
        v.ramo,
        `${v.primaNeta.toFixed(2)} €`,
        v.createdBy?.nombre || "",
      ]),
    });

    doc.save(`libro-ventas-${mesNombre(mes)}-${anio}.pdf`);
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">

      <div>
        <h1 className="text-2xl font-semibold">CRM · Libro de ventas</h1>
        <p className="text-sm text-slate-500">Control mensual de producción</p>
      </div>

       

      {/* AVISO ADMIN */}
      {isAdmin && solicitudesPendientes > 0 && (
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-3 rounded">
          ⚠️ Tienes solicitudes de empleados pendientes de revisión
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Producción total" value={`${produccionTotal.toFixed(2)} €`} />
        <KPICard title="Periodo" value={`${mesNombre(mes)} ${anio}`} />

        <div className="bg-white border rounded-lg p-4">
          <h4 className="text-xs font-semibold text-slate-500 mb-2">
            Producción por ramo
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            {Object.entries(produccionPorRamo).map(([r, total]) => (
              <div key={r} className="border rounded px-2 py-1 flex justify-between">
                <span className="font-medium">{r}</span>
                <span>{total.toFixed(2)} €</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FILTROS */}
<div className="bg-white border rounded-lg p-4 flex gap-6 flex-wrap items-end">

  {/* 👑 ADMIN: filtros completos */}
  {isAdmin && (
    <>
  <FiltroMes
    mes={mes}
    anio={anio}
    setMes={setMes}
    setAnio={setAnio}
    minPeriodo={minPeriodo}
    maxPeriodo={maxPeriodo}
  />

  <FiltroAnio
    anio={anio}
    setAnio={setAnio}
  />

  <Select
    label="Aseguradora"
    value={aseguradora}
    setValue={setAseguradora}
    options={aseguradoras}
  />

  <Select
    label="Ramo"
    value={ramo}
    setValue={setRamo}
    options={ramos}
  />

  <Select
    label="Usuario"
    value={usuario}
    setValue={setUsuario}
    options={usuarios}
  />
</>

  )}

 
{/* 👤 EMPLEADOS: selector de periodo simple y centrado */}
{!isAdmin && (
  <div className="w-full flex justify-center">
  <div className="flex items-center gap-6">

    {/* ◀ RETROCEDER */}
    <button
      onClick={() => {
        const anterior = new Date(anio, mes - 2, 1);

        if (anterior >= minPeriodo) {
          setMes(anterior.getMonth() + 1);
          setAnio(anterior.getFullYear());
        }
      }}
      disabled={
        new Date(anio, mes - 1, 1).getTime() === minPeriodo.getTime()
      }
      className={`text-xl font-medium transition
        ${
          new Date(anio, mes - 1, 1).getTime() === minPeriodo.getTime()
            ? "opacity-30 cursor-not-allowed"
            : "hover:text-slate-800"
        }`}
      aria-label="Mes anterior"
    >
      ◀
    </button>

    {/* PERIODO */}
    <span className="text-sm font-semibold text-slate-700 min-w-[140px] text-center select-none">
      {mesNombre(mes)} {anio}
    </span>

    {/* ▶ AVANZAR */}
    <button
      onClick={() => {
        const siguiente = new Date(anio, mes, 1);

        if (siguiente <= maxPeriodo) {
          setMes(siguiente.getMonth() + 1);
          setAnio(siguiente.getFullYear());
        }
      }}
      disabled={
        new Date(anio, mes - 1, 1).getTime() === maxPeriodo.getTime()
      }
      className={`text-xl font-medium transition
        ${
          new Date(anio, mes - 1, 1).getTime() === maxPeriodo.getTime()
            ? "opacity-30 cursor-not-allowed"
            : "hover:text-slate-800"
        }`}
      aria-label="Mes siguiente"
    >
      ▶
    </button>

  </div>
</div>

)}


</div>


      {/* TABLA */}
     {!loading && (
  <div className="w-full overflow-x-auto">
    {/* 🔒 Evita que la tabla se aplaste en móvil */}
    <div className="min-w-[1100px]">
      <VentasTable
        ventas={ventasFiltradas.map(v => ({
          _id: v._id,
          fecha: new Date(v.fechaEfecto).toLocaleDateString(),
          poliza: v.numeroPoliza,
          tomador: v.tomador,
          aseguradora: v.aseguradora,
          ramo: v.ramo,
          prima: v.primaNeta,
          usuario: v.createdBy?.nombre || "-",
        }))}
        onEdit={(row) => {
          const original = ventas.find(v => v._id === row._id);
          if (!original) return;

          let ventaInicial: any = { ...original };

          // 🔁 Reaplicar última edición pendiente del empleado
          const stored = localStorage.getItem(
            `venta_pending_${original._id}`
          );

          if (stored) {
            try {
              const payload = JSON.parse(stored);
              ventaInicial = {
                ...ventaInicial,
                ...payload,
              };
            } catch {}
          }

          // 🗓 Normalizar fecha
          ventaInicial.fechaEfecto = String(
            ventaInicial.fechaEfecto
          ).slice(0, 10);

          setVentaEditando({
            data: ventaInicial,    // con cambios
            original: original,    // 🔑 base real (para "antes:")
            changedFields: [],     // modo edición normal
            fromSocket: false,
          });
        }}
        onDelete={(row) => {
          const original = ventas.find(v => v._id === row._id);
          if (original) setVentaAEliminar(original);
        }}
      />
    </div>
  </div>
)}


      
      {/* ACCIONES */}
<div className="flex flex-wrap gap-3">
  <button
    onClick={() => navigate("/crm/nueva-venta")}
    className="bg-slate-800 text-white px-4 py-2 rounded text-sm cursor-pointer"
  >
    + Nueva venta
  </button>

  {currentUser?.role === "admin" && (
    <>
      <button
        onClick={exportExcel}
        className="border px-4 py-2 rounded text-sm cursor-pointer"
      >
        Exportar Excel
      </button>

      <button
        onClick={exportPDF}
        className="border px-4 py-2 rounded text-sm cursor-pointer"
      >
        Exportar PDF
      </button>

      {/* 👇 BOTÓN PROVISIONAL */}
    {isAdmin && (
  <button
  onClick={async () => {
    try {
      const res = await api.get("/solicitudes");
      setSolicitudes(res.data || []);
      setSolicitudesPendientes(res.data.length);
      setShowSolicitudesModal(true);
    } catch {
      alert("Error cargando solicitudes");
    }
  }}
  className="relative border px-4 py-2 rounded text-sm cursor-pointer"
>
  Ver solicitudes pendientes

  {solicitudesPendientes > 0 && (
    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
      {solicitudesPendientes}
    </span>
  )}
</button>

  
)}
{showSolicitudesModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

      {/* HEADER */}
      <div className="px-6 py-4 border-b">
        <h2 className="text-xl font-semibold">
          Solicitudes pendientes
        </h2>
      </div>

      {/* CONTENIDO */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {solicitudes.map((s) => (

          <div
            key={s._id}
            className="p-3 rounded border hover:bg-slate-100 cursor-pointer"
            onClick={async () => {
  try {
  setShowSolicitudesModal(false);

  // 🟢 EDITAR VENTA (lo que ya tenías)
  if (s.tipo === "EDITAR_VENTA") {
    // 1️⃣ Obtener venta original
    const res = await api.get(`/ventas/${s.venta._id}`);
    const original = res.data;

    // 2️⃣ Construir venta de revisión
    const ventaRevision = {
      ...original,
      ...s.payload,
      createdBy: original.createdBy,
      fechaEfecto: (() => {
        const f = s.payload?.fechaEfecto ?? original.fechaEfecto;
        if (!f) return "";

        if (typeof f === "string" && f.includes("/")) {
          const [d, m, y] = f.split("/");
          return `${y}-${m.padStart(2, "0")}-${d}`;
        }

        return String(f).slice(0, 10);
      })(),
    };

    // 3️⃣ Detectar cambios reales
    const CAMPOS_FORMULARIO = [
      "fechaEfecto",
      "numeroPoliza",
      "tomador",
      "aseguradora",
      "ramo",
      "primaNeta",
      "formaPago",
      "actividad",
      "observaciones",
    ];

    const changedFields = CAMPOS_FORMULARIO.filter((field) => {
      const o = original[field];
      const r = ventaRevision[field];

      if (field === "fechaEfecto") {
        return String(o).slice(0, 10) !== String(r).slice(0, 10);
      }

      return String(o ?? "") !== String(r ?? "");
    });

    // 4️⃣ 🔥 ABRIR MODAL DE EDICIÓN
    setVentaEditando({
      data: ventaRevision,
      original,
      changedFields,
      solicitudId: s._id,
      fromSocket: true,
    });

    return;
  }

  // 🔴 ELIMINAR VENTA 
if (s.tipo === "ELIMINAR_VENTA") {
  const res = await api.get(`/ventas/${s.venta._id}`);
  const original = res.data;

  const ventaDelete = {
    ...original,
    fechaEfecto: String(original.fechaEfecto).slice(0, 10),
  };

  setVentaEditando({
    data: ventaDelete,
    original,
    changedFields: ["__DELETE__"],
    solicitudId: s._id,
    fromSocket: true,
  });

  return;
}




} catch (e) {
  alert("Error cargando la solicitud");
}

}}

          >
            <div className="text-sm font-medium">
              {s.venta?.tomador || "Sin tomador"}
            </div>
            <div className="text-xs text-slate-500">
              Modificar venta
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div className="px-6 py-4 border-t flex justify-end">
        <button
          onClick={() => setShowSolicitudesModal(false)}
          className="px-5 py-2 rounded bg-slate-800 text-white hover:bg-slate-900"
        >
          Cerrar
        </button>
      </div>

    </div>
  </div>
)}




    </>
  )}
</div>


      {/* MODALES */}
      {ventaEditando && (
        <EditVentaModal
          venta={ventaEditando}
          onClose={() => setVentaEditando(null)}
          onSaved={() => {
            fetchLibroVentas();
            setVentaEditando(null);
          }}
        />
      )}

      {ventaAEliminar && (
  <ConfirmModal
    title="Eliminar venta"
    description={`¿Eliminar la póliza ${ventaAEliminar.numeroPoliza}?`}
    onCancel={() => setVentaAEliminar(null)}
    onConfirm={async () => {
      try {
        await api.delete(`/ventas/${ventaAEliminar._id}`);

        // ADMIN → eliminación directa
        fetchLibroVentas();
        setVentaAEliminar(null);

      } catch (error: any) {
        if (error.response?.status === 403) {
          // EMPLEADO → solo info, NADA MÁS
          setVentaAEliminar(null);
          setShowDeleteInfo(true);
          return;
        }
      }
    }}
  />
)}

{showDeleteInfo && (
  <InfoModal
    type="delete"
    onClose={() => {
      setShowDeleteInfo(false);
      fetchLibroVentas();
    }}
  />
)}




    </div>
  );
}

/* =========================
   AUX
========================= */
function Select({ label, value, setValue, options }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="border rounded px-3 py-2 text-sm cursor-pointer"
      >
        <option value="ALL">Todos</option>
        {options.map((o: string) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function FiltroMes({
  mes,
  //anio,
  setMes,
//  setAnio,
 // minPeriodo,
 // maxPeriodo,
}: any) {

  return (
    <div>
      <label className="block text-xs font-semibold mb-1">Mes</label>
      <select
        value={mes}
        onChange={(e) => setMes(Number(e.target.value))}
        className="border rounded px-3 py-2 text-sm cursor-pointer"
      >
        {meses.map((m, i) => (
          <option key={i} value={i + 1}>{m}</option>
        ))}
      </select>
    </div>
  );
}

function FiltroAnio({ anio, setAnio }: any) {
  const y = new Date().getFullYear();
  return (
    <div>
      <label className="block text-xs font-semibold mb-1">Año</label>
      <select
        value={anio}
        onChange={(e) => setAnio(Number(e.target.value))}
        className="border rounded px-3 py-2 text-sm cursor-pointer"
      >
        {[y - 2, y - 1, y, y + 1].map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </div>
  );
}

const meses = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function mesNombre(mes: number) {
  return meses[mes - 1];
}
