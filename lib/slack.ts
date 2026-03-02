/**
 * Slack webhook helper — sends rich alert messages to a Slack channel.
 * Set SLACK_WEBHOOK_URL in .env.local to enable.
 */

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: { type: string; text: string }[];
  fields?: { type: string; text: string }[];
}

export interface SlackAlertPayload {
  title: string;
  severity: "critical" | "warning" | "info";
  summary: string;
  fields?: { label: string; value: string }[];
  footer?: string;
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  warning: "🟡",
  info: "🔵",
};

export async function sendSlackAlert(payload: SlackAlertPayload): Promise<{ sent: boolean; error?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log("[Slack] No SLACK_WEBHOOK_URL set — skipping notification");
    return { sent: false, error: "SLACK_WEBHOOK_URL not configured" };
  }

  const emoji = SEVERITY_EMOJI[payload.severity] || "ℹ️";
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${emoji} ${payload.title}`, emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: payload.summary },
    },
  ];

  if (payload.fields && payload.fields.length > 0) {
    blocks.push({
      type: "section",
      fields: payload.fields.map((f) => ({
        type: "mrkdwn",
        text: `*${f.label}:*\n${f.value}`,
      })),
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: payload.footer || `FleetMind Sentinel • ${new Date().toLocaleString()}`,
      },
    ],
  });

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Slack] Webhook failed:", res.status, text);
      return { sent: false, error: `HTTP ${res.status}: ${text}` };
    }

    console.log("[Slack] Alert sent successfully");
    return { sent: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Slack] Webhook error:", message);
    return { sent: false, error: message };
  }
}
