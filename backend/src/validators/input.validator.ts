import { ErrorFactory } from "../utils/error.utils";

/**
 * Validate required fields
 */
export function validateRequired(
  data: any,
  fields: string[]
): void | never {
  const missing = fields.filter((field) => !data[field]);

  if (missing.length > 0) {
    throw ErrorFactory.badRequest(`Missing required fields: ${missing.join(", ")}`);
  }
}



