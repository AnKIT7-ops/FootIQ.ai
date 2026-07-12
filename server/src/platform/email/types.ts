/**
 * Email abstraction. No paid provider is wired yet — ConsoleEmailProvider
 * logs sends in dev, and a Resend/Postmark/SES adapter later implements this
 * same interface without touching call sites.
 */

export type EmailTemplate =
  | { kind: "welcome"; name: string | null }
  | { kind: "newsletter_confirm"; confirmUrl: string }
  | { kind: "password_reset"; resetUrl: string }
  | { kind: "magic_link"; linkUrl: string }
  | { kind: "notification"; title: string; body: string };

export interface EmailMessage {
  to: string;
  template: EmailTemplate;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ delivered: boolean; providerId?: string }>;
}
