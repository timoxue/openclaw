# 飞书应用配置指南

本文档介绍如何配置飞书应用以与 OpenClaw 集成。

## 前置要求

- 飞书账号（如果没有，需要先注册）
- 飞书开放平台访问权限：https://open.feishu.cn/app

## 配置步骤

### 1. 创建飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 点击 "创建企业自建应用"
3. 填写应用信息：
   - 应用名称：`OpenClaw Bot`
   - 应用描述：`AI 助手机器人`
4. 创建成功后，进入应用详情页

### 2. 获取凭证

在 **"凭证与基础信息"** 页面，记录：

```bash
App ID: cli_xxxxxxxxxxxxx
App Secret: xxxxxxxxxxxxxxxxxxxx
```

⚠️ **重要**：妥善保管 App Secret，不要泄露！

### 3. 配置权限

在 **"权限管理"** 页面，搜索并添加以下权限：

| 权限名称 | 权限码 | 必需 |
|---------|--------|------|
| 获取群组信息 | `im:group` | ✅ |
| 获取与发送消息 | `im:message` | ✅ |
| 读取用户信息 | `contact:user.base:readonly` | ✅ |
| 发送单聊消息 | `im:message:send_as_bot` | ✅ |

### 4. 事件订阅配置

#### 开发环境：WebSocket 长连接（推荐）

✅ **无需配置**，SDK 会自动使用 WebSocket 长连接模式。

#### 生产环境：Webhook 回调（可选）

如果使用 Webhook 模式：

1. 在 **"事件订阅"** 页面配置：
   ```
   URL: https://your-domain.com/feishu/events
   ```

2. 订阅事件：
   - ✅ `im.message.receive_v1` - 接收消息

3. 加密设置（推荐）：
   - ✅ 启用加密
   - 记录 Encrypt Key
   - 记录 Verification Token

### 5. 测试机器人

在飞书客户端：
1. 搜索机器人名称：`OpenClaw Bot`
2. 发送测试消息：`你好`

### 6. OpenClaw 配置

编辑 `~/.openclaw-dev/openclaw.json`：

```yaml
channels:
  feishu:
    enabled: true
    appId: "cli_xxxxxxxxxxxxx"       # 从飞书开放平台获取
    appSecret: "xxxxxxxxxxxxxxxxxx"  # 从飞书开放平台获取

    # 仅 Webhook 模式需要（开发阶段不需要）
    # encryptKey: "xxxxxxxxxxxxxxxxxx"
    # verificationToken: "xxxxxxxxxxxxxxxxxx"
    # eventUrl: "https://your-domain.com/feishu/events"
```

## 启动 OpenClaw

```bash
cd D:\openclaw
node "D:\openclaw\openclaw.mjs" --dev gateway --token test-token
```

## 测试连接

在飞书客户端给机器人发送消息，应该能看到响应！

## 故障排查

### 问题 1：机器人没有回复

检查：
- ✅ 飞书应用是否已启用
- ✅ 权限是否已开通
- ✅ OpenClaw gateway 是否正在运行
- ✅ 配置文件中的 App ID 和 Secret 是否正确

### 问题 2：WebSocket 连接失败

检查：
- ✅ 网络连接是否正常
- ✅ 防火墙是否阻止了出站连接
- ✅ 飞书应用凭证是否正确

### 问题 3：权限被拒绝

检查：
- ✅ 是否在飞书开放平台申请了所有必需权限
- ✅ 权限是否已开通（"批量开通"按钮）

## 参考资料

- [飞书开放平台文档](https://open.feishu.cn/document/)
- [飞书 Node.js SDK](https://github.com/larksuite/node-sdk)
- [飞书事件订阅文档](https://open.feishu.cn/document/ukTMukTMukTM/uUTNz4SN1MjL1UzM)

## 下一步

配置完成后，可以开始使用飞书通道：

```bash
# 发送测试消息
node "D:\openclaw\openclaw.mjs" --dev message send \
  --channel feishu \
  --target ou_xxxxxxxxx \
  --message "Hello from OpenClaw!"
```
