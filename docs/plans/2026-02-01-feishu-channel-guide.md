# 飞书通道开发指南

**目标：** 为 OpenClaw 添加飞书（Lark/Feishu）IM 支持

## 一、OpenClaw 通道架构概述

### 1.1 核心文件结构

每个通道扩展只需要两个主要文件：

```
extensions/feishu/
├── src/
│   ├── channel.ts      # 通道插件配置和接口实现
│   ├── runtime.ts      # 运行时注入点
│   └── index.ts        # 扩展入口
├── package.json
└── tsconfig.json
```

### 1.2 通道插件接口

根据现有实现（Slack/Discord/Telegram），一个通道插件需要实现：

```typescript
interface ChannelPlugin<TAccount> {
  // 基础信息
  id: string;                    // "feishu"
  meta: ChannelMeta;
  onboarding: OnboardingAdapter;

  // 配置管理
  configSchema: ConfigSchema;
  config: {
    listAccountIds: (cfg) => string[];
    resolveAccount: (cfg, accountId) => TAccount;
    defaultAccountId: (cfg) => string;
    setAccountEnabled: (opts) => void;
    deleteAccount: (opts) => void;
    isConfigured: (account) => boolean;
    describeAccount: (account) => AccountInfo;
  };

  // 安全策略
  security: {
    resolveDmPolicy: (opts) => DmPolicy;
    collectWarnings: (opts) => string[];
  };

  // 能力声明
  capabilities: {
    chatTypes: ("direct" | "group" | "channel" | "thread")[];
    reactions?: boolean;
    threads?: boolean;
    media?: boolean;
    nativeCommands?: boolean;
  };

  // 消息发送
  outbound: {
    sendText: (opts) => Promise<SendResult>;
    sendMedia?: (opts) => Promise<SendResult>;
  };

  // Gateway 启动
  gateway: {
    startAccount: (ctx) => Promise<void>;
  };

  // 状态监控
  status: {
    probeAccount: (opts) => Promise<ProbeResult>;
    buildAccountSnapshot: (opts) => AccountSnapshot;
  };
}
```

## 二、飞书通道核心实现

### 2.1 channel.ts 核心结构

```typescript
import {
  buildChannelConfigSchema,
  getChatChannelMeta,
  setAccountEnabledInConfigSection,
  deleteAccountFromConfigSection,
  type ChannelPlugin,
} from "openclaw/plugin-sdk";

const meta = getChatChannelMeta("feishu");

export const feishuPlugin: ChannelPlugin<ResolvedFeishuAccount> = {
  id: "feishu",
  meta: {
    ...meta,
    label: "飞书",
    selectionLabel: "飞书（Lark/Feishu）",
    detailLabel: "飞书机器人",
    docsPath: "/channels/feishu",
  },

  // 1. 配置 Schema
  configSchema: buildChannelConfigSchema(FeishuConfigSchema),

  // 2. 账号配置
  config: {
    listAccountIds: (cfg) => listFeishuAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveFeishuAccount({ cfg, accountId }),
    isConfigured: (account) => Boolean(account.appId && account.appSecret),
    // ... 其他配置方法
  },

  // 3. 能力声明
  capabilities: {
    chatTypes: ["direct", "group"],  // 飞书支持私聊和群聊
    reactions: false,                // 飞书暂不支持表情回复
    threads: false,                  // 飞书暂不支持话题线程
    media: true,                     // 支持图片/文件
    nativeCommands: false,           // 飞书使用卡片而非斜杠命令
  },

  // 4. 消息发送
  outbound: {
    sendText: async ({ to, text, accountId }) => {
      return await getFeishuRuntime().channel.feishu.sendMessageFeishu(
        to,
        text,
        { accountId }
      );
    },
    sendMedia: async ({ to, text, mediaUrl, accountId }) => {
      // 支持发送图片/文件卡片
    },
  },

  // 5. Gateway 启动（事件监听）
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      ctx.log?.info(`[${account.accountId}] starting Feishu provider`);
      return getFeishuRuntime().channel.feishu.monitorFeishuProvider({
        appId: account.appId,
        appSecret: account.appSecret,
        encryptKey: account.encryptKey,
        verificationToken: account.verificationToken,
        accountId: account.accountId,
        config: ctx.cfg,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
      });
    },
  },

  // 6. 状态探测
  status: {
    probeAccount: async ({ account }) => {
      // 调用飞书 API 测试凭证是否有效
      return await getFeishuRuntime().channel.feishu.probeFeishu({
        appId: account.appId,
        appSecret: account.appSecret,
      });
    },
  },
};
```

