# @timoxue/openclaw-feishu

飞书（Lark）频道插件 - 为 OpenClaw 提供飞书机器人集成

[![npm version](https://badge.fury.io/js/%40timoxue%2Fopenclaw-feishu.svg)](https://www.npmjs.com/package/@timoxue/openclaw-feishu)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 功能特性

- ✅ 支持私聊消息接收与发送
- ✅ 支持群聊消息接收与发送（支持 @机器人）
- ✅ WebSocket 长连接模式（开发环境推荐，无需公网 IP）
- ✅ Webhook 回调模式（生产环境推荐）
- ✅ 多账号支持
- ✅ 消息类型：文本
- ✅ 事件订阅：`im.message.receive_v1`

## 安装

### 通过 npm 安装（推荐）

```bash
npm install @timoxue/openclaw-feishu
```

### 从源码安装

```bash
# 克隆仓库
git clone https://github.com/timoxue/openclaw-feishu.git
cd openclaw-feishu

# 安装依赖
npm install

# 构建
npm run build
```

## 配置

### 在 OpenClaw 配置文件中添加

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_xxxxxxxxx",
      "appSecret": "xxxxxxxxxxxxxxxxxxxx"
    }
  }
}
```

### 多账号配置

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "accounts": {
        "default": {
          "enabled": true,
          "appId": "cli_xxxxxxxxx",
          "appSecret": "xxxxxxxxxxxxxxxxxxxx"
        },
        "work": {
          "enabled": true,
          "name": "工作账号",
          "appId": "cli_yyyyyyyyy",
          "appSecret": "yyyyyyyyyyyyyyyyyyyy"
        }
      }
    }
  }
}
```

### 配置说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `enabled` | boolean | 是 | 是否启用此账号 |
| `name` | string | 否 | 账号显示名称 |
| `appId` | string | 是 | 飞书应用 ID |
| `appSecret` | string | 是 | 飞书应用密钥 |
| `encryptKey` | string | 否 | 加密密钥（Webhook 模式） |
| `verificationToken` | string | 否 | 验证令牌（Webhook 模式） |
| `eventUrl` | string | 否 | 事件回调地址（Webhook 模式） |

## 飞书开放平台配置

### 1. 创建应用

1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 创建企业自建应用
3. 记录 App ID 和 App Secret

### 2. 配置权限

在应用的**权限管理**中添加以下权限：

- `im:message:send_as_bot` - 发送消息权限（必需）
- `im:message` - 接收消息权限（必需）
- `im:group` - 群组信息权限（必需）
- `contact:user.base:readonly` - 读取用户信息（必需）

### 3. 配置事件订阅

#### 方式 1：WebSocket 长连接（开发环境）

1. 在**事件与回调**中选择"使用长连接接收事件"
2. 添加事件订阅：`im.message.receive_v1`
3. 保存配置

**优点**：
- ✅ 无需公网 IP
- ✅ 配置简单
- ✅ 本地开发友好

#### 方式 2：Webhook 回调（生产环境）

1. 在**事件与回调**中选择"使用回调地址接收事件"
2. 填写请求地址：`https://your-domain.com/feishu/events`
3. 开启加密并复制 Encrypt Key 和 Verification Token
4. 添加事件订阅：`im.message.receive_v1`
5. 保存配置

**优点**：
- ✅ 支持多实例负载均衡
- ✅ 生产环境推荐

### 4. 启用机器人

1. 在应用的**机器人**设置中
2. 确保"启用机器人"开关已打开
3. 设置机器人名称和描述
4. 发布应用

## 使用示例

### 发送消息

```typescript
import { sendMessageFeishu } from '@timoxue/openclaw-feishu';

// 发送文本消息
await sendMessageFeishu(
  'ou_xxxxxxxxx',  // 用户 Open ID 或群聊 ID
  '你好！',         // 消息内容
  {
    accountId: 'default',
    messageType: 'text'
  }
);
```

### 接收消息

消息会自动路由到 OpenClaw 的消息处理系统，你可以在 Agent 中直接处理。

## API 密钥配置

为了让机器人能够回复消息，需要配置 Anthropic API 密钥：

```bash
# Linux/Mac
export ANTHROPIC_API_KEY="your-api-key-here"

# Windows PowerShell
$env:ANTHROPIC_API_KEY="your-api-key-here"

# Windows CMD
set ANTHROPIC_API_KEY=your-api-key-here
```

从 [Anthropic Console](https://console.anthropic.com/) 获取 API 密钥。

## 开发

### 构建项目

```bash
pnpm build
```

### 运行测试

```bash
pnpm test
```

### 调试

```bash
# 启动 OpenClaw Gateway
cd D:\openclaw
npx openclaw gateway

# 在另一个终端查看日志
tail -f /tmp/openclaw/openclaw-*.log
```

## 故障排查

### 问题 1：机器人没有回复

**可能原因**：
1. 没有配置 `ANTHROPIC_API_KEY` 环境变量
2. Gateway 没有运行
3. 飞书应用没有发布

**解决方法**：
```bash
# 检查环境变量
echo $ANTHROPIC_API_KEY

# 检查 Gateway 状态
npx openclaw status

# 检查飞书应用状态
# 确保应用已发布并在"机器人"设置中已启用
```

### 问题 2：无法接收消息

**可能原因**：
1. 权限未开通或开通范围不包含测试用户
2. WebSocket 长连接未建立
3. 事件订阅未配置

**解决方法**：
1. 检查权限管理页面，确认权限已开通
2. 检查权限开通范围是否包含测试用户
3. 在飞书开放平台检查事件订阅配置
4. 查看 Gateway 日志确认 WebSocket 连接状态

### 问题 3：WebSocket 显示"未建立"

**解决方法**：
1. 确认 Gateway 正在运行
2. 检查配置文件中的 App ID 和 App Secret 是否正确
3. 重启 Gateway

## 发布到 npm

### 1. 创建 GitHub 仓库

```bash
# 在 GitHub 上创建新仓库: https://github.com/new
# 仓库名: openclaw-feishu
```

### 2. 准备发布文件

```bash
# 创建独立仓库
cd D:\openclaw\extensions\feishu
git init
git add .
git commit -m "Initial commit: OpenClaw Feishu plugin"

# 添加远程仓库
git remote add origin https://github.com/timoxue/openclaw-feishu.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

### 3. 创建 npm 组织

1. 访问 https://www.npmjs.com/org/timoxue
2. 创建组织 `@timoxue`（如果还没有）

### 4. 登录 npm

```bash
npm login
# 输入你的 npm 用户名、密码和邮箱
```

### 5. 发布

```bash
# 确保在插件目录
cd D:\openclaw\extensions\feishu

# 更新版本号（如果需要）
npm version patch  # 或 minor, major

# 构建项目
pnpm build

# 发布到 npm
npm publish --access public
```

### 6. 验证发布

```bash
# 查看包信息
npm view @timoxue/openclaw-feishu

# 或访问 npm 网站
# https://www.npmjs.com/package/@timoxue/openclaw-feishu
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT

## 相关链接

- [OpenClaw 文档](https://docs.openclaw.ai/)
- [飞书开放平台文档](https://open.feishu.cn/document/)
- [飞书 Node.js SDK](https://github.com/larksuite/node-sdk)
- [飞书权限管理](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/ukTNz4SN1MjL1UzM)
- [飞书事件订阅](https://open.feishu.cn/document/ukTMukTMukTM/uUTNz4SN1MjL1UzM)
