import { zValidator } from "@hono/zod-validator";
import type { ZodSchema } from "zod";
import { ApiError } from "../lib/errors";

type Target = "json" | "query" | "param";

/**
 * zod validation wrapped so failures surface as our 422 envelope (via the
 * global error handler) instead of @hono/zod-validator's default 400 body.
 * Field errors are grouped per path for form-level display.
 */
export function validate<T extends ZodSchema>(target: Target, schema: T) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      const details: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".") || "_";
        (details[path] ??= []).push(issue.message);
      }
      throw new ApiError("validation_failed", "Request validation failed.", { details });
    }
  });
}
