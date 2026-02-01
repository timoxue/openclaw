# 快速开始指南

本指南将帮助你在 5 分钟内完成 OpenClaw 飞书插件的安装和配置。

## 前提条件

- Node.js >= 18.0.0
- npm 或 pnpm
- 飞书企业账号
- OpenClaw 已安装

## 步骤 1：安装插件

```bash
npm install @timoxue/openclaw-feishu
```

## 步骤 2：创建飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn/app)
2. 点击"创建企业自建应用"
3. 填写应用信息：
   - 应用名称：`OpenClaw Bot`（或自定义）
   - 应用描述：`AI 助手机器人`
4. 点击"创建"

## 步骤 3：获取凭证

1. 在应用页面，找到"凭证与基础信息"
2. 复制以下信息：
   - **App ID**: `cli_xxxxxxxxx`
   - **App Secret**: `xxxxxxxxxxxxxxxxxxxx`

## 步骤 4：配置权限

进入"权限管理"，搜索并添加以下权限：

| 权限名称 | 权限码 | 必需 |
|---------|--------|------|
| 获取与发送消息 | `im:message` | ✅ |
| 获取群组信息 | `im:group` | ✅ |
| 读取用户信息 | `contact:user.base:readonly` | ✅ |
| 发送单聊消息 | `im:message:send_as_bot` | ✅ |

选择开通范围：
- 开发测试：选择"指定部门/用户"，添加你自己
- 生产环境：选择"全部成员"

点击"批量开通"。

## 步骤 5：配置事件订阅

### 开发环境（推荐）

1. 进入"事件与回调"
2. 选择"使用长连接接收事件"
3. 点击"添加事件"，搜索并添加：`im.message.receive_v1`
4. 点击"保存"

✅ **优点**：无需公网 IP，配置简单

### 生产环境

1. 进入"事件与回调"
2. 选择"使用回调地址接收事件"
3. 填写请求地址：`https://your-domain.com/feishu/events`
4. 开启"加密"，复制 Encrypt Key 和 Verification Token
5. 添加事件订阅：`im.message.receive_v1`
6. 点击"保存"

## 步骤 6：配置 OpenClaw

编辑 `~/.openclaw/openclaw.json`：

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_a9f45d8d6238dbdb",
      "appSecret": "LBatqp6Mn95H68SnsQpFPbWC2YzAJn4l"
    }
  },
  "plugins": {
    "entries": {
      "feishu": {
        "enabled": true
      }
    }
  }
}
```

## 步骤 7：启动 OpenClaw

```bash
# 配置 API 密钥（必需）
export ANTHROPIC_API_KEY="your-api-key-here"

# 启动 Gateway
npx openclaw gateway
```

从 [Anthropic Console](https://console.anthropic.com/) 获取 API 密钥。

## 步骤 8：启用并发布机器人

1. 在飞书开放平台，进入"机器人"设置
2. 确保"启用机器人"开关已打开
3. 设置机器人名称和描述
4. 点击"发布"
5. 选择发布范围（企业内发布）

## 步骤 9：测试

1. 在飞书客户端搜索你的 App ID
2. 添加机器人为好友
3. 发送测试消息：`你好`
4. 如果一切正常，机器人会回复！

## 故障排查

### 问题：机器人没有回复

**检查清单**：
```bash
# 1. 检查 API 密钥
echo $ANTHROPIC_API_KEY

# 2. 检查 Gateway 状态
npx openclaw status

# 3. 检查日志
tail -f /tmp/openclaw/openclaw-*.log
```

**常见原因**：
- ❌ 未配置 `ANTHROPIC_API_KEY`
- ❌ Gateway 未运行
- ❌ 飞书应用未发布
- ❌ 权限未开通或开通范围不包含测试用户

### 问题：无法接收消息

**检查清单**：
- [ ] 权限是否已开通
- [ ] 权限开通范围是否包含测试用户
- [ ] 事件订阅是否已配置
- [ ] WebSocket 长连接是否已建立

**检查方法**：
1. 查看飞书开放平台的事件推送日志
2. 查看 Gateway 日志中的 `[ws] client ready` 消息

### 问题：长连接显示"未建立"

**解决方法**：
1. 确认 Gateway 正在运行：`npx openclaw status`
2. 检查配置文件中的 App ID 和 App Secret
3. 重启 Gateway：`npx openclaw gateway restart`

## 下一步

- 📖 阅读 [完整文档](README.md)
- 🔧 查看 [配置选项](README.md#配置)
- 🐛 遇到问题？查看 [故障排查](README.md#故障排查)
- 💡 需要 API 密钥？访问 [Anthropic Console](https://console.anthropic.com/)

## 获取帮助

- 📧 Email: timo@xue.me
- 🐛 Issues: https://github.com/timoxue/openclaw-feishu/issues
- 📚 Docs: https://docs.openclaw.ai/

---

**提示**：保存本指南以便日后参考！🚀
