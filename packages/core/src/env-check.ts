import { z } from 'zod';

type Env = Record<string, string | undefined>;

export interface EnvCheckOptions {
  /** Every variable must be present (production and preview deploys). */
  strict: boolean;
}

/**
 * Validates an app's environment once at startup or build time.
 *
 * - A variable named in the server schema must never appear with a NEXT_PUBLIC_ prefix,
 *   because Next.js would ship it to every browser.
 * - In strict mode (Vercel production and preview) a missing variable fails the build.
 *   Locally, missing variables are allowed so the apps run before every account exists.
 */
export function checkEnv<S extends z.ZodRawShape, C extends z.ZodRawShape>(
  env: Env,
  schemas: { server: S; client: C },
  options: EnvCheckOptions,
): z.infer<z.ZodObject<S>> & z.infer<z.ZodObject<C>> {
  const leaked = Object.keys(schemas.server)
    .map((name) => `NEXT_PUBLIC_${name}`)
    .filter((name) => env[name] !== undefined);
  if (leaked.length > 0) {
    throw new Error(
      `Secret exposed to the browser: ${leaked.join(', ')}. Remove the NEXT_PUBLIC_ prefix.`,
    );
  }

  for (const name of Object.keys(schemas.client)) {
    if (!name.startsWith('NEXT_PUBLIC_')) {
      throw new Error(`Client variable ${name} must start with NEXT_PUBLIC_.`);
    }
  }

  const shape = { ...schemas.server, ...schemas.client };
  const schema = options.strict ? z.object(shape) : z.object(shape).partial();

  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    // Names only; values are never printed.
    throw new Error(`Invalid environment variables:\n${problems.join('\n')}`);
  }
  return result.data as z.infer<z.ZodObject<S>> & z.infer<z.ZodObject<C>>;
}

/** Strict on Vercel production/preview deploys, lenient everywhere else. */
export function isStrictEnv(env: Env): boolean {
  return env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview';
}
