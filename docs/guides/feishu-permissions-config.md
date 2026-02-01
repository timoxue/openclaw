# 飞书机器人权限配置 JSON（正确格式）

## 飞书权限包配置

根据飞书开放平台的权限包格式，以下是正确的配置：

```json
{
  "scopes": {
    "tenant": [
      "im:message:send_as_bot",
      "im:message",
      "im:group",
      "im:chat",
      "contact:user.base:readonly",
      "contact:user.email:readonly"
    ],
    "user": [
      "im:message",
      "im:group"
    ]
  }
}
```

## 权限说明

### Tenant 租户级别权限

| 权限码 | 说明 | 用途 |
|--------|------|------|
| `im:message:send_as_bot` | 机器人发送消息 | ✅ 必需 - 机器人回复消息 |
| `im:message` | 获取与发送消息 | ✅ 必需 - 接收用户消息 |
| `im:group` | 群组信息 | ✅ 必需 - 读取群聊信息 |
| `im:chat` | 会话信息 | 可选 - 获取会话列表 |
| `contact:user.base:readonly` | 读取用户基本信息 | ✅ 必需 - 获取发送者信息 |
| `contact:user.email:readonly` | 读取用户邮箱 | 可选 - 获取用户邮箱 |

### User 用户级别权限

| 权限码 | 说明 | 用途 |
|--------|------|------|
| `im:message` | 消息权限 | 用户授权后可发送消息 |
| `im:group` | 群组权限 | 用户授权后可访问群组 |

---

## 最小权限配置（推荐）

如果只需要基本的机器人功能，使用这个配置：

```json
{
  "scopes": {
    "tenant": [
      "im:message:send_as_bot",
      "im:message",
      "im:group",
      "contact:user.base:readonly"
    ]
  }
}
```

---

## 完整权限配置（企业版）

如果需要更多功能（如飞书文档集成），使用这个配置：

```json
{
  "scopes": {
    "tenant": [
      "im:message:send_as_bot",
      "im:message",
      "im:group",
      "im:chat",
      "im:conversation",
      "contact:user.base:readonly",
      "contact:user.email:readonly",
      "contact:user.phone:readonly",
      "drive:drive:readonly",
      "docx:document:readonly",
      "wiki:wiki:readonly"
    ],
    "user": [
      "im:message",
      "im:group",
      "im:chat"
    ]
  }
}
```

---

## 如何使用权限包 JSON

### 方式 1：在开放平台手动配置（推荐）

1. 访问 https://open.feishu.cn/app
2. 找到你的应用：`OpenClaw Bot`
3. 进入 **"权限管理"**
4. 搜索上述权限并点击 **"申请权限"**
5. 选择开通范围后点击 **"批量开通"**

### 方式 2：通过 API 配置权限包

如果你使用飞书开放平台 API，可以使用这个 JSON：

```bash
curl -X POST "https://open.feishu.cn/open-apis/application/v3/applications/app_id/permission/package/apply" \
  -H "Authorization: Bearer YOUR_APP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scopes": {
      "tenant": [
        "im:message:send_as_bot",
        "im:message",
        "im:group",
        "contact:user.base:readonly"
      ]
    }
  }'
```

替换 `app_id` 和 `YOUR_APP_ACCESS_TOKEN`。

---

## 权限对照表

### OpenClaw 需要的权限

| 功能 | 权限码 | 类型 | 必需 |
|------|--------|------|------|
| 发送消息 | `im:message:send_as_bot` | Tenant | ✅ |
| 接收消息 | `im:message` | Tenant | ✅ |
| 群聊支持 | `im:group` | Tenant | ✅ |
| 用户信息 | `contact:user.base:readonly` | Tenant | ✅ |
| 会话列表 | `im:chat` | Tenant | 可选 |
| 用户邮箱 | `contact:user.email:readonly` | Tenant | 可选 |

---

## 验证权限配置

配置完成后，可以通过以下方式验证：

### 1. 检查应用权限状态

1. 进入飞书开放平台
2. 选择你的应用
3. 进入 **"权限管理"**
4. 确认以下权限状态为 **"已开通"**：
   - ✅ `im:message:send_as_bot`
   - ✅ `im:message`
   - ✅ `im:group`
   - ✅ `contact:user.base:readonly`

### 2. 测试机器人权限

在飞书客户端给机器人发送消息：
```
你好
```

如果能收到回复，说明权限配置正确！

---

## 故障排查

### 问题 1: 权限被拒绝

**错误信息**: `permission denied`

**解决方法**:
1. 检查权限是否已开通（在权限管理页面）
2. 检查开通范围是否包含测试用户
3. 确认应用已发布

### 问题 2: 无法发送消息

**错误信息**: `send message failed`

**解决方法**:
1. 确认 `im:message:send_as_bot` 权限已开通
2. 确认机器人已启用（在应用设置中）
3. 检查 App ID 和 App Secret 是否正确

### 问题 3: 无法读取用户信息

**错误信息**: `cannot read user info`

**解决方法**:
1. 确认 `contact:user.base:readonly` 权限已开通
2. 用户必须在权限开通范围内

---

## 参考文档

- [飞书权限管理文档](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/ukTNz4SN1MjL1UzM)
- [飞书权限包 API](https://open.feishu.cn/document/server-docs/permission/permission-package/apply)
- [飞书机器人权限说明](https://open.feishu.cn/document/ukTMukTMukTM/uUTNz4SN1MjL1UzM)
