import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getUsageSummary, resetUsage } from "./accounting.js";
import { callChatCompletion } from "./chat.js";
import { envFlag } from "./env.js";
import { allProviders, providerSetupStatus } from "./providers.js";
import { maxPromptChars } from "./safety.js";
import { PACKAGE_VERSION } from "./version.js";

export const SERVER_NAME = "cheap-llm-mcp";
export const SERVER_VERSION = PACKAGE_VERSION;

const taskTypeSchema = z
  .enum([
    "general",
    "summarize",
    "rewrite",
    "translate",
    "classify",
    "extract",
    "code_snippet",
    "code_review",
    "reasoning",
    "design_critique",
    "test_suggestions"
  ])
  .optional();

export function createServer(source: NodeJS.ProcessEnv = process.env): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
  });

  server.registerTool(
    "list_simple_model_providers",
    {
      title: "List configured simple LLM providers",
      description: "Show configured low-cost OpenAI-compatible model providers without exposing API keys.",
      inputSchema: {}
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(providerSetupStatus(source), null, 2)
        }
      ]
    })
  );

  server.registerTool(
    "ask_simple_model",
    {
      title: "Ask a delegated OpenAI-compatible LLM",
      description:
        "Delegate bounded work to a configured OpenAI-compatible model. Use for summarizing, rewriting, translating, classification, extraction, small code drafts, code review drafts, reasoning, design critique, and test suggestions. Treat every result as a draft: the host AI must verify it against the original task and remains responsible for final decisions, tool use, and file edits. Do not send secrets or sensitive data. Private workspace context may be sent only when the user explicitly approves external API use and the prompt passes the safety checks.",
      inputSchema: {
        prompt: z.string().min(1).describe("The exact self-contained task to send to the provider."),
        provider: z.string().optional().describe("Provider name, for example deepseek, qwen, or mimo."),
        model: z.string().optional().describe("Override the provider default model."),
        taskType: taskTypeSchema.describe("Optional delegation category so the provider gets task-specific guidance."),
        system: z.string().optional().describe("Optional system instruction."),
        approvedForExternalApi: z
          .boolean()
          .optional()
          .describe("Must be true only after confirming the prompt is safe to send to the third-party model API."),
        dataClassification: z
          .enum(["public", "internal", "private", "sensitive"])
          .optional()
          .describe("Classification of the prompt content. sensitive content is always rejected."),
        temperature: z.number().min(0).max(2).optional().describe("Sampling temperature. Defaults to 0.2."),
        maxTokens: z.number().int().positive().max(131072).optional().describe("Optional output token cap. Omitted by default."),
        responseFormat: z.enum(["text", "json_object"]).optional().describe("Request text or JSON object output."),
        includeUsage: z.boolean().optional().describe("Append provider usage metadata when available."),
        requestTimeoutMs: z.number().int().positive().max(300000).optional().describe("Abort the provider request after this many milliseconds."),
        extraBody: z.record(z.unknown()).optional().describe("Provider-specific JSON body overrides.")
      }
    },
    async (input) => ({
      content: [
        {
          type: "text",
          text: await callChatCompletion(input, source)
        }
      ]
    })
  );

  server.registerTool(
    "get_token_savings",
    {
      title: "Get cheap LLM token savings",
      description:
        "Show how many provider-reported tokens have been routed to cheap models in this MCP server session. Treat this as actual cheap-model token usage plus a rough premium-token volume avoided estimate.",
      inputSchema: {
        reset: z.boolean().optional().describe("Reset in-memory counters after returning the current summary.")
      }
    },
    async (input) => {
      const summary = getUsageSummary();
      if (input.reset) {
        resetUsage();
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(summary, null, 2)
          }
        ]
      };
    }
  );

  server.registerTool(
    "check_simple_model_setup",
    {
      title: "Check cheap LLM MCP setup",
      description:
        "Validate local provider configuration without making a model request. Shows missing API keys, endpoint URLs, HTTPS status, and safety limits.",
      inputSchema: {}
    },
    async () => {
      const providers = providerSetupStatus(source);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: providers.some((provider) => provider.hasApiKey && provider.https),
                safety: {
                  maxPromptChars: maxPromptChars(source),
                  sensitiveDataRejected: true,
                  secretPatternScan: true,
                  requiresApprovedForExternalApi: true,
                  chineseDefault: envFlag("SIMPLE_LLM_CHINESE_DEFAULT", true, source),
                  stabilityDefault: envFlag("SIMPLE_LLM_STABILITY_DEFAULT", true, source),
                  hostReviewRequired: true,
                  allowHttp: envFlag("SIMPLE_LLM_ALLOW_HTTP", false, source)
                },
                providers
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  return server;
}

export async function startStdioServer(source: NodeJS.ProcessEnv = process.env): Promise<void> {
  allProviders(source);
  const server = createServer(source);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
