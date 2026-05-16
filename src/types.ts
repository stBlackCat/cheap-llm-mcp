export type DataClassification = "public" | "internal" | "private" | "sensitive";

export type ProviderConfig = {
  name: string;
  baseUrl: string;
  chatPath?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  model: string;
  headers?: Record<string, string>;
  defaultBody?: Record<string, unknown>;
  timeoutMs?: number;
};

export type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
};

export type ChatMessage = {
  role: "system" | "user";
  content: string;
};

export type AskSimpleModelInput = {
  provider?: string;
  model?: string;
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
  includeUsage?: boolean;
  extraBody?: Record<string, unknown>;
  requestTimeoutMs?: number;
  approvedForExternalApi?: boolean;
  dataClassification?: DataClassification;
};
