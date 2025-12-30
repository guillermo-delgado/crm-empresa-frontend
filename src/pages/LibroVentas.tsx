import { useEffect, useMemo, useState } from "react";
import KPICard from "../components/crm/KPICard";
import VentasTable from "../components/crm/VentasTable";
import EditVentaModal from "../components/ventas/EditVentaModal";
import ConfirmModal from "../components/ventas/ConfirmModal";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

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

export default function LibroVentas() {
  const navigate = useNavigate();

  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());

  const [ventas, setVentas] = useState<VentaAPI[]>([]);
  const [loading, setLoading] = useState(false);

  const [ventaEditando, setVentaEditando] = useState<VentaAPI | null>(null);
  const [ventaAEliminar, setVentaAEliminar] = useState<VentaAPI | null>(null);

  const [aseguradora, setAseguradora] = useState("ALL");
  const [usuario, setUsuario] = useState("ALL");
  const [ramo, setRamo] = useState("ALL");

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

  useEffect(() => {
    fetchLibroVentas();
  }, [mes, anio]);

  /* FILTROS */
  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      if (aseguradora !== "ALL" && v.aseguradora !== aseguradora) return false;
      if (usuario !== "ALL" && v.createdBy?.nombre !== usuario) return false;
      if (ramo !== "ALL" && v.ramo !== ramo) return false;
      return true;
    });
  }, [ventas, aseguradora, usuario, ramo]);

  /* KPIs */
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

  /* EXPORT EXCEL (TODO) */
  const exportExcel = () => {
  /* ========= HOJA RESUMEN ========= */

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

  /* Ajustes visuales */
  wsResumen["!cols"] = [
    { wch: 30 },
    { wch: 25 },
  ];

  /* ========= HOJA VENTAS ========= */

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
    { wch: 12 },
    { wch: 18 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
  ];

  /* ========= WORKBOOK ========= */

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
  XLSX.utils.book_append_sheet(wb, wsVentas, "Ventas");

  XLSX.writeFile(
    wb,
    `libro-ventas-${mesNombre(mes)}-${anio}.xlsx`
  );
};


  /* EXPORT PDF (TODO) */
  const exportPDF = () => {
  const doc = new jsPDF();

  let y = 15;

  /* ===== TÍTULO ===== */
  doc.setFontSize(16);
  doc.text("CRM · Libro de ventas", 14, y);

  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Control mensual de producción", 14, y);

  y += 10;

  /* ===== KPIs ===== */
  doc.setTextColor(0);
  doc.setFontSize(11);

  doc.roundedRect(14, y, 60, 18, 3, 3);
  doc.text("Producción total", 18, y + 6);
  doc.setFontSize(13);
  doc.text(`${produccionTotal.toFixed(2)} €`, 18, y + 13);

  doc.setFontSize(11);
  doc.roundedRect(80, y, 60, 18, 3, 3);
  doc.text("Periodo", 84, y + 6);
  doc.setFontSize(13);
  doc.text(`${mesNombre(mes)} ${anio}`, 84, y + 13);

  y += 26;

  /* ===== PRODUCCIÓN POR RAMO ===== */
  doc.setFontSize(11);
  doc.text("Producción por ramo", 14, y);
  y += 6;

  let x = 14;
  const boxWidth = 45;
  const boxHeight = 18;

  Object.entries(produccionPorRamo).forEach(([ramo, total]) => {
    if (x + boxWidth > 190) {
      x = 14;
      y += boxHeight + 6;
    }

    doc.roundedRect(x, y, boxWidth, boxHeight, 3, 3);
    doc.setFontSize(10);
    doc.text(ramo, x + 4, y + 7);
    doc.setFontSize(11);
    doc.text(`${total.toFixed(2)} €`, x + 4, y + 14);

    x += boxWidth + 6;
  });

  y += boxHeight + 12;

  /* ===== TABLA ===== */
  autoTable(doc, {
    startY: y,
    head: [[
      "Fecha",
      "Póliza",
      "Tomador",
      "Aseguradora",
      "Ramo",
      "Prima",
      "Usuario",
    ]],
    body: ventasFiltradas.map(v => [
      new Date(v.fechaEfecto).toLocaleDateString(),
      v.numeroPoliza,
      v.tomador,
      v.aseguradora,
      v.ramo,
      `${v.primaNeta.toFixed(2)} €`,
      v.createdBy?.nombre || "",
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 20,
      fontStyle: "bold",
    },
  });

  doc.save(`libro-ventas-${mesNombre(mes)}-${anio}.pdf`);
};


  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">

      {/* CABECERA */}
      <div>
        <h1 className="text-2xl font-semibold">CRM · Libro de ventas</h1>
        <p className="text-sm text-slate-500">Control mensual de producción</p>
      </div>

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
        <FiltroMes mes={mes} setMes={setMes} />
        <FiltroAnio anio={anio} setAnio={setAnio} />
        <Select label="Aseguradora" value={aseguradora} setValue={setAseguradora} options={aseguradoras} />
        <Select label="Ramo" value={ramo} setValue={setRamo} options={ramos} />
        <Select label="Usuario" value={usuario} setValue={setUsuario} options={usuarios} />
      </div>

      {/* TABLA */}
      {!loading && (
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
            if (original) setVentaEditando(original);
          }}
          onDelete={(row) => {
            const original = ventas.find(v => v._id === row._id);
            if (original) setVentaAEliminar(original);
          }}
        />
      )}

      {/* ACCIONES */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate("/crm/nueva-venta")}
          className="bg-slate-800 text-white px-4 py-2 rounded text-sm cursor-pointer"
        >
          + Nueva venta
        </button>

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
            await api.delete(`/ventas/${ventaAEliminar._id}`);
            fetchLibroVentas();
            setVentaAEliminar(null);
          }}
        />
      )}
    </div>
  );
}

/* AUX */
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

function FiltroMes({ mes, setMes }: any) {
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
