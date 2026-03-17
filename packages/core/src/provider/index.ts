import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

export interface ProviderConfig {
  provider: "anthropic" | "openai" | "openai-compatible" | "qwen";
  model: string;
  apiKey?: string;
  baseURL?: string;
}

const DEFAULT_CONFIG: ProviderConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
};

export function resolveProvider(
  config?: Partial<ProviderConfig>
): LanguageModelV1 {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  switch (cfg.provider) {
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: cfg.apiKey || process.env.ANTHROPIC_API_KEY,
      });
      return anthropic(cfg.model);
    }
    case "openai": {
      const openai = createOpenAI({
        apiKey: cfg.apiKey || process.env.OPENAI_API_KEY,
      });
      return openai(cfg.model);
    }
    case "openai-compatible":
    case "qwen": {
      const openai = createOpenAI({
        apiKey: cfg.apiKey || process.env.NEXAGENT_API_KEY || "",
        baseURL: cfg.baseURL,
      });
      return openai(cfg.model);
    }
    default:
      throw new Error(`Unknown provider: ${cfg.provider}`);
  }
}
