import * as lark from "@larksuiteoapi/node-sdk";
import type { IncomingMessage } from "openclaw/plugin-sdk";
import { extractTextFromMessage } from "./client.js";
import { getFeishuRuntime } from "./runtime.js";

/**
 * Event handler options
 */
export interface FeishuEventHandlerOpts {
  accountId: string;
  client: lark.Client;
  abortSignal?: AbortSignal;
}

/**
 * Create Feishu event dispatcher
 */
export function createFeishuEventDispatcher(
  opts: FeishuEventHandlerOpts
): lark.EventDispatcher {
  const runtime = getFeishuRuntime();

  const dispatcher = new lark.EventDispatcher({
    encryptKey: undefined, // Will be set from account config
    loggerLevel: lark.LoggerLevel.info,
  });

  // Register event handler with debug logging
  dispatcher.register({
    "im.message.receive_v1": async (data: any) => {
      console.log(`[feishu:${opts.accountId}] 📨 Received event: im.message.receive_v1`);
      console.log(`[feishu:${opts.accountId}] Event data:`, JSON.stringify(data, null, 2));
      runtime.log?.info(`[feishu:${opts.accountId}] 📨 Received event: im.message.receive_v1`);
      runtime.log?.info(`[feishu:${opts.accountId}] Event data:`, JSON.stringify(data, null, 2));
      await handleMessageReceive(data, opts);
    },
  });

  console.log(`[feishu:${opts.accountId}] ✅ Event dispatcher created and registered for im.message.receive_v1`);
  runtime.log?.info(`[feishu:${opts.accountId}] Event dispatcher created and registered`);

  return dispatcher;
}

/**
 * Handle message receive event
 */
async function handleMessageReceive(
  data: any,
  opts: FeishuEventHandlerOpts
): Promise<void> {
  const runtime = getFeishuRuntime();
  const { accountId } = opts;

  console.log(`[feishu:${accountId}] 🔔 handleMessageReceive called`);
  runtime.log?.info(`[feishu:${accountId}] 🔔 handleMessageReceive called`);

  const {
    sender,
    message,
    tenant_key,
  } = data;

  // Extract chat_id from message object (not from top level)
  const chat_id = message.chat_id;

  console.log(`[feishu:${accountId}] 👤 Sender:`, JSON.stringify(sender));
  console.log(`[feishu:${accountId}] 💬 Message:`, JSON.stringify(message));
  console.log(`[feishu:${accountId}] 📋 Chat ID: ${chat_id}`);
  runtime.log?.info(`[feishu:${accountId}] 👤 Sender:`, JSON.stringify(sender));
  runtime.log?.info(`[feishu:${accountId}] 💬 Message:`, JSON.stringify(message));
  runtime.log?.info(`[feishu:${accountId}] 📋 Chat ID: ${chat_id}`);

  // Extract user information
  const openId = sender.sender_id.open_id;
  const userId = sender.sender_id.user_id;
  const userName = sender.sender_id.name || openId;

  // Extract message content
  const text = extractTextFromMessage(message);
  console.log(`[feishu:${accountId}] 📝 Extracted text: "${text}"`);
  runtime.log?.info(`[feishu:${accountId}] 📝 Extracted text: "${text}"`);

  if (!text) {
    runtime.log?.debug(`[feishu:${accountId}] Skipping non-text message`);
    return;
  }

  // Determine chat type based on message.chat_type or chat_id comparison
  const chatType = message.chat_type === "p2p" || chat_id === openId
    ? ("direct" as const)
    : ("group" as const);
  console.log(`[feishu:${accountId}] 💬 Chat type: ${chatType}`);
  runtime.log?.info(`[feishu:${accountId}] 💬 Chat type: ${chatType}`);

  // Build incoming message
  const incomingMessage: IncomingMessage = {
    accountId,
    channelId: chat_id,
    chatType,
    userId: openId,
    userName: userName,
    text: text,
    messageId: message.message_id,
    timestamp: String(message.create_time || Date.now()),
    media: null,
  };

  console.log(`[feishu:${accountId}] 📤 Sending to OpenClaw runtime`);
  runtime.log?.info(`[feishu:${accountId}] 📤 Sending to OpenClaw runtime`);

  // Send to OpenClaw runtime
  await runtime.messages?.incoming(incomingMessage);

  console.log(`[feishu:${accountId}] ✅ Message processed`);
  runtime.log?.info(`[feishu:${accountId}] ✅ Message processed`);
}

/**
 * Options for webhook adapter
 */
export interface FeishuWebhookAdapterOpts {
  path?: string;
  autoChallenge?: boolean;
}

/**
 * Create Express middleware for Feishu events
 */
export function createFeishuWebhookMiddleware(
  eventDispatcher: lark.EventDispatcher,
  opts: FeishuWebhookAdapterOpts = {}
): any {
  const { path = "/feishu/events", autoChallenge = true } = opts;

  return lark.adaptExpress(eventDispatcher, { autoChallenge });
}
