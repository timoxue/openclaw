import {
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  getChatChannelMeta,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
  setAccountEnabledInConfigSection,
  type ChannelPlugin,
  type IncomingMessage,
} from "openclaw/plugin-sdk";
import * as lark from "@larksuiteoapi/node-sdk";
import { getFeishuRuntime } from "./runtime.js";

// Import z from zod
import { z } from "zod";

const meta = getChatChannelMeta("feishu");

// Feishu account schema using Zod
const FeishuAccountSchema = z.object({
  enabled: z.boolean().optional(),
  name: z.string().optional(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  encryptKey: z.string().optional(),
  verificationToken: z.string().optional(),
  eventUrl: z.string().optional(),
});

// Full Feishu config schema
const FeishuConfigSchema = FeishuAccountSchema.extend({
  accounts: z.record(z.string(), FeishuAccountSchema.optional()).optional(),
});

/**
 * Resolved Feishu account configuration
 */
export interface ResolvedFeishuAccount {
  accountId: string;
  enabled: boolean;
  name?: string;
  appId?: string;
  appSecret?: string;
  encryptKey?: string;
  verificationToken?: string;
  eventUrl?: string;
  config: {
    [key: string]: any;
  };
}

/**
 * List Feishu account IDs from config
 */
function listFeishuAccountIds(cfg: any): string[] {
  const accounts = cfg.channels?.feishu?.accounts;
  if (!accounts) return [DEFAULT_ACCOUNT_ID];
  return Object.keys(accounts);
}

/**
 * Resolve Feishu account from config
 */
function resolveFeishuAccount({
  cfg,
  accountId,
}: {
  cfg: any;
  accountId?: string;
}): ResolvedFeishuAccount {
  const resolvedAccountId = normalizeAccountId(accountId);
  const accountConfig =
    resolvedAccountId === DEFAULT_ACCOUNT_ID
      ? cfg.channels?.feishu ?? {}
      : cfg.channels?.feishu?.accounts?.[resolvedAccountId] ?? {};

  return {
    accountId: resolvedAccountId,
    enabled: accountConfig.enabled ?? cfg.channels?.feishu?.enabled ?? false,
    name: accountConfig.name,
    appId: accountConfig.appId ?? cfg.channels?.feishu?.appId,
    appSecret: accountConfig.appSecret ?? cfg.channels?.feishu?.appSecret,
    encryptKey: accountConfig.encryptKey ?? cfg.channels?.feishu?.encryptKey,
    verificationToken:
      accountConfig.verificationToken ?? cfg.channels?.feishu?.verificationToken,
    eventUrl: accountConfig.eventUrl ?? cfg.channels?.feishu?.eventUrl,
    config: accountConfig.config ?? {},
  };
}

/**
 * Client manager cache
 */
let clientManager: any = null;

/**
 * Get or create client manager
 */
function getClientManager() {
  if (!clientManager) {
    const { FeishuClientManager } = require("./client.js");
    const runtime = getFeishuRuntime();
    clientManager = new FeishuClientManager(runtime.log);
  }
  return clientManager;
}

/**
 * Send message to Feishu
 */
async function sendMessageFeishu(
  target: string,
  text: string,
  opts: {
    accountId?: string;
    messageType?: "text" | "post";
  } = {}
): Promise<{ messageId: string; channelId: string }> {
  const runtime = getFeishuRuntime();
  const cfg = runtime.config.loadConfig();
  const account = resolveFeishuAccount({
    cfg,
    accountId: opts.accountId,
  });

  if (!account.appId || !account.appSecret) {
    throw new Error(`Feishu credentials missing for account "${account.accountId}"`);
  }

  const manager = getClientManager();
  const client = manager.getClient(account.accountId, {
    appId: account.appId,
    appSecret: account.appSecret,
  });

  // Determine receive_id_type based on target format
  const receiveIdType = target.startsWith("ou") ? "open_id" : "chat_id";

  // Send message
  const response = await client.im.message.create({
    params: {
      receive_id_type: receiveIdType,
    },
    data: {
      receive_id: target,
      msg_type: opts.messageType || "text",
      content: JSON.stringify({ text }),
    },
  });

  if (!response || !response.data) {
    throw new Error("Failed to send Feishu message");
  }

  return {
    messageId: response.data.message_id,
    channelId: target,
  };
}

/**
 * Monitor Feishu provider via WebSocket or Webhook
 */
async function monitorFeishuProvider(opts: {
  accountId: string;
  config: any;
  runtime: any;
  abortSignal?: AbortSignal;
}) {
  const runtime = getFeishuRuntime();
  const { accountId, config, abortSignal } = opts;
  const account = resolveFeishuAccount({ cfg: config, accountId });

  runtime.log?.info(`[feishu:${accountId}] Starting Feishu provider`);

  if (!account.appId || !account.appSecret) {
    throw new Error(`Feishu credentials missing for account "${accountId}"`);
  }

  // Create client
  const manager = getClientManager();
  const client = manager.getClient(account.accountId, {
    appId: account.appId,
    appSecret: account.appSecret,
  });

  // Check if we should use WebSocket mode (for development)
  // or Webhook mode (for production)
  const useWebSocket = !account.eventUrl;

  if (useWebSocket) {
    // Use WebSocket long connection mode
    runtime.log?.info(`[feishu:${accountId}] Using WebSocket long connection mode`);

    // Create event dispatcher for WebSocket
    const { createFeishuEventDispatcher } = require("./events.js");
    const eventDispatcher = createFeishuEventDispatcher({
      accountId,
      client,
      abortSignal,
    });

    // Create WebSocket client
    const wsClient = new lark.WSClient({
      appId: account.appId,
      appSecret: account.appSecret,
      loggerLevel: lark.LoggerLevel.info,
    });

    // Start WebSocket with event dispatcher parameter
    wsClient.start({ eventDispatcher });

    runtime.log?.info(`[feishu:${accountId}] WebSocket client started, connecting to Feishu...`);

    return async () => {
      runtime.log?.info(`[feishu:${accountId}] Stopping WebSocket client`);
      try {
        wsClient.stop();
      } catch (err) {
        runtime.log?.error(`[feishu:${accountId}] Error stopping WebSocket: ${err}`);
      }
    };
  } else {
    // Use Webhook mode with Express server
    runtime.log?.info(`[feishu:${accountId}] Using Webhook mode at ${account.eventUrl}`);

    const { createFeishuEventDispatcher, createFeishuWebhookMiddleware } =
      require("./events.js");
    const eventDispatcher = createFeishuEventDispatcher({
      accountId,
      client,
      abortSignal,
    });

    const middleware = createFeishuWebhookMiddleware(eventDispatcher);

    // Store middleware for later use by Express server
    runtime.feishuWebhookMiddleware = middleware;
    runtime.feishuWebhookPath = "/feishu/events";

    runtime.log?.info(`[feishu:${accountId}] Webhook middleware registered`);

    return async () => {
      runtime.log?.info(`[feishu:${accountId}] Stopping webhook handler`);
    };
  }
}

/**
 * Probe Feishu account to test credentials
 */
async function probeFeishu(opts: {
  accountId: string;
  config: any;
  timeoutMs?: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const account = resolveFeishuAccount({
      cfg: opts.config,
      accountId: opts.accountId,
    });

    if (!account.appId || !account.appSecret) {
      return { ok: false, error: "missing credentials" };
    }

    const manager = getClientManager();
    const client = manager.getClient(account.accountId, {
      appId: account.appId,
      appSecret: account.appSecret,
    });

    // Try to get user info to test credentials
    const response = await client.auth.v3.tenantAccessToken.internal({
      data: {
        app_id: account.appId,
        app_secret: account.appSecret,
      },
    });

    if (response && response.code === 0) {
      return { ok: true };
    } else {
      return { ok: false, error: response?.msg ?? "authentication failed" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Feishu channel plugin
 */
export const feishuPlugin: ChannelPlugin<ResolvedFeishuAccount> = {
  id: "feishu",
  meta: {
    ...meta,
    label: "飞书",
    selectionLabel: "飞书（Lark/Feishu）",
    detailLabel: "飞书机器人",
    docsPath: "/channels/feishu",
  },

  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: false,
    media: true,
    nativeCommands: false,
  },

  reload: { configPrefixes: ["channels.feishu"] },
  configSchema: buildChannelConfigSchema(FeishuConfigSchema),

  config: {
    listAccountIds: (cfg) => listFeishuAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveFeishuAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => {
      const ids = listFeishuAccountIds(cfg);
      if (ids.includes(DEFAULT_ACCOUNT_ID)) {
        return DEFAULT_ACCOUNT_ID;
      }
      return ids[0] ?? DEFAULT_ACCOUNT_ID;
    },
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg,
        sectionKey: "feishu",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg,
        sectionKey: "feishu",
        accountId,
        clearBaseFields: ["appId", "appSecret", "name"],
      }),
    isConfigured: (account) => Boolean(account.appId && account.appSecret),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.appId && account.appSecret),
    }),
  },

  security: {
    resolveDmPolicy: ({ account }) => {
      return {
        policy: "open", // Feishu bots typically accept DMs from anyone
        allowFrom: [],
        allowFromPath: "channels.feishu.dm.",
        approveHint: "Feishu bots accept messages from any user in the tenant",
        normalizeEntry: (raw) => raw.trim(),
      };
    },
    collectWarnings: () => {
      const warnings: string[] = [];
      // Feishu doesn't have the same "open group" concerns as Slack
      return warnings;
    },
  },

  outbound: {
    deliveryMode: "direct",
    chunker: null,
    textChunkLimit: 4096, // Feishu text message limit
    sendText: async ({ to, text, accountId, cfg }) => {
      const result = await sendMessageFeishu(to, text, { accountId });
      return { channel: "feishu", ...result };
    },
    sendMedia: async ({ to, text, mediaUrl, accountId, cfg }) => {
      // For now, we'll send text with media URL
      // TODO: Implement actual file upload to Feishu
      const message = mediaUrl ? `${text}\n\n${mediaUrl}` : text;
      const result = await sendMessageFeishu(to, message, { accountId });
      return { channel: "feishu", ...result };
    },
  },

  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async ({ account, timeoutMs }) => {
      return await probeFeishu({ accountId: account.accountId, config: { account }, timeoutMs });
    },
    buildAccountSnapshot: ({ account, runtime, probe }) => {
      const configured = Boolean(account.appId && account.appSecret);
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured,
        running: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
        lastStopAt: runtime?.lastStopAt ?? null,
        lastError: runtime?.lastError ?? null,
        probe,
        lastInboundAt: runtime?.lastInboundAt ?? null,
        lastOutboundAt: runtime?.lastOutboundAt ?? null,
      };
    },
  },

  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      ctx.log?.info(`[${account.accountId}] starting Feishu provider`);
      return monitorFeishuProvider({
        accountId: account.accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
      });
    },
  },

  setup: {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    applyAccountName: ({ cfg, accountId, name }) =>
      applyAccountNameToChannelSection({
        cfg,
        channelKey: "feishu",
        accountId,
        name,
      }),
    validateInput: ({ accountId, input }) => {
      if (input.useEnv && accountId !== DEFAULT_ACCOUNT_ID) {
        return "Feishu env credentials can only be used for the default account.";
      }
      if (!input.useEnv && (!input.appId || !input.appSecret)) {
        return "Feishu requires --app-id and --app-secret (or --use-env).";
      }
      return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
      const namedConfig = applyAccountNameToChannelSection({
        cfg,
        channelKey: "feishu",
        accountId,
        name: input.name,
      });
      const next =
        accountId !== DEFAULT_ACCOUNT_ID
          ? migrateBaseNameToDefaultAccount({
              cfg: namedConfig,
              channelKey: "feishu",
            })
          : namedConfig;
      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...next,
          channels: {
            ...next.channels,
            feishu: {
              ...next.channels?.feishu,
              enabled: true,
              ...(input.useEnv
                ? {}
                : {
                    ...(input.appId ? { appId: input.appId } : {}),
                    ...(input.appSecret ? { appSecret: input.appSecret } : {}),
                    ...(input.encryptKey ? { encryptKey: input.encryptKey } : {}),
                    ...(input.verificationToken
                      ? { verificationToken: input.verificationToken }
                      : {}),
                    ...(input.eventUrl ? { eventUrl: input.eventUrl } : {}),
                  }),
            },
          },
        };
      }
      return {
        ...next,
        channels: {
          ...next.channels,
          feishu: {
            ...next.channels?.feishu,
            enabled: true,
            accounts: {
              ...next.channels?.feishu?.accounts,
              [accountId]: {
                ...next.channels?.feishu?.accounts?.[accountId],
                enabled: true,
                ...(input.appId ? { appId: input.appId } : {}),
                ...(input.appSecret ? { appSecret: input.appSecret } : {}),
                ...(input.encryptKey ? { encryptKey: input.encryptKey } : {}),
                ...(input.verificationToken
                  ? { verificationToken: input.verificationToken }
                  : {}),
                ...(input.eventUrl ? { eventUrl: input.eventUrl } : {}),
              },
            },
          },
        },
      };
    },
  },
};

// Export runtime functions for internal use
export { sendMessageFeishu, monitorFeishuProvider, probeFeishu };