### 2.2 飞书配置 Schema

```typescript
export const FeishuConfigSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    enabled: { type: "boolean" },
    appId: { type: "string", title: "App ID" },
    appSecret: { type: "string", title: "App Secret" },
    encryptKey: { type: "string", title: "Encrypt Key" },
    verificationToken: { type: "string", title: "Verification Token" },
    eventUrl: { type: "string", title: "Event Callback URL" },
  },
};
```

## 三、飞书事件监听核心

### 3.1 事件接收 Endpoint

```typescript
// src/feishu/monitor.ts
export async function monitorFeishuProvider(opts: {
  appId: string;
  appSecret: string;
  encryptKey: string;
  verificationToken: string;
  accountId: string;
  runtime: RuntimeEnv;
  abortSignal: AbortSignal;
}) {
  const { runtime, accountId } = opts;

  // 1. 启动 HTTP 服务器接收飞书事件
  const server = express();
  server.use(express.json());

  // 2. 飞书事件验证
  server.post("/feishu/events", async (req, res) => {
    const event = req.body;

    // URL 验证（首次配置时）
    if (event.type === "url_verification") {
      const { challenge } = event;
      return res.json({ challenge });
    }

    // 验证 token
    if (event.token !== opts.verificationToken) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // 3. 异步处理事件（立即返回避免超时）
    setImmediate(() => handleFeishuEvent(event, opts));

    res.json({ code: 0 });
  });

  // 4. 启动服务器
  const port = await startServer(server, opts.abortSignal);

  runtime.log?.info(`[feishu:${accountId}] Webhook server listening on port ${port}`);

  return async () => {
    await stopServer(server);
  };
}
```

### 3.2 事件处理逻辑

```typescript
async function handleFeishuEvent(event: any, opts: MonitorFeishuOpts) {
  const { runtime, accountId } = opts;

  // 只处理消息事件
  if (event.type !== "im.message.receive_v1") {
    return;
  }

  const { sender, message, chat_id } = event.event;

  // 1. 提取飞书用户 ID
  const feishuUserId = sender.sender_id.user_id;
  const openId = sender.sender_id.open_id;

  // 2. 获取消息内容
  const messageContent = await extractFeishuMessageContent(message, opts);

  if (!messageContent) {
    return;
  }

  // 3. 构造 OpenClaw 标准消息格式
  const incomingMessage = {
    accountId,
    channelId: chat_id,          // 群聊 ID 或私聊会话 ID
    chatType: chat_id === openId ? "direct" : "group",
    userId: openId,              // 飞书 open_id
    userName: sender.sender_id.name,
    text: messageContent.text,
    messageId: message.message_id,
    timestamp: message.create_time,
    media: messageContent.media,
  };

  // 4. 发送到 OpenClaw 处理
  await runtime.messages?.incoming(incomingMessage);
}
```

### 3.3 消息内容提取

