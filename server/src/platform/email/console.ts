import type { Logger } from "../../lib/logger";
import type { EmailMessage, EmailProvider } from "./types";
import { renderTemplate } from "./templates";

/** Dev/beta provider: renders and logs instead of sending. Free by definition. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  constructor(private logger: Logger) {}

  async send(message: EmailMessage): Promise<{ delivered: boolean }> {
    const { subject } = renderTemplate(message.template);
    // never log message bodies — they can contain reset/magic links
    this.logger.info("email.send", { provider: this.name, to: mask(message.to), subject });
    return { delivered: true };
  }
}

function mask(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}
