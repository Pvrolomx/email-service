import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// Dominios verificados en Resend
const VERIFIED_DOMAINS: Record<string, string> = {
  "duendes.app": "pacto@duendes.app",
  "castlesolutions.mx": "noreply@castlesolutions.mx",
  "castlesolutions.biz": "noreply@castlesolutions.mx",
  "expatadvisormx.com": "info@expatadvisormx.com",
};

// A QUIEN se le puede escribir. Antes `to` venia del cliente sin validar: cualquiera
// podia mandar correo a CUALQUIER direccion del mundo desde los dominios verificados
// de arriba (relay abierto).
//
// La regla es por DOMINIO, no por direccion exacta, a proposito: solo se entrega a
// buzones de dominios propios. Eso cierra el relay hacia terceros sin romper a ningun
// llamador interno que escriba a un buzon que yo no conozca. Una lista de direcciones
// exactas habria sido mas estricta pero se rompe sola en cuanto aparece un buzon nuevo,
// y romper una forma de contacto en silencio es justo el bug que acabamos de arreglar.
//
// ALLOWED_RECIPIENTS agrega direcciones sueltas fuera de esos dominios, si algun dia hace falta.
const ALLOWED_RECIPIENTS = new Set(
  (process.env.ALLOWED_RECIPIENTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

function recipientAllowed(address: string): boolean {
  if (ALLOWED_RECIPIENTS.has(address)) return true;
  const domain = address.split("@")[1];
  return Boolean(domain && domain in VERIFIED_DOMAINS);
}

// Limite por IP: best-effort. En serverless cada instancia tiene su propio Map,
// asi que frena el abuso casual, no a un atacante decidido.
// 10 y no 5: varios visitantes pueden compartir IP (wifi de hotel, CGNAT movil)
// y no queremos tirar consultas legitimas de huespedes reales.
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_WINDOW || 10);
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_LIMIT;
}

// Escapa antes de meter texto del cliente al HTML del correo. Sin esto,
// cualquiera podia inyectar markup y enlaces en un correo que sale con
// SPF/DKIM validos de un dominio propio: phishing con remitente legitimo.
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// CORS abierto, igual que antes. Una lista blanca de origenes se veia tentadora,
// pero un header Origin se falsea con un curl (o sea, casi no agrega seguridad) y en
// cambio tumba en silencio cualquier sitio propio que no este en la lista. Quien carga
// con la seguridad real es la restriccion de destinatarios de arriba.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders;

  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "desconocida";
    if (rateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: "Demasiados envios. Intenta mas tarde." },
        { status: 429, headers }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "RESEND_API_KEY no configurado" },
        { status: 500, headers }
      );
    }

    const body = await req.json();
    const { to, subject, message, from, name, sendFrom } = body;

    if (!to || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Faltan campos: to, subject, message" },
        { status: 400, headers }
      );
    }

    const recipients = (Array.isArray(to) ? to : [to]).map((r) =>
      String(r).trim().toLowerCase()
    );
    const rejected = recipients.filter((r) => !recipientAllowed(r));
    if (rejected.length) {
      console.warn("Destinatario rechazado:", rejected.join(", "));
      return NextResponse.json(
        { success: false, error: "Destinatario no autorizado" },
        { status: 403, headers }
      );
    }

    const resend = new Resend(apiKey);
    let verifiedFrom = VERIFIED_DOMAINS["expatadvisormx.com"];
    const senderName = name || "Email Service";
    if (sendFrom && VERIFIED_DOMAINS[sendFrom]) {
      verifiedFrom = VERIFIED_DOMAINS[sendFrom];
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${esc(subject)}</h2>
        ${name ? `<p><strong>De:</strong> ${esc(name)} (${esc(from || "No especificado")})</p>` : ""}
        ${from ? `<p><strong>Email:</strong> ${esc(from)}</p>` : ""}
        <hr style="border: 1px solid #eee;" />
        <div style="white-space: pre-wrap; color: #555;">${esc(message)}</div>
        <hr style="border: 1px solid #eee;" />
        <p style="font-size: 12px; color: #999;">
          Enviado via ${sendFrom === "expatadvisormx.com" ? "Expat Advisor MX" : sendFrom === "duendes.app" ? "Duendes" : "Castle Solutions"} - ${new Date().getFullYear()}
        </p>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: `${senderName} <${verifiedFrom}>`,
      to: recipients,
      subject,
      html: htmlContent,
      replyTo: from || undefined,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500, headers }
      );
    }

    return NextResponse.json(
      { success: true, message: "Email enviado correctamente", id: data?.id },
      { headers }
    );
  } catch (error: any) {
    console.error("Error enviando email:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al enviar email" },
      { status: 500, headers }
    );
  }
}
