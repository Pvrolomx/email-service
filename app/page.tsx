export default function Home() {
  return (
    <main className="container">
      <h1>📧 Email Service</h1>
      <p style={{ color: "#888", marginBottom: "2rem" }}>
        API simple para enviar emails desde los formularios de contacto propios
      </p>

      <div className="docs">
        <h2>📚 Cómo usar la API</h2>
        <p style={{ color: "#888", marginBottom: "1rem" }}>
          Envía un POST a <code>/api/send</code> con los siguientes campos:
        </p>
        <pre>
{`fetch("https://TU-DOMINIO/api/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: "info@expatadvisormx.com", // Requerido. Solo buzones de dominios propios
    subject: "Asunto",             // Requerido
    message: "Contenido",          // Requerido
    from: "remitente@email.com",   // Opcional. Se usa como reply-to
    name: "Nombre",                // Opcional
    sendFrom: "expatadvisormx.com" // Opcional. Elige el remitente verificado
  })
})`}
        </pre>

        <h2>🔒 Límites</h2>
        <ul style={{ color: "#888", lineHeight: 1.8 }}>
          <li>
            <strong>Destinatarios:</strong> solo buzones de los dominios verificados en Resend
            (<code>expatadvisormx.com</code>, <code>castlesolutions.mx</code>,{" "}
            <code>castlesolutions.biz</code>, <code>duendes.app</code>). Cualquier otra dirección
            devuelve <code>403</code>. Es lo que evita que el endpoint sirva de relay abierto.
          </li>
          <li>
            <strong>Contenido:</strong> el texto que manda el cliente se escapa antes de entrar al
            HTML del correo, para que nadie inyecte enlaces ni markup en un mensaje que sale con
            SPF/DKIM válidos de un dominio propio.
          </li>
          <li>
            <strong>Frecuencia:</strong> 10 envíos por IP cada 10 minutos. Es best-effort: el
            contador vive en memoria y cada instancia serverless tiene la suya.
          </li>
        </ul>

        <p style={{ color: "#888", marginTop: "1rem" }}>
          Esta página ya no trae formulario de envío: era una forma pública que permitía disparar
          correos desde los dominios verificados sin pasar por ninguno de los sitios propios.
        </p>
      </div>

      <footer>
        Hecho con 🧡 por Colmena 2026
      </footer>
    </main>
  );
}
