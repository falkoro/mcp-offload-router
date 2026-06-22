import { z } from "zod";

const envBoolean = z
  .union([z.boolean(), z.string()])
  .transform((v) => {
    if (typeof v === "boolean") return v;
    return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  });

const providerConfigSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  rpm: z.coerce.number().int().positive(),
  tpm: z.coerce.number().int().positive(),
  dailyTokens: z.coerce.number().int().positive(),
  cooldownSeconds: z.coerce.number().int().positive(),
});

const configSchema = z.object({
  transport: z.enum(["stdio", "sse"]).default("stdio"),
  port: z.coerce.number().int().positive().max(65535).default(3000),
  defaultProvider: z.enum(["auto", "minimax", "syntheticnew", "zai"]).default("auto"),
  persistUsage: envBoolean.default(false),
  minimax: providerConfigSchema,
  syntheticnew: providerConfigSchema,
  zai: providerConfigSchema,
});

export type Config = z.infer<typeof configSchema>;
export type ProviderName = "minimax" | "syntheticnew" | "zai";
export const PROVIDER_NAMES: ProviderName[] = ["minimax", "syntheticnew", "zai"];

export function loadConfig(): Config {
  const raw = {
    transport: process.env.TRANSPORT,
    port: process.env.PORT,
    defaultProvider: process.env.DEFAULT_PROVIDER,
    persistUsage: process.env.PERSIST_USAGE,
    minimax: {
      apiKey: process.env.MINIMAX_API_KEY,
      baseUrl: process.env.MINIMAX_BASE_URL,
      model: process.env.MINIMAX_MODEL,
      rpm: process.env.MINIMAX_RPM,
      tpm: process.env.MINIMAX_TPM,
      dailyTokens: process.env.MINIMAX_DAILY_TOKENS,
      cooldownSeconds: process.env.MINIMAX_COOLDOWN_SECONDS,
    },
    syntheticnew: {
      apiKey: process.env.SYNTHETICNEW_API_KEY,
      baseUrl: process.env.SYNTHETICNEW_BASE_URL,
      model: process.env.SYNTHETICNEW_MODEL,
      rpm: process.env.SYNTHETICNEW_RPM,
      tpm: process.env.SYNTHETICNEW_TPM,
      dailyTokens: process.env.SYNTHETICNEW_DAILY_TOKENS,
      cooldownSeconds: process.env.SYNTHETICNEW_COOLDOWN_SECONDS,
    },
    zai: {
      apiKey: process.env.ZAI_API_KEY ?? process.env.GLM_API_KEY,
      baseUrl: process.env.ZAI_BASE_URL,
      model: process.env.ZAI_MODEL,
      rpm: process.env.ZAI_RPM,
      tpm: process.env.ZAI_TPM,
      dailyTokens: process.env.ZAI_DAILY_TOKENS,
      cooldownSeconds: process.env.ZAI_COOLDOWN_SECONDS,
    },
  };

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${issues}`);
  }
  return result.data;
}
