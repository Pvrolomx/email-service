import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Transporter (se configura con env vars)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// Handle OPTIONS (CORS preflight)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Handle POST (enviar email)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject, message, from, name } = body;

    // Validar campos requeridos
    if (!to || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Faltan campos: to, subject, message" },
        { status: 400, headers: corsHeaders }
      );
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

    // Enviar email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html: htmlContent,
      replyTo: from || process.env.EMAIL_USER,
    });

    return NextResponse.json(
      { success: true, message: "Email enviado correctamente" },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("Error enviando email:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al enviar email" },
      { status: 500, headers: corsHeaders }
    );
  }
}
