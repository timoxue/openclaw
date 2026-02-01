# 飞书开放平台配置完整指南

本文档提供飞书开放平台的完整配置步骤，包括权限配置和长连接设置。

## 目录
1. [权限配置](#权限配置)
2. [长连接设置](#长连接设置)
3. [事件订阅](#事件订阅)
4. [发布机器人](#发布机器人)

---

## 权限配置

### 方式 1：通过开放平台界面配置（推荐）

#### 步骤 1: 进入权限管理

1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 找到你的应用: `OpenClaw Bot` (App ID: `cli_a9f70e6b553ddbc4`)
3. 点击进入应用
4. 在左侧菜单找到 **"权限管理"**

#### 步骤 2: 搜索并添加权限

在权限管理页面，搜索框中输入以下权限码，然后点击 **"申请权限"** → **"批量开通"**：

| 权限名称 | 权限码 | 说明 | 必需 |
|---------|--------|------|------|
| 获取与发送消息 | `im:message` | 接收和发送消息 | ✅ |
| 获取群组信息 | `im:group` | 读取群聊信息 | ✅ |
| 读取用户信息 | `contact:user.base:readonly` | 获取发送者信息 | ✅ |
| 发送单聊消息 | `im:message:send_as_bot` | 机器人发送消息 | ✅ |

#### 步骤 3: 开通权限范围

选择权限开通范围：
- **全部成员**: 所有企业用户都可以使用机器人
- **指定部门/用户**: 只有选中的部门/用户可以使用机器人（推荐）

点击 **"批量开通"** 完成配置。

---

### 方式 2：权限包配置 JSON（高级）

飞书支持使用权限包一次性申请多个权限。

#### 权限包 JSON 格式

```json
{
  "app_id": "cli_a9f70e6b553ddbc4",
  "app_name": "OpenClaw Bot",
  "app_type": "self_build",
  "permissions": [
    {
      "scope": "im:message",
      "description": "获取与发送消息权限",
      "required": true
    },
    {
      "scope": "im:group",
      "description": "获取群组信息权限",
      "required": true
    },
    {
      "scope": "contact:user.base:readonly",
      "description": "读取用户基本信息权限",
      "required": true
    },
    {
      "scope": "im:message:send_as_bot",
      "description": "发送单聊消息权限",
      "required": true
    }
  ],
  "scope_filters": {
    "include": {
      "user_ids": [],
      "department_ids": [],
      "groups": []
    },
    "exclude": {
      "user_ids": [],
      "department_ids": []
    }
  }
}
```

#### 权限说明

**`permissions` 字段**:
- `scope`: 权限码（必需）
- `description`: 权限描述（可选）
- `required`: 是否必需权限（可选）

**`scope_filters` 字段**（可选）:
- `include`: 包含的用户/部门
- `exclude`: 排除的用户/部门

---

## 长连接设置

### ⚠️ 重要说明

**飞书提供了两种事件接收模式**：

1. **WebSocket 长连接模式**（推荐用于开发）
   - ✅ 无需公网地址
   - ✅ 配置简单
   - ✅ 本地开发环境友好
   - ⚠️ 仅支持单实例部署

2. **Webhook 回调模式**（推荐用于生产）
   - ✅ 支持多实例负载均衡
   - ⚠️ 需要公网 HTTPS 地址
   - ⚠️ 需要处理事件加密

---

### 配置 WebSocket 长连接（开发环境）

#### 步骤 1: 进入事件订阅

1. 在飞书开放平台，进入你的应用
2. 左侧菜单找到 **"事件与回调"**
3. 选择 **"使用长连接接收事件"**

#### 步骤 2: 配置订阅事件

在 **"使用长连接接收事件"** 页面：

1. 点击 **"添加事件"**
2. 搜索并添加以下事件：

```
im.message.receive_v1  - 接收消息事件
```

3. 点击 **"保存"**

#### 步骤 3: 验证配置

保存后，页面会显示：
- ✅ **已订阅事件**: `im.message.receive_v1`
- ℹ️ **状态**: 长连接已建立

#### 步骤 4: OpenClaw 端配置

OpenClaw 会自动使用 WebSocket 长连接模式，无需额外配置。

```yaml
# ~/.openclaw-dev/openclaw.json
channels:
  feishu:
    enabled: true
    appId: "cli_a9f70e6b553ddbc4"
    appSecret: "9Vz7e1K5KZWZQCUGMpp87dzyNnxttBGI"
    # 不需要 eventUrl - 自动使用 WebSocket
```

---

### 配置 Webhook 回调（生产环境）

#### 前置条件

- 拥有公网可访问的 HTTPS 地址
- 例如: `https://your-domain.com/feishu/events`

#### 步骤 1: 进入事件订阅

1. 在飞书开放平台，进入你的应用
2. 左侧菜单找到 **"事件与回调"**
3. 选择 **"使用回调地址接收事件"**

#### 步骤 2: 配置回调地址

填写以下信息：

```
请求地址: https://your-domain.com/feishu/events
```

#### 步骤 3: 配置加密（推荐）

开启 **"加密"** 开关：
- 飞书会生成 **Encrypt Key**（加密密钥）
- 飞书会生成 **Verification Token**（验证令牌）

复制这两个值，稍后需要在 OpenClaw 中配置。

#### 步骤 4: 订阅事件

添加事件订阅：

```
im.message.receive_v1  - 接收消息事件
```

#### 步骤 5: OpenClaw 端配置

```yaml
# ~/.openclaw-dev/openclaw.json
channels:
  feishu:
    enabled: true
    appId: "cli_a9f70e6b553ddbc4"
    appSecret: "9Vz7e1K5KZWZQCUGMpp87dzyNnxttBGI"
    eventUrl: "https://your-domain.com/feishu/events"
    encryptKey: "从飞书开放平台复制的 Encrypt Key"
    verificationToken: "从飞书开放平台复制的 Verification Token"
```

---

## 事件订阅详细配置

### 必需事件

#### 1. 接收消息事件

**事件类型**: `im.message.receive_v1`

**说明**: 当用户给机器人发送消息时触发

**事件数据结构**:
```json
{
  "token": "verify_token",
  "timestamp": "1234567890",
  "uuid": "event_uuid",
  "event": {
    "sender": {
      "sender_id": {
        "user_id": "user_123",
        "open_id": "ou_123",
        "union_id": "on_123",
        "name": "张三"
      }
    },
    "chat_id": "oc_123",
    "message": {
      "message_id": "om_123",
      "message_type": "text",
      "create_time": "1234567890",
      "content": "{\"text\":\"你好\"}"
    }
  },
  "type": "im.message.receive_v1"
}
```

### 可选事件

#### 2. 群组消息事件

如果需要在群聊中使用机器人：

**事件类型**: `im.message.receive_v1` (群聊场景)

**额外权限**: `im:group`

---

## 发布机器人

### 步骤 1: 启用机器人

1. 在飞书开放平台，进入你的应用
2. 左侧菜单找到 **"机器人"**
3. 确保 **"启用机器人"** 开关已打开

### 步骤 2: 设置机器人信息

配置以下信息：
- **机器人名称**: `OpenClaw Bot`
- **机器人描述**: `AI 助手机器人`
- **机器人头像**: 上传图片（可选）

### 步骤 3: 发布到企业

1. 点击 **"发布"** 按钮
2. 选择发布范围：
   - **企业内发布**: 仅当前企业可用
   - **公开**: 所有企业都可以安装

3. 点击 **"确认发布"**

### 步骤 4: 测试机器人

1. 在飞书客户端搜索你的 App ID: `cli_a9f70e6b553ddbc4`
2. 点击添加机器人
3. 发送测试消息：`你好`

---

## 常见问题

### Q1: 长连接模式 vs Webhook 模式，如何选择？

**长连接模式**：
- ✅ 本地开发
- ✅ 无需公网 IP
- ✅ 配置简单
- ❌ 不支持多实例部署

**Webhook 模式**：
- ✅ 生产环境
- ✅ 支持多实例负载均衡
- ❌ 需要公网 HTTPS 地址
- ❌ 配置相对复杂

### Q2: 权限被拒绝怎么办？

检查以下几点：
1. 权限是否已开通（在权限管理页面）
2. 开通范围是否包含测试用户
3. 应用是否已发布

### Q3: 如何查看用户 Open ID？

**方法 1**: 通过飞书客户端
1. 点击用户头像
2. 查看用户信息
3. 找到 "开放平台 ID"

**方法 2**: 通过网关日志
```bash
# 实时查看日志
cd D:\openclaw
tail -f ~/.openclaw-dev/agents/main/logs/gateway.log | grep -i "feishu\|飞书"
```

### Q4: 长连接显示"未建立"怎么办？

**原因**: OpenClaw Gateway 未运行或配置错误

**解决方法**:
1. 检查 OpenClaw Gateway 是否正在运行
2. 检查配置文件中的 App ID 和 App Secret 是否正确
3. 重启 Gateway

---

## 配置检查清单

- [ ] 飞书应用已创建
- [ ] App ID 和 App Secret 已记录
- [ ] 权限已配置并开通
  - [ ] `im:message`
  - [ ] `im:group`
  - [ ] `contact:user.base:readonly`
  - [ ] `im:message:send_as_bot`
- [ ] 事件订阅已配置
  - [ ] WebSocket 长连接模式 ✅ 或 Webhook 回调模式
- [ ] 机器人已启用
- [ ] 应用已发布
- [ ] OpenClaw 配置文件已更新
- [ ] Gateway 正在运行

---

## 参考资料

- [飞书开放平台文档](https://open.feishu.cn/document/)
- [飞书 Node.js SDK](https://github.com/larksuite/node-sdk)
- [事件订阅概述](https://open.feishu.cn/document/ukTMukTMukTM/uUTNz4SN1MjL1UzM)
- [接收消息事件](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive)

---

## 下一步

配置完成后，参考 [飞书设置指南](./feishu-setup-guide.md) 完成测试。
