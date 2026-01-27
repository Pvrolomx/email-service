"use client";

import { useState } from "react";

export default function Home() {
  const [formData, setFormData] = useState({
    to: "",
    subject: "",
    message: "",
    from: "",
    name: "",
  });
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        setStatus({ type: "success", text: "✅ Email enviado correctamente" });
        setFormData({ to: "", subject: "", message: "", from: "", name: "" });
      } else {
        setStatus({ type: "error", text: `❌ ${data.error}` });
      }
    } catch (error) {
      setStatus({ type: "error", text: "❌ Error de conexión" });
    }

    setLoading(false);
  };

  return (
    <main className="container">
      <h1>📧 Email Service</h1>
      <p style={{ color: "#888", marginBottom: "2rem" }}>
        API simple para enviar emails desde cualquier formulario
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Para (email destino)*</label>
          <input
            type="email"
            value={formData.to}
            onChange={(e) => setFormData({ ...formData, to: e.target.value })}
            placeholder="destino@ejemplo.com"
            required
          />
        </div>

        <div className="form-group">
          <label>Asunto*</label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="Asunto del email"
            required
          />
        </div>

        <div className="form-group">
          <label>Tu nombre</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Tu nombre"
          />
        </div>

        <div className="form-group">
          <label>Tu email (para respuestas)</label>
          <input
            type="email"
            value={formData.from}
            onChange={(e) => setFormData({ ...formData, from: e.target.value })}
            placeholder="tu@email.com"
          />
        </div>

        <div className="form-group">
          <label>Mensaje*</label>
          <textarea
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Escribe tu mensaje aquí..."
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Enviar Email"}
        </button>
      </form>

      {status && (
        <div className={`message ${status.type}`}>{status.text}</div>
      )}

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
    to: "destino@email.com",    // Requerido
    subject: "Asunto",          // Requerido
    message: "Contenido",       // Requerido
    from: "remitente@email.com", // Opcional
    name: "Nombre"              // Opcional
  })
})`}
        </pre>
      </div>

      <footer>
        Hecho con 🧡 por Colmena 2026
      </footer>
    </main>
  );
}
