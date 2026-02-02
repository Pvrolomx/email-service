import { NextRequest, NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";

// Dominios verificados en SendGrid
const VERIFIED_DOMAINS: Record<string, string> = {
  "duendes.app": "pacto@duendes.app",
  "castlesolutions.mx": "noreply@castlesolutions.mx",
  "castlesolutions.biz": "noreply@castlesolutions.mx",
  "expatadvisormx.com": "info@expatadvisormx.com",
};

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle OPTIONS (CORS preflight)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Handle POST (enviar email)
export async function POST(req: NextRequest) {
  try {
    // Configurar SendGrid en cada request
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "SENDGRID_API_KEY no configurado" },
        { status: 500, headers: corsHeaders }
      );
    }
    sgMail.setApiKey(apiKey);

    const body = await req.json();
    const { to, subject, message, from, name, sendFrom } = body;

    // Validar campos requeridos
    if (!to || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Faltan campos: to, subject, message" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Determinar el remitente verificado
    // Si se especifica sendFrom y está verificado, usarlo
    // Si no, usar el default de castlesolutions
    let verifiedFrom = VERIFIED_DOMAINS["castlesolutions.mx"];
    let senderName = name || "Email Service";
    
    if (sendFrom && VERIFIED_DOMAINS[sendFrom]) {
      verifiedFrom = VERIFIED_DOMAINS[sendFrom];
    }

    // Formatear HTML del email
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${subject}</h2>
        ${name ? `<p><strong>De:</strong> ${name} (${from || "No especificado"})</p>` : ""}
        ${from ? `<p><strong>Email:</strong> ${from}</p>` : ""}
        <hr style="border: 1px solid #eee;" />
        <div style="white-space: pre-wrap; color: #555;">${message}</div>
        <hr style="border: 1px solid #eee;" />
        <p style="font-size: 12px; color: #999;">
          Enviado via Email Service - Colmena 2026
        </p>
      </div>
    `;

    // Enviar email con SendGrid
    const msg = {
      to: Array.isArray(to) ? to : to,
      from: {
        email: verifiedFrom,
        name: senderName,
      },
      subject,
      html: htmlContent,
      replyTo: from || undefined,
    };

    await sgMail.send(msg);

    return NextResponse.json(
      { success: true, message: "Email enviado correctamente" },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("Error enviando email:", error);
    const errorMsg = error.response?.body?.errors?.[0]?.message || error.message || "Error al enviar email";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500, headers: corsHeaders }
    );
  }
}
