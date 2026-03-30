import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// DESTINO FIJO: pvrolomx@yahoo.com.mx
const REPORT_EMAIL = "pvrolomx@yahoo.com.mx";

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this automatically)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !supabaseKey || !resendKey) {
      return NextResponse.json({ error: "Missing config" }, { status: 500 });
    }

    const resend = new Resend(resendKey);

    // Get yesterday's date range (UTC-6 for Mexico)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 6, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Fetch visits
    const res = await fetch(
      `${supabaseUrl}/rest/v1/expat_page_visits?created_at=gte.${startOfDay.toISOString()}&created_at=lt.${endOfDay.toISOString()}&order=created_at.asc`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
      }
    );

    const visits = await res.json();
    const totalVisits = visits.length;

    if (totalVisits === 0) {
      return NextResponse.json({ message: "No visits yesterday, no email sent" });
    }

    // Analyze visits
    const pages: Record<string, number> = {};
    const referrers: Record<string, number> = {};
    const langs: Record<string, number> = {};
    const hours: Record<number, number> = {};

    for (const v of visits) {
      const page = v.page || "/";
      pages[page] = (pages[page] || 0) + 1;

      const ref = v.referrer || "Direct";
      referrers[ref] = (referrers[ref] || 0) + 1;

      const lang = v.lang || "unknown";
      langs[lang] = (langs[lang] || 0) + 1;

      const hour = new Date(v.created_at).getHours();
      const cstHour = (hour - 6 + 24) % 24;
      hours[cstHour] = (hours[cstHour] || 0) + 1;
    }

    const sortedPages = Object.entries(pages).sort((a, b) => b[1] - a[1]);
    const sortedRefs = Object.entries(referrers).sort((a, b) => b[1] - a[1]);
    const sortedLangs = Object.entries(langs).sort((a, b) => b[1] - a[1]);
    const peakHour = Object.entries(hours).sort((a, b) => b[1] - a[1])[0];

    const dateStr = yesterday.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #f5f5f5; padding: 2rem; border-radius: 12px;">
        <h1 style="color: #D4A853; font-size: 1.5rem; margin-bottom: 0.5rem;">Expat Advisor MX — Reporte Diario</h1>
        <p style="opacity: 0.7; margin-bottom: 1.5rem;">${dateStr}</p>
        
        <div style="background: rgba(212,168,83,0.1); border: 1px solid rgba(212,168,83,0.3); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
          <h2 style="color: #D4A853; font-size: 2rem; margin: 0;">${totalVisits}</h2>
          <p style="margin: 0; opacity: 0.8;">visitas totales</p>
        </div>

        <h3 style="color: #D4A853; font-size: 1rem;">Páginas</h3>
        <ul style="list-style: none; padding: 0;">
          ${sortedPages.map(([p, c]) => `<li style="padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);"><span style="color: #D4A853;">${c}</span> — ${p}</li>`).join("")}
        </ul>

        <h3 style="color: #D4A853; font-size: 1rem;">Origen del tráfico</h3>
        <ul style="list-style: none; padding: 0;">
          ${sortedRefs.slice(0, 10).map(([r, c]) => `<li style="padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);"><span style="color: #D4A853;">${c}</span> — ${r}</li>`).join("")}
        </ul>

        <h3 style="color: #D4A853; font-size: 1rem;">Idioma</h3>
        <ul style="list-style: none; padding: 0;">
          ${sortedLangs.map(([l, c]) => `<li style="padding: 0.3rem 0;"><span style="color: #D4A853;">${c}</span> — ${l}</li>`).join("")}
        </ul>

        ${peakHour ? `<p style="margin-top: 1rem; opacity: 0.8;">Hora pico: <strong style="color: #D4A853;">${peakHour[0]}:00 hrs</strong> (${peakHour[1]} visitas)</p>` : ""}

        <hr style="border: 1px solid rgba(255,255,255,0.1); margin: 1.5rem 0;" />
        <p style="font-size: 0.8rem; opacity: 0.5;">Enviado via Duendes - ${new Date().getFullYear()}</p>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: "Expat Advisor MX <info@expatadvisormx.com>",
      to: [REPORT_EMAIL],
      subject: `[Expat Advisor] Reporte diario — ${totalVisits} visitas — ${dateStr}`,
      html: htmlContent,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, visits: totalVisits, sentTo: REPORT_EMAIL });
  } catch (error: any) {
    console.error("Daily report error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
