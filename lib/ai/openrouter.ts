import "server-only";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const MODEL = "anthropic/claude-sonnet-5";

/** The brief's ceiling. The route also declares a longer maxDuration so the
 *  platform never kills the request before we can return a Persian error. */
const TIMEOUT_MS = 30_000;

export type ChatContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type CompletionResult = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  latencyMs: number;
};

export class ModelError extends Error {
  constructor(
    message: string,
    readonly kind: "timeout" | "rate_limit" | "provider" | "malformed",
  ) {
    super(message);
  }
}

/**
 * One call to OpenRouter. Plain fetch rather than an SDK: it is a single JSON
 * POST, and owning the AbortController is what keeps the 30s budget honest.
 */
export async function complete({
  system,
  content,
  jsonSchema,
  maxTokens = 2000,
}: {
  system: string;
  content: ChatContent[];
  jsonSchema: unknown;
  maxTokens?: number;
}): Promise<CompletionResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new ModelError("OPENROUTER_API_KEY is not set", "provider");

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        // Extraction is short and latency-sensitive; depth buys nothing here.
        reasoning: { effort: "low" },
        // Schema enforcement differs between providers serving the same model,
        // so only route to ones that actually honour response_format.
        provider: { require_parameters: true },
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        response_format: { type: "json_schema", json_schema: jsonSchema },
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ModelError("model call timed out", "timeout");
    }
    throw new ModelError("model call failed", "provider");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    throw new ModelError("rate limited upstream", "rate_limit");
  }
  if (!response.ok) {
    throw new ModelError(`provider returned ${response.status}`, "provider");
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim() === "") {
    throw new ModelError("empty completion", "malformed");
  }

  return {
    content: text,
    inputTokens: payload?.usage?.prompt_tokens ?? 0,
    outputTokens: payload?.usage?.completion_tokens ?? 0,
    // OpenRouter reports cost in dollars; ai_usage_logs stores cents.
    costCents: Math.round((payload?.usage?.cost ?? 0) * 100 * 1000) / 1000,
    latencyMs: Date.now() - startedAt,
  };
}