```typescript
async function extractFeishuMessageContent(message: any, opts: MonitorFeishuOpts) {
  const msgType = message.message_type;

  // 文本消息
  if (msgType === "text") {
    const content = JSON.parse(message.content);
    return {
      text: content.text,
      media: null,
    };
  }

  // 图片消息
  if (msgType === "image") {
    const content = JSON.parse(message.content);
    const imageKey = content.image_key;

    // 下载图片并转为本地 URL
    const mediaUrl = await downloadFeishuImage(imageKey, opts);

    return {
      text: "[图片]",
      media: { type: "image", url: mediaUrl },
    };
  }

  // 文件消息
  if (msgType === "file") {
    const content = JSON.parse(message.content);
    const fileKey = content.file_key;

    const mediaUrl = await downloadFeishuFile(fileKey, opts);

    return {
      text: `[文件] ${content.file_name}`,
      media: { type: "file", url: mediaUrl, name: content.file_name },
    };
  }

  // 富文本消息
  if (msgType === "post") {
    const content = JSON.parse(message.content);
    const text = extractTextFromFeishuPost(content);
    return { text, media: null };
  }

  // 卡片消息（暂不处理）
  if (msgType === "interactive") {
    return {
      text: "[卡片消息暂不支持]",
      media: null,
    };
  }

  return null;
}

// 提取富文本内容
function extractTextFromFeishuPost(post: any): string {
  return post.post.content
    .map((section: any) =>
      section.map((segment: any) => segment.text || "").join("")
    )
    .join("\n");
}
```

## 四、飞书消息发送

### 4.1 发送文本消息

```typescript
// src/feishu/send.ts
export async function sendMessageFeishu(
  target: string,  // open_id 或 chat_id
  text: string,
  opts: {
    appId: string;
    appSecret: string;
    messageType?: "text" | "post";
  }
) {
  // 1. 获取 tenant_access_token
  const accessToken = await getTenantAccessToken(opts.appId, opts.appSecret);

  // 2. 发送消息
  const response = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${target.includes("ou") ? "open_id" : "chat_id"}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receive_id: target,
        msg_type: opts.messageType || "text",
        content: JSON.stringify({ text }),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Feishu API error: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    messageId: data.data.message_id,
    channelId: target,
  };
}
```

### 4.2 发送富文本消息

```typescript
export async function sendRichTextFeishu(
  target: string,
  text: string,
  opts: { appId: string; appSecret: string }
) {
  const accessToken = await getTenantAccessToken(opts.appId, opts.appSecret);

  // 构造飞书富文本格式
  const content = {
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
  };

  const response = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        msg_type: "post",
        receive_id: target,
        content: JSON.stringify(content),
      }),
    }
  );

  return await response.json();
}
```

### 4.3 发送卡片消息（高级）

```typescript
export async function sendCardFeishu(
  target: string,
  card: FeishuCard,
  opts: { appId: string; appSecret: string }
) {
  const accessToken = await getTenantAccessToken(opts.appId, opts.appSecret);

  const response = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        msg_type: "interactive",
        receive_id: target,
        content: JSON.stringify(card),
      }),
    }
  );

  return await response.json();
}

// 卡片示例
interface FeishuCard {
  config: { wide_screen_mode: boolean };
  header: {
    title: { content: string; tag: "plain_text" };
  };
  elements: Array<{
    tag: "div" | "markdown";
    text: string;
  }>;
}
```

## 五、飞书 API 工具函数

### 5.1 获取 Tenant Access Token

```typescript
let cachedToken: { token: string; expireAt: number } | null = null;

export async function getTenantAccessToken(
  appId: string,
  appSecret: string
): Promise<string> {
  // 缓存未过期，直接返回
  if (cachedToken && cachedToken.expireAt > Date.now()) {
    return cachedToken.token;
  }

  // 请求新 token
  const response = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Feishu auth error: ${data.msg}`);
  }

  // 缓存 token（提前 5 分钟过期）
  cachedToken = {
    token: data.tenant_access_token,
    expireAt: Date.now() + (data.expire - 300) * 1000,
  };

  return cachedToken.token;
}
```

### 5.2 下载飞书媒体文件

```typescript
async function downloadFeishuImage(
  imageKey: string,
  opts: MonitorFeishuOpts
): Promise<string> {
  const accessToken = await getTenantAccessToken(opts.appId, opts.appSecret);

  // 1. 获取图片下载 URL
  const response = await fetch(
    `https://open.feishu.cn/open-apis/im/v1/images/${imageKey}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Feishu image error: ${data.msg}`);
  }

  // 2. 下载图片到本地
  const imageBuffer = await fetch(data.data.image_key).then((r) =>
    r.arrayBuffer()
  );

  // 3. 保存到本地临时目录
  const localPath = `/tmp/feishu-${imageKey}.png`;
  await fs.writeFile(localPath, Buffer.from(imageBuffer));

  return localPath;
}
```

## 六、配置示例

### 6.1 用户配置文件

```yaml
# ~/.openclaw/config.yml
channels:
  feishu:
    enabled: true
    appId: "cli_xxxxxxxxx"
    appSecret: "xxxxxxxxx"
    encryptKey: "xxxxxxxxx"
    verificationToken: "xxxxxxxxx"
    eventUrl: "https://your-domain.com/feishu/events"
