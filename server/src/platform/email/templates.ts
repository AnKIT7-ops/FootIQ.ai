import type { EmailTemplate } from "./types";

/**
 * Template rendering lives apart from delivery so switching providers never
 * rewrites copy, and copy edits never touch transport code. Plain text now;
 * HTML variants slot in beside `text` when a real provider lands.
 */
export function renderTemplate(t: EmailTemplate): { subject: string; text: string } {
  switch (t.kind) {
    case "welcome":
      return {
        subject: "Welcome to FootIQ",
        text: `Hi ${t.name ?? "there"},\n\nWelcome to FootIQ — the AI intelligence layer for football.\nYour scouting desk is ready: https://footiq.ai\n\n— FootIQ`,
      };
    case "newsletter_confirm":
      return {
        subject: "Confirm your FootIQ newsletter subscription",
        text: `Confirm your subscription: ${t.confirmUrl}\n\nIf you didn't request this, ignore this email.`,
      };
    case "password_reset":
      return {
        subject: "Reset your FootIQ password",
        text: `Reset your password: ${t.resetUrl}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.`,
      };
    case "magic_link":
      return {
        subject: "Your FootIQ sign-in link",
        text: `Sign in: ${t.linkUrl}\n\nThis link expires in 10 minutes.`,
      };
    case "notification":
      return { subject: t.title, text: t.body };
  }
}
