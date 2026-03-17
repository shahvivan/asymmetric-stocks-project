import { EmailAlert, Settings, EnrichedStock } from "./types";

const EMAIL_COOLDOWN = 4 * 60 * 60 * 1000; // 4 hours per ticker
const sentAlerts: Record<string, number> = {};

export function canSendAlert(ticker: string, type: string): boolean {
  const key = `${ticker}-${type}`;
  const lastSent = sentAlerts[key];
  if (lastSent && Date.now() - lastSent < EMAIL_COOLDOWN) return false;
  return true;
}

function markSent(ticker: string, type: string): void {
  sentAlerts[`${ticker}-${type}`] = Date.now();
}

export async function sendEmailAlert(
  alert: EmailAlert,
  settings: Settings
): Promise<boolean> {
  if (!settings.emailAddress || !settings.emailjsPublicKey || !settings.emailjsServiceId || !settings.emailjsTemplateId) {
    return false;
  }

  if (!canSendAlert(alert.ticker, alert.type)) return false;

  try {
    const { default: emailjs } = await import("@emailjs/browser");
    await emailjs.send(
      settings.emailjsServiceId,
      settings.emailjsTemplateId,
      {
        to_email: settings.emailAddress,
        subject: alert.subject,
        message: alert.body,
      },
      settings.emailjsPublicKey
    );
    markSent(alert.ticker, alert.type);
    return true;
  } catch (err) {
    console.error("Email send failed:", err);
    return false;
  }
}

export function buildExitNowAlert(ticker: string, price: number, reasons: string[]): EmailAlert {
  return {
    type: "EXIT_NOW",
    ticker,
    subject: `EXIT NOW: ${ticker}`,
    body: `URGENT: Exit ${ticker} at $${price.toFixed(2)}\n\nReasons:\n${reasons.map((r) => `• ${r}`).join("\n")}`,
    timestamp: Date.now(),
  };
}

export function buildSwitchAlert(from: string, to: string, toScore: number): EmailAlert {
  return {
    type: "SWITCH",
    ticker: from,
    subject: `SWITCH: ${from} → ${to}`,
    body: `Consider switching from ${from} to ${to} (Score: ${toScore})\n\nThe new opportunity has significantly higher asymmetric potential.`,
    timestamp: Date.now(),
  };
}

export function buildStrongBuyAlert(stock: EnrichedStock): EmailAlert {
  return {
    type: "STRONG_BUY",
    ticker: stock.ticker,
    subject: `STRONG BUY: ${stock.ticker} (Score ${stock.asymmetryScore})`,
    body: `${stock.ticker} — ${stock.name}\nScore: ${stock.asymmetryScore}\nPrice: $${stock.price.toFixed(2)}\nRSI: ${stock.rsi?.toFixed(1) ?? "N/A"}\n\nThis stock meets all asymmetric criteria.`,
    timestamp: Date.now(),
  };
}