```

### 6.2 飞书应用配置

1. **创建飞书应用**
   - 访问 https://open.feishu.cn/app
   - 创建"企业自建应用"

2. **权限配置**
   - 获取消息：`im:message`、`im:message.group_at_msg`
   - 发送消息：`im:message`
   - 读取用户信息：`contact:user.base:readonly`

3. **事件订阅**
   - 订阅事件：`im.message.receive_v1`
   - 请求 URL：`https://your-domain.com/feishu/events`

4. **获取凭证**
   - App ID
   - App Secret
   - Encrypt Key（事件加密）
   - Verification Token（事件验证）

## 七、实施步骤

### Phase 1: 基础功能（1-2 周）

- [ ] 创建 `extensions/feishu` 目录结构
- [ ] 实现 `channel.ts` 基础配置
- [ ] 实现事件接收 Webhook
- [ ] 实现文本消息收发
- [ ] 本地测试验证

### Phase 2: 完整功能（1-2 周）

- [ ] 支持图片/文件消息
- [ ] 支持富文本消息
- [ ] 实现消息去重（幂等性）
- [ ] 错误处理和重试
- [ ] 日志和监控

### Phase 3: 集成测试（1 周）

- [ ] 集成到 OpenClaw 主项目
- [ ] 测试飞书 SSO
- [ ] 测试多用户场景
- [ ] 文档编写

## 八、与现有通道的对比

| 特性 | Slack | Discord | Telegram | 飞书 |
|-----|-------|---------|----------|------|
| Bot API | ✅ | ✅ | ✅ | ✅ |
| Webhook/轮询 | Webhook | WebSocket | 两者 | Webhook |
| 消息类型 | 文本/文件/附件 | 文本/表情/轮询 | 文本/媒体/轮询 | 文本/图片/文件/卡片 |
| 线程 | ✅ | ✅ | ✅ | ❌ |
| 表情回复 | ✅ | ✅ | ✅ | ❌ |
| 需要加密 | ❌ | ❌ | ❌ | ✅ |

## 九、注意事项

### 9.1 飞书特殊性

1. **消息加密**：飞书默认加密事件回调，需实现 AES-256-CBC 解密
2. **用户 ID**：飞书使用 `open_id` 而非用户名，需要映射
3. **租户隔离**：多租户应用需注意 `tenant_key`
4. **API 限流**：飞书 API 有严格的速率限制

### 9.2 安全考虑

1. **验证 Token**：必须验证 `verification_token`
2. **加密解密**：使用 `encrypt_key` 解密事件
3. **重放攻击**：通过 `timestamp` 和 `uuid` 防止重放
4. **敏感信息**：`app_secret` 存储在环境变量或加密存储

### 9.3 与企业版集成

飞书通道是实现企业版的关键组件，需结合：

- **飞书 SSO**：`open.feishu.cn/authen/v1/authorize`
- **用户同步**：`authen/v1/user_info` API
- **组织架构**：获取部门、群组信息
- **权限映射**：飞书角色 → OpenClaw 角色

## 十、参考资源

- **飞书开放平台**：https://open.feishu.cn/document
- **事件订阅**：https://open.feishu.cn/document/home/subscribe-to-guide
- **消息发送**：https://open.feishu.cn/document/client-docs/bot-v3/add-bot
- **OpenClaw 通道示例**：`extensions/slack`、`extensions/telegram`

---

**下一步：** 是否开始创建飞书通道的基础代码？
