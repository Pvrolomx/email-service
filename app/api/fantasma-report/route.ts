import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// DESTINO FIJO: pvrolomx@yahoo.com.mx
const REPORT_EMAIL = "pvrolomx@yahoo.com.mx";
const FANTASMA_API = "https://fantasma.duendes.app/api/score";

// Alert level colors
const ALERT_COLORS: Record<string, string> = {
  "BAJO": "#22c55e",
  "MODERADO": "#eab308",
  "ELEVADO": "#f97316",
  "ALTO": "#ef4444",
  "CRITICO": "#7f1d1d",
};

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this automatically)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
    }

    const resend = new Resend(resendKey);

    // Fetch Fantasma score
    const scoreRes = await fetch(FANTASMA_API, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });

    if (!scoreRes.ok) {
      return NextResponse.json({ error: "Failed to fetch Fantasma score" }, { status: 500 });
    }

    const score = await scoreRes.json();
    
    const alertLevel = score.alert_level || "DESCONOCIDO";
    const alertEmoji = score.alert_emoji || "⚪";
    const totalScore = score.total_score || 0;
    const rawScore = score.raw_score || 0;
    const maxRaw = score.max_raw || 263;
    const action = score.recommended_action || "Monitorear";
    const activeSignals = score.active_signals || 0;
    const activeDetails = score.active_details || [];
    const diasRojo = score.dias_rojo?.signals || {};
    const protocolo0 = score.protocolo_0 || {};

    // Count chronic signals (>30 days in red)
    const chronicSignals = Object.entries(diasRojo)
      .filter(([_, data]: [string, any]) => data.consecutive_days >= 30)
      .map(([signal, data]: [string, any]) => ({ signal, days: data.consecutive_days }));

    // Get red signals
    const redSignals = Object.entries(diasRojo)
      .filter(([_, data]: [string, any]) => data.is_red)
      .map(([signal, data]: [string, any]) => ({
        signal,
        label: data.label,
        value: data.current_value,
        days: data.consecutive_days,
        since: data.red_since,
      }))
      .sort((a, b) => b.days - a.days);

    const dateStr = new Date().toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Mexico_City",
    });

    const alertColor = ALERT_COLORS[alertLevel] || "#666";

    const htmlContent = `
      <div style="font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #e5e5e5; padding: 2rem; border-radius: 12px; border: 1px solid #1f1f2e;">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <h1 style="color: #fff; font-size: 1.5rem; margin: 0 0 0.5rem 0;">👻 FANTASMA</h1>
          <p style="opacity: 0.6; margin: 0; font-size: 0.85rem;">Observatorio de Crisis MXN</p>
          <p style="opacity: 0.5; margin: 0.5rem 0 0 0; font-size: 0.75rem;">${dateStr}</p>
        </div>

        <!-- Main Score -->
        <div style="background: linear-gradient(135deg, ${alertColor}22 0%, ${alertColor}11 100%); border: 1px solid ${alertColor}44; border-radius: 12px; padding: 1.5rem; text-align: center; margin-bottom: 1.5rem;">
          <div style="font-size: 3.5rem; font-weight: 700; color: ${alertColor}; margin-bottom: 0.25rem;">
            ${alertEmoji} ${totalScore}
          </div>
          <div style="font-size: 1.1rem; color: ${alertColor}; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
            ${alertLevel}
          </div>
          <div style="font-size: 0.85rem; opacity: 0.7; margin-top: 0.5rem;">
            ${rawScore}/${maxRaw} puntos raw • ${activeSignals} señales activas
          </div>
          <div style="font-size: 0.9rem; margin-top: 0.75rem; padding: 0.5rem; background: ${alertColor}22; border-radius: 6px;">
            🎯 ${action}
          </div>
        </div>

        ${protocolo0.protocolo_0_active ? `
        <!-- Protocolo 0 Alerts -->
        <div style="background: #7f1d1d22; border: 1px solid #7f1d1d66; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
          <h3 style="color: #ef4444; font-size: 0.9rem; margin: 0 0 0.75rem 0;">⚠️ PROTOCOLO 0 ACTIVO</h3>
          <p style="color: #fca5a5; font-size: 0.85rem; margin: 0;">${protocolo0.severity}</p>
          ${protocolo0.alerts?.map((a: any) => `
            <div style="margin-top: 0.5rem; padding: 0.5rem; background: #7f1d1d33; border-radius: 4px; font-size: 0.8rem;">
              <strong style="color: #f87171;">${a.name}:</strong> ${a.message}
            </div>
          `).join("") || ""}
        </div>
        ` : ""}

        <!-- Red Signals -->
        ${redSignals.length > 0 ? `
        <div style="margin-bottom: 1.5rem;">
          <h3 style="color: #ef4444; font-size: 0.9rem; margin: 0 0 0.75rem 0; border-bottom: 1px solid #333; padding-bottom: 0.5rem;">
            🔴 SEÑALES EN ROJO (${redSignals.length})
          </h3>
          ${redSignals.map(s => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #1f1f2e;">
              <div>
                <span style="color: #f87171; font-weight: 500;">${s.label}</span>
                <span style="color: #666; font-size: 0.75rem; margin-left: 0.5rem;">${s.signal}</span>
              </div>
              <div style="text-align: right;">
                <span style="color: #fff;">${typeof s.value === 'number' ? s.value.toFixed(2) : s.value}</span>
                <span style="color: #ef4444; font-size: 0.75rem; margin-left: 0.5rem;">${s.days}d</span>
              </div>
            </div>
          `).join("")}
        </div>
        ` : ""}

        <!-- Active Signals Summary -->
        <div style="margin-bottom: 1.5rem;">
          <h3 style="color: #D4A853; font-size: 0.9rem; margin: 0 0 0.75rem 0; border-bottom: 1px solid #333; padding-bottom: 0.5rem;">
            📊 SEÑALES ACTIVAS (${activeDetails.length})
          </h3>
          ${activeDetails.slice(0, 8).map((s: any) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; border-bottom: 1px solid #1f1f2e; font-size: 0.85rem;">
              <span style="color: #ccc;">${s.signal}</span>
              <span>
                <span style="color: #D4A853; font-weight: 500;">${s.score}</span>
                <span style="color: #666;">/${s.max_score}</span>
              </span>
            </div>
          `).join("")}
          ${activeDetails.length > 8 ? `<p style="color: #666; font-size: 0.75rem; margin-top: 0.5rem;">+ ${activeDetails.length - 8} más...</p>` : ""}
        </div>

        ${chronicSignals.length > 0 ? `
        <!-- Chronic Signals -->
        <div style="background: #7f1d1d11; border: 1px solid #7f1d1d33; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
          <h3 style="color: #f87171; font-size: 0.85rem; margin: 0 0 0.5rem 0;">⏰ SEÑALES CRÓNICAS (+30 días)</h3>
          ${chronicSignals.map(s => `
            <div style="font-size: 0.8rem; color: #fca5a5;">${s.signal}: ${s.days} días consecutivos</div>
          `).join("")}
        </div>
        ` : ""}

        <!-- Footer -->
        <div style="text-align: center; padding-top: 1rem; border-top: 1px solid #1f1f2e;">
          <a href="https://fantasma.duendes.app" style="color: #D4A853; text-decoration: none; font-size: 0.85rem;">
            Ver dashboard completo →
          </a>
          <p style="font-size: 0.7rem; color: #555; margin-top: 0.75rem;">
            Enviado via Duendes — ${new Date().getFullYear()}
          </p>
        </div>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: "Fantasma <info@expatadvisormx.com>",
      to: [REPORT_EMAIL],
      subject: `${alertEmoji} Fantasma ${totalScore}/100 ${alertLevel} — ${redSignals.length} señales rojas`,
      html: htmlContent,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      score: totalScore,
      level: alertLevel,
      redSignals: redSignals.length,
      sentTo: REPORT_EMAIL,
    });
  } catch (error: any) {
    console.error("Fantasma report error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
