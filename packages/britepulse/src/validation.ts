import { z } from 'zod';
export const schemaVersion = z.literal(1, {
  error: 'Unsupported schemaVersion; expected version 1',
});
export const httpUrl = z.url({ protocol: /^https?$/ });
export const nonempty = z.string().trim().min(1);
export const relativeArtifactPath = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.includes('\\') &&
      !value.includes('\0') &&
      !value.startsWith('/') &&
      !/^[a-zA-Z]:/.test(value) &&
      value.split('/').every((part) => part !== '..' && part !== '.' && part !== ''),
    'Expected a relative artifact path without traversal',
  );
export function parseValidated<T>(schema: z.ZodType<T>, input: unknown, label: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `${label}: ${result.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`).join('; ')}`,
    );
  }
  return result.data;
}
