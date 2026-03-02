import { useState } from "react";

type ResumenCalculo = {
  abonos: number;
  extornos: number;
  base: number;
  irpf: number;
  compensaciones: number;
  otrosGastos: number;
  liquido: number;
  nuevaProduccion?: number;
  renovaciones?: number;
};

type DatosFactura = {
  numeroFactura?: string;
  periodo?: string;
  razonSocial?: string;
  cif?: string;
};

type BackendResponse = {
  resumen?: ResumenCalculo;
  datosFactura?: DatosFactura;
  logs?: string[];
  error?: string;
  message?: string;
};

export default function ExcelComisiones() {
  const [resumen, setResumen] = useState<ResumenCalculo | null>(null);
  const [datosFactura, setDatosFactura] = useState<DatosFactura | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [liquidoCalculado, setLiquidoCalculado] = useState<number | null>(null);
  const [usandoLiquidoOficial, setUsandoLiquidoOficial] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResumen(null);
    setDatosFactura(null);
    setLogs([]);
    setLiquidoCalculado(null);
    setUsandoLiquidoOficial(false);

    const token = localStorage.getItem("token");

    if (!token) {
      setLogs(["❌ No hay sesión activa"]);
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/crm/facturas/procesar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data: BackendResponse = await response.json();

      if (!response.ok) {
        setLogs([
          `❌ ${data.message || data.error || "Error servidor"}`,
        ]);
        setLoading(false);
        return;
      }

      if (data.error) {
        setLogs([`❌ ${data.error}`]);
        setLoading(false);
        return;
      }

      setResumen(data.resumen ?? null);
      setDatosFactura(data.datosFactura ?? null);
      setLogs(Array.isArray(data.logs) ? data.logs : []);

      const logString = (data.logs || []).join(" ");
      const usoOficial = logString.includes("Se usa el líquido oficial");
      setUsandoLiquidoOficial(usoOficial);

      const match = logString.match(/Líquido calculado: ([\d\.]+) €/);
      if (match) {
        setLiquidoCalculado(parseFloat(match[1]));
      }

    } catch (error) {
      setLogs(["❌ Error procesando archivo"]);
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 40, fontFamily: "Inter, sans-serif" }}>
      
      <h1 style={{ marginBottom: 30 }}>
        Auditoría Comisiones
      </h1>

      {/* ZONA DE CARGA */}
      <div
        style={{
          border: "2px dashed #d0d5dd",
          borderRadius: 20,
          padding: 40,
          textAlign: "center",
          background: "#fafafa",
          marginBottom: 40,
        }}
      >
        <div style={{ fontSize: 16, marginBottom: 15 }}>
          Selecciona factura PDF o Excel
        </div>

        <input
          type="file"
          accept=".pdf,.xls,.xlsx"
          onChange={handleFile}
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        />

        {loading && (
          <div style={{ marginTop: 15, fontSize: 14, color: "#555" }}>
            Procesando archivo...
          </div>
        )}
      </div>

      {/* DATOS FACTURA */}
      {datosFactura && (
        <div
          style={{
            background: "white",
            padding: 25,
            borderRadius: 18,
            boxShadow: "0 8px 25px rgba(0,0,0,0.05)",
            marginBottom: 30,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 15,
              color: "#555",
            }}
          >
            Datos de la factura
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 15,
              fontSize: 14,
            }}
          >
            <div>
              <strong>Nº Factura:</strong><br />
              {datosFactura.numeroFactura || "—"}
            </div>

            <div>
              <strong>Periodo:</strong><br />
              {datosFactura.periodo || "—"}
            </div>

            <div>
              <strong>Razón Social:</strong><br />
              {datosFactura.razonSocial || "—"}
            </div>

            <div>
              <strong>CIF:</strong><br />
              {datosFactura.cif || "—"}
            </div>
          </div>
        </div>
      )}

      {/* RESULTADOS */}
      {resumen && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 20,
            marginBottom: 40,
          }}
        >
          {[
            { label: "Abonos", value: resumen.abonos },
            { label: "Extornos", value: resumen.extornos },
            { label: "Base Fiscal", value: resumen.base },
            { label: "IRPF (15%)", value: resumen.irpf },
            { label: "Compensaciones", value: resumen.compensaciones },
            { label: "Nueva Producción (N)", value: resumen.nuevaProduccion ?? 0 },
            { label: "Renovaciones (C)", value: resumen.renovaciones ?? 0 },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: 20,
                borderRadius: 18,
                background: "white",
                boxShadow: "0 8px 25px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontSize: 13, color: "#888" }}>
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  marginTop: 6,
                }}
              >
                {item.value.toFixed(2)} €
              </div>
            </div>
          ))}

          {/* TARJETA LIQUIDO */}
          <div
            style={{
              padding: 20,
              borderRadius: 18,
              background: usandoLiquidoOficial
                ? "linear-gradient(135deg, #fff8e1, #ffe082)"
                : "white",
              boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
              border: usandoLiquidoOficial
                ? "2px solid #ffb300"
                : "none",
            }}
          >
            <div style={{ fontSize: 13, color: "#888" }}>
              Importe Líquido
            </div>

            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                marginTop: 6,
              }}
            >
              {resumen.liquido.toFixed(2)} €
            </div>

            {usandoLiquidoOficial && liquidoCalculado !== null && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "#c62828",
                }}
              >
                Calculado: {liquidoCalculado.toFixed(2)} €
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOGS */}
      {logs && logs.length > 0 && (
        <div
          style={{
            background: "#111",
            color: "#0f0",
            padding: 20,
            borderRadius: 12,
            fontFamily: "monospace",
            maxHeight: 250,
            overflowY: "auto",
          }}
        >
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      )}
    </div>
  );
}