import { useEffect, useRef, useState } from "react";


type ResumenCalculo = {
  
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

type FacturaProgress = {
  porcentaje: number;
  texto: string;
};

type ExcelComisionesProps = {
  facturaProgress?: FacturaProgress | null;
};

export default function ExcelComisiones({
  facturaProgress,
}: ExcelComisionesProps) {
  const [resumen, setResumen] = useState<ResumenCalculo | null>(null);
  const [datosFactura, setDatosFactura] = useState<DatosFactura | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [liquidoCalculado, setLiquidoCalculado] = useState<number | null>(null);
  const [usandoLiquidoOficial, setUsandoLiquidoOficial] = useState(false);

  const [progress, setProgress] = useState(0);
const [progressText, setProgressText] = useState("");
const socketProgressRef = useRef(false);

useEffect(() => {
  if (!facturaProgress) return;

  console.log("🔥 PROGRESO FACTURA EN EXCEL:", facturaProgress);

  socketProgressRef.current = true;

  setLoading(true);
  setProgress(Number(facturaProgress.porcentaje || 0));
  setProgressText(facturaProgress.texto || "Procesando PDF...");
}, [facturaProgress]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setProgress(5);
    setProgressText("Subiendo archivo...");
    socketProgressRef.current = false;
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

let fakeProgress = 5;

const progressInterval = setInterval(() => {
  if (socketProgressRef.current) return;

  fakeProgress += Math.random() * 8;

  if (fakeProgress < 35) {
    setProgressText("Leyendo PDF...");
  } else if (fakeProgress < 70) {
    setProgressText("Extrayendo datos...");
  } else if (fakeProgress < 92) {
    setProgressText("Calculando importes...");
  }

  setProgress(Math.min(fakeProgress, 92));
}, 600);

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

clearInterval(progressInterval);
setProgress(100);
setProgressText("Proceso completado");

if (!response.ok) {

  clearInterval(progressInterval);
  setProgress(0);
  setProgressText("");

  setLogs([
    `❌ ${data.message || data.error || "Error servidor"}`,
  ]);

  setLoading(false);
  return;
}

      if (data.error) {

  clearInterval(progressInterval);
  setProgress(0);
  setProgressText("");

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

  clearInterval(progressInterval);
  setProgress(0);
  setProgressText("");

  setLogs(["❌ Error procesando archivo"]);
}

    setTimeout(() => {
  setLoading(false);
  setProgress(0);
  setProgressText("");
}, 600);
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
  <div style={{ marginTop: 20 }}>
    <div
      style={{
        fontSize: 14,
        color: "#555",
        marginBottom: 8,
        fontWeight: 600,
      }}
    >
      {progressText} {Math.round(progress)}%
    </div>

    <div
      style={{
        width: "100%",
        height: 12,
        background: "#e5e7eb",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: "100%",
          background: "linear-gradient(90deg, #22c55e, #16a34a)",
          borderRadius: 999,
          transition: "width 0.4s ease",
        }}
      />
    </div>
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
         {(() => {
  let dentroResumenPdf = false;

  return logs.map((log, i) => {
    const texto = log.trim();

    if (texto.includes("----- CONCEPTOS RESUMEN PDF -----")) {
      dentroResumenPdf = true;
    }

    const esLineaDetalle =
      dentroResumenPdf && texto.startsWith("- ");

    if (texto === "--------------------------------") {
      dentroResumenPdf = false;
    }

    return (
      <div
        key={i}
        style={{
          color: esLineaDetalle ? "#cfd8dc" : "#00ff66",
          fontWeight: esLineaDetalle ? 500 : 600,
          paddingLeft: esLineaDetalle ? 14 : 0,
          opacity: esLineaDetalle ? 0.95 : 1,
        }}
      >
        {log}
      </div>
    );
  });
})()}
        </div>
      )}
    </div>
  );
}