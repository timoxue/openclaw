import * as lark from "@larksuiteoapi/node-sdk";
import type { Logger } from "openclaw/plugin-sdk";

/**
 * Feishu client wrapper with caching and error handling
 */
export class FeishuClientManager {
  private clients: Map<string, lark.Client> = new Map();
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Get or create a Feishu client for the given account
   */
  getClient(accountId: string, config: FeishuAccountConfig): lark.Client {
    if (this.clients.has(accountId)) {
      return this.clients.get(accountId)!;
    }

    this.logger?.debug(`[feishu:${accountId}] Creating new Lark client`);

    const client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
      loggerLevel: lark.LoggerLevel.info,
    });

    this.clients.set(accountId, client);
    return client;
  }

  /**
   * Remove a client from cache
   */
  removeClient(accountId: string): void {
    this.clients.delete(accountId);
  }

  /**
   * Clear all clients
   */
  clear(): void {
    this.clients.clear();
  }
}

/**
 * Feishu account configuration
 */
export interface FeishuAccountConfig {
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
  eventUrl?: string;
}

/**
 * Message content types
 */
export type FeishuMessageType = "text" | "post" | "interactive" | "image" | "file";

/**
 * Send result
 */
export interface FeishuSendResult {
  messageId: string;
  channelId: string;
}

/**
 * Extract text from Feishu message content
 */
export function extractTextFromMessage(message: {
  message_type: string;
  content: string;
}): string | null {
  const { message_type, content } = message;

  try {
    const parsed = JSON.parse(content);

    switch (message_type) {
      case "text":
        return parsed.text || "";

      case "post":
        // Extract text from rich text post
        if (parsed.post && parsed.post.content) {
          return parsed.post.content
            .map((section: any[]) =>
              section
                .map((segment) => segment.text || "")
                .filter(Boolean)
                .join("")
            )
            .filter(Boolean)
            .join("\n");
        }
        return null;

      case "image":
        return "[图片]";

      case "file":
        return parsed.file_name ? `[文件] ${parsed.file_name}` : "[文件]";

      case "audio":
        return "[音频]";

      case "video":
        return "[视频]";

      case "interactive":
        return "[卡片消息]";

      default:
        return null;
    }
  } catch (err) {
    return null;
  }
}

/**
 * Build text message content
 */
export function buildTextContent(text: string): string {
  return JSON.stringify({ text });
}

/**
 * Build rich text (post) message content
 */
export function buildPostContent(text: string): string {
  return JSON.stringify({
    post: {
      zh_cn: {
        title: "",
        content: [
          [
            {
              tag: "text",
              text: text,
            },
          ],
        ],
      },
    },
  });
}

/**
 * Build card message content
 */
export function buildCardContent(
  title: string,
  content: string
): string {
  return JSON.stringify({
    config: {
      wide_screen_mode: true,
    },
    header: {
      title: {
        content: title,
        tag: "plain_text",
      },
    },
    elements: [
      {
        tag: "markdown",
        content: content,
      },
    ],
  });
}
