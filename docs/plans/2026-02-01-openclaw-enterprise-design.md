# OpenClaw 企业版架构设计文档

**项目名称：** OpenClaw 企业版（医药行业）
**设计日期：** 2026-02-01
**目标场景：** 医药公司销售团队 AI 助手系统

## 一、项目概述

### 1.1 目标

将 OpenClaw 从"个人版"改造为"企业版"，支持医药公司销售团队的多用户场景，核心特性：

- **多租户架构**：一个后端服务支持 N 个用户，完全数据隔离
- **飞书集成**：SSO 单点登录 + IM 机器人无缝接入
- **双层知识库**：公共医学知识（共享）+ 私有客户数据（隔离）
- **权限控制**：功能权限 + 数据权限双重控制
- **医药合规**：数据脱敏、审计日志、合规报告
- **无状态架构**：支持横向扩展，K8s 部署
- **用户工作空间**：每个用户独立管理文件和知识库

### 1.2 使用场景

**目标用户：** 医药公司销售代表（100-1000 人规模）
**核心需求：**
- 在飞书中直接与 AI 对话，无需额外 App
- 查询公司公共医学知识（药典、临床数据、合规话术）
- 管理个人客户备忘录和拜访记录
- 权限隔离：销售只能看自己负责的医院数据
- 医药合规：自动脱敏患者信息，操作审计

---

## 二、系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         客户端层                              │
│   飞书 IM（主要）  │  Web 管理后台  │  API（SDK）           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         API 网关层                           │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │ 飞书事件处理  │  │  身份认证     │  │  限流控制     │     │
│   └──────────────┘  └──────────────┘  └──────────────┘     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │  权限中间件  │  │  脱敏中间件   │  │  审计中间件   │     │
│   └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         业务逻辑层                           │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │ OpenClaw 核心 │  │  双层 RAG    │  │  工具调用    │     │
│   │   AI 引擎    │  │  向量检索    │  │  权限路由    │     │
│   └──────────────┘  └──────────────┘  └──────────────┘     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │  工作空间    │  │  用户管理    │  │  权限管理    │     │
│   │  文件管理    │  │  角色管理    │  │  审计日志    │     │
│   └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         数据存储层                           │
│   PostgreSQL  │  Redis  │  Milvus (向量库)  │  文件系统     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Docker + Kubernetes
```

### 2.2 技术栈

| 层级 | 技术 | 用途 |
|-----|------|------|
| **后端框架** | Node.js + TypeScript | OpenClaw 核心 |
| **数据库** | PostgreSQL | 用户、对话、审计日志 |
| **缓存** | Redis | 会话状态、临时数据 |
| **向量库** | Milvus / PGVector | 双层 RAG 知识库 |
| **认证** | 飞书 OAuth2 | SSO 单点登录 |
| **部署** | Docker + Kubernetes | 无状态横向扩展 |
| **监控** | Prometheus + Grafana | 指标监控告警 |
| **日志** | Winston + ELK | 结构化日志 |
| **AI 模型** | Claude Opus 4.5 / DeepSeek-V3 | 对话生成 |

---

## 三、多租户架构设计

### 3.1 核心原则

**数据隔离：** 所有数据表强制 `user_id` 外键
**权限强制：** API 层禁止跨用户查询
**会话无状态：** 所有状态存 Redis，任意节点可处理请求

### 3.2 数据库 Schema

```sql
-- 用户表（飞书同步）
CREATE TABLE users (
  id UUID PRIMARY KEY,
  feishu_user_id VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(100),
  email VARCHAR(255),
  department VARCHAR(100),
  role VARCHAR(50),  -- 销售、经理、总监
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP
);

-- 对话历史
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  channel VARCHAR(50),
  channel_user_id VARCHAR(100),
  started_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 消息表
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20),
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 私有记忆/备忘录
CREATE TABLE private_memories (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  key VARCHAR(255),
  value TEXT,
  UNIQUE(user_id, key)
);
```

### 3.3 身份识别流程

```typescript
// 中间件：从飞书事件中提取用户身份
export async function identifyContext(req: Request) {
  const feishuUserId = extractFeishuUserId(req);
  const user = await db.users.findOne({ feishu_user_id: feishuUserId });

  if (!user) {
    // 首次登录，自动从飞书同步
    const newUser = await syncUserFromFeishu(feishuUserId);
    req.context = { userId: newUser.id };
  } else {
    req.context = { userId: user.id };
  }

  return req;
}
```

---

## 四、双层知识库架构（Hybrid RAG）

### 4.1 设计理念

**公共层：** 全公司共享，存放药典、临床试验、公司话术
**私有层：** 用户隔离，存放客户备忘录、拜访记录

### 4.2 向量库命名空间

```typescript
interface VectorNamespace {
  public: 'company_medical_knowledge';      // 公共知识
  private: `user_${userId}_private`;         // 用户私有数据
}
```

### 4.3 双路检索逻辑

```typescript
export async function hybridSearch(userId: string, query: string, topK: number = 5) {
  const [publicDocs, privateDocs] = await Promise.all([
    // 检索公共知识（60%）
    milvus.search({
      collection: 'medical_knowledge',
      partition: 'public',
      vector: await embed(query),
      limit: Math.ceil(topK * 0.6)
    }),

    // 检索私有数据（40%）
    milvus.search({
      collection: 'medical_knowledge',
      partition: `user_${userId}_private`,
      vector: await embed(query),
      limit: Math.ceil(topK * 0.4)
    })
  ]);

  return {
    context: [
      ...publicDocs.map(d => `[公共知识] ${d.content}`),
      ...privateDocs.map(d => `[个人笔记] ${d.content}`)
    ].join('\n\n'),
    sources: { public: publicDocs.length, private: privateDocs.length }
  };
}
```

### 4.4 知识库管理

- **管理员**：上传公共知识到 `public` 分区
- **销售**：上传私有文件到 `user_{userId}_private` 分区
- **实时同步**：公共知识更新一次，全员生效

---

## 五、权限系统设计

### 5.1 三层权限控制

1. **角色权限（RBAC）**：销售代表、地区经理、医学总监
2. **功能权限**：`hospital_data:read`, `crm:write` 等
3. **数据权限**：只能访问分配的医院数据

### 5.2 权限表结构

```sql
-- 角色表
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  level INTEGER DEFAULT 0
);

-- 权限定义表
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT
);

-- 角色-权限关联
CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id),
  permission_id UUID REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

-- 用户-角色关联
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id),
  role_id UUID REFERENCES roles(id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

-- 医院/区域权限（数据级别）
CREATE TABLE user_hospital_permissions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  hospital_id VARCHAR(100) NOT NULL,
  hospital_name VARCHAR(255),
  region VARCHAR(100),
  permissions JSONB,  -- {"can_read": true, "can_edit": false}
  valid_from TIMESTAMP,
  valid_until TIMESTAMP
);
```

### 5.3 权限中间件

```typescript
// 功能权限检查
export function checkPermission(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.context.userId;
    const hasPermission = await db.query(`
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      JOIN user_roles ur ON ur.role_id = rp.role_id
      WHERE ur.user_id = $1
      AND p.resource = $2
      AND p.action = $3
      LIMIT 1
    `, [userId, resource, action]);

    if (!hasPermission.length) {
      return res.status(403).json({ error: '权限不足' });
    }

    next();
  };
}

// 数据权限检查（医院级别）
export async function canAccessHospital(userId: string, hospitalId: string) {
  const permission = await db.user_hospital_permissions.findOne({
    user_id: userId,
    hospital_id: hospitalId,
    valid_until: { $or: [null, { $gt: new Date() }] }
  });

  return !!permission && permission.permissions.can_read;
}
```

---

## 六、工具调用与权限路由

### 6.1 工具注册系统

每个工具注册时声明权限要求：

```typescript
ToolRegistry.register({
  name: 'query_hospital_data',
  description: '查询医院基本信息、联系人等',
  requiredRoles: ['销售代表', '地区经理', '医学总监'],
  requiredPermission: { resource: 'hospital_data', action: 'read' },

  // 数据级别权限检查
  dataPermissionCheck: async (params, userId) => {
    return await canAccessHospital(userId, params.hospitalId);
  },

  handler: async (params, userId) => {
    return await crmAPI.getHospitalData(params.hospitalId);
  },

  involvesPhi: true,  // 涉及患者健康信息
  sanitizeResponse: true  // 自动脱敏
});
```

### 6.2 工具调用流程

1. **权限检查**：角色 → 功能权限 → 数据权限（三层）
2. **审计记录**：所有工具调用记录到审计日志
3. **自动脱敏**：响应数据根据用户角色脱敏
4. **错误处理**：权限不足时友好提示

---

## 七、数据脱敏与医药合规

### 7.1 敏感信息检测

```typescript
// 发送到 LLM 前自动脱敏
const patterns = {
  idCard: /\b[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
  phone: /\b1[3-9]\d{9}\b/g,
  chineseName: /[\u4e00-\u9fa5]{2,3}(先生|女士|医生|教授)/g,
  medicalCard: /\b\d{10,20}\b/g
};

// 脱敏处理
export function sanitizeForLLM(text: string) {
  const mapping = new Map();
  let sanitized = text;

  // 替换为占位符：[身份证号_1], [手机号_2]
  sanitized = sanitized.replace(patterns.phone, (match) => {
    const placeholder = `[手机号_${mapping.size + 1}]`;
    mapping.set(placeholder, match);
    return placeholder;
  });

  // ... 其他模式替换

  return { sanitized, mapping };
}
```

### 7.2 审计日志

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  request_data JSONB,
  response_data JSONB,
  involves_phi BOOLEAN DEFAULT FALSE,
  phi_sanitized BOOLEAN DEFAULT TRUE,
  risk_level VARCHAR(20) DEFAULT 'low',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**审计能力：**
- 所有 API 调用记录
- 工具调用记录
- 数据访问记录
- 风险操作告警
- 月度/季度合规报告

---

## 八、飞书集成

### 8.1 SSO 单点登录

```typescript
// 飞书 OAuth2 流程
export class FeishuAuthService {
  // 1. 生成授权 URL
  getAuthUrl(redirectUri: string) {
    return `https://open.feishu.cn/authen/v1/authorize?${params}`;
  }

  // 2. 回调处理，换取 access_token
  async handleCallback(code: string) {
    const tokenResp = await axios.post(
      'https://open.feishu.cn/authen/v1/access_token',
      { app_id, app_secret, grant_type: 'authorization_code', code }
    );

    // 3. 获取用户信息
    const userResp = await axios.get(
      'https://open.feishu.cn/authen/v1/user_info',
      { headers: { Authorization: `Bearer ${tokenResp.data.data.access_token}` } }
    );

    // 4. 同步到本地数据库
    return await this.syncUser(userResp.data.data);
  }
}
```

### 8.2 IM 机器人

```typescript
// 处理飞书消息事件
export class FeishuBotService {
  async handleEvent(event: FeishuEvent) {
    const user = await identifyUser(event.sender.sender_id.user_id);

    // 从 Redis 加载会话状态（无状态架构）
    const sessionKey = `session:${user.id}:${event.chat_type}`;
    let session = await redis.get(sessionKey);

    // 调用 AI 助手
    const response = await openclawEngine.process({
      message: extractMessageContent(event.message),
      userId: user.id,
      ragContext: await hybridSearch(user.id, message)
    });

    // 发送回复到飞书
    await sendMessage(event.message.message_id, response.text);

    // 更新会话状态到 Redis（1 小时过期）
    await redis.setex(sessionKey, 3600, JSON.stringify(session));
  }
}
```

---

## 九、用户工作空间（完全隔离）

### 9.1 工作空间结构

```
/data/workspaces/
├── {user_id_1}/
│   ├── documents/          # 上传的文件
│   │   ├── file-uuid-1.pdf
│   │   └── file-uuid-2.docx
│   ├── knowledge/          # 知识库条目
│   └── cache/              # 临时文件
├── {user_id_2}/
│   └── ...
```

### 9.2 文件管理 API

```typescript
// 上传文件（自动向量化）
POST /workspace/files
- 接收文件上传
- 保存到用户独立目录
- 提取文本内容
- 自动向量化到私有向量库
- 记录到数据库

// 列出文件
GET /workspace/files?category=xxx&tags=xxx
- 只返回当前用户的文件
- 支持按分类、标签过滤
- 支持全文搜索

// 删除文件
DELETE /workspace/files/:fileId
- 删除物理文件
- 删除向量库中的向量
- 清理数据库记录

// 更新元数据
PATCH /workspace/files/:fileId
- 更新文件描述、标签、分类
- 自动重新向量化
```

### 9.3 知识库管理 API

```typescript
// 添加知识条目
POST /workspace/knowledge
- 手动添加知识点
- 自动向量化
- 支持标题、内容、标签

// 更新知识条目
PUT /workspace/knowledge/:entryId
- 更新内容后重新向量化
- 保持向量库同步

// 删除知识条目
DELETE /workspace/knowledge/:entryId
- 同步删除向量
```

### 9.4 存储配额管理

```sql
CREATE TABLE user_workspaces (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) UNIQUE,
  storage_quota bigint DEFAULT 1073741824,  -- 1GB
  storage_used bigint DEFAULT 0
);
```

---

## 十、无状态架构与部署

### 10.1 无状态设计原则

- **会话状态**：全部存 Redis，设置过期时间
- **文件存储**：共享存储（NFS / 对象存储）
- **数据库**：有状态层，通过连接池访问
- **任意节点**：可处理任意用户请求

### 10.2 Kubernetes 部署

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openclaw-gateway
spec:
  replicas: 3  # 3 个实例，无状态可任意扩容
  template:
    spec:
      containers:
      - name: gateway
        image: openclaw-enterprise:latest
        env:
        - name: DATABASE_URL
          valueFrom: { secretKeyRef: { name: db-secret, key: url } }
        - name: REDIS_URL
          valueFrom: { secretKeyRef: { name: redis-secret, key: url } }
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: openclaw-gateway-service
spec:
  type: LoadBalancer
  selector:
    app: openclaw-gateway
  ports:
  - port: 80
    targetPort: 3000
```

### 10.3 水平扩展

- **CPU/内存**：K8s HPA 自动扩缩容
- **数据库**：连接池限制，防止耗尽
- **Redis**：哨兵模式/集群模式
- **Milvus**：分布式部署

---

## 十一、监控与运维

### 11.1 Prometheus 指标

```typescript
// 业务指标
- openclaw_http_requests_total           // API 请求总数
- openclaw_http_request_duration_seconds // API 响应时间
- openclaw_ai_messages_total             // AI 消息处理数
- openclaw_ai_tokens_total               // Token 使用量
- openclaw_tool_calls_total              // 工具调用次数
- openclaw_permission_denied_total       // 权限拒绝次数
- openclaw_active_users                  // 活跃用户数
- openclaw_feishu_message_lag_seconds    // 飞书消息延迟
- openclaw_db_pool_connections           // 数据库连接数
```

### 11.2 告警规则

```yaml
# API 错误率过高
- alert: HighErrorRate
  expr: rate(openclaw_http_requests_total{status_code=~"5.."}[5m]) > 0.05
  for: 5m
  severity: critical

# API 响应缓慢
- alert: SlowResponseTime
  expr: histogram_quantile(0.95, rate(openclaw_http_request_duration_seconds_bucket[5m])) > 5
  for: 10m
  severity: warning

# AI Token 消耗过快
- alert: HighAICost
  expr: rate(openclaw_ai_tokens_total[1h]) > 100000
  for: 30m
  severity: warning

# 数据库连接池耗尽
- alert: DatabaseConnectionPoolExhausted
  expr: openclaw_db_pool_connections{state="waiting"} > 10
  for: 5m
  severity: critical
```

### 11.3 健康检查

```typescript
GET /health
{
  "status": "healthy",  // healthy | degraded | unhealthy
  "checks": {
    "database": { "status": "ok", "connections": 10 },
    "redis": { "status": "ok" },
    "milvus": { "status": "ok" },
    "llm": { "status": "ok", "model": "claude-opus-4-5" },
    "disk": { "status": "ok", "usage": "45.23%", "available": "55.2GB" }
  }
}
```

---

## 十二、安全与合规

### 12.1 数据安全

- **传输加密**：全站 HTTPS/TLS
- **存储加密**：敏感数据 AES-256 加密
- **访问控制**：三层权限隔离
- **审计日志**：所有操作可追溯
- **定期备份**：数据库每日备份

### 12.2 医药合规

- **自动脱敏**：患者信息、身份证、手机号
- **审计报告**：月度/季度合规报告
- **权限管理**：细粒度数据访问控制
- **操作留痕**：所有数据访问记录
- **风险告警**：异常操作实时通知

---

## 十三、实施路线图

### Phase 1: 核心架构（4-6 周）

- [ ] 多租户数据库设计和实现
- [ ] 飞书 SSO 登录集成
- [ ] 基础权限系统（RBAC）
- [ ] 无状态 API 网关
- [ ] Docker 容器化

### Phase 2: AI 能力（3-4 周）

- [ ] 双层 RAG 知识库
- [ ] 工具调用系统
- [ ] 数据脱敏层
- [ ] 飞书 IM 机器人

### Phase 3: 工作空间（2-3 周）

- [ ] 用户工作空间隔离
- [ ] 文件上传/管理
- [ ] 自动向量化
- [ ] 知识库管理 API

### Phase 4: 监控运维（2 周）

- [ ] Prometheus 指标
- [ ] 告警系统
- [ ] 日志系统
- [ ] 健康检查

### Phase 5: 测试上线（2-3 周）

- [ ] 单元测试
- [ ] 集成测试
- [ ] 压力测试（1000 并发）
- [ ] 灰度发布
- [ ] 用户培训

**总计：13-18 周**

---

## 十四、成本估算

### 基础设施（月度，1000 用户规模）

| 项目 | 配置 | 数量 | 单价 | 月成本 |
|-----|------|------|------|--------|
| K8s 节点 | 4C16G | 3 | ¥800/台 | ¥2,400 |
| PostgreSQL | 4C8G | 1 | ¥600/台 | ¥600 |
| Redis | 2C4G | 1 | ¥300/台 | ¥300 |
| Milvus | 4C16G | 1 | ¥800/台 | ¥800 |
| 对象存储 | 1TB | 1 | ¥0.1/GB | ¥100 |
| 飞书费用 | - | - | - | ¥0（免费版） |
| **小计** | | | | **¥4,200** |

### AI 成本（月度）

| 模型 | 次数/天 | Token/次 | Token/月 | 单价 | 月成本 |
|-----|---------|----------|----------|------|--------|
| Claude Opus | 50 | 5000 | 7.5M | ¥0.015/1K | ¥1,125 |
| Claude Sonnet | 100 | 3000 | 9M | ¥0.0075/1K | ¥675 |
| **小计** | | | 16.5M | | **¥1,800** |

**总月度成本：约 ¥6,000（可随用量优化）**

---

## 十五、风险与挑战

### 15.1 技术风险

| 风险 | 影响 | 缓解措施 |
|-----|------|----------|
| 并发性能瓶颈 | 用户体验差 | 压力测试，Redis 缓存，水平扩展 |
| 向量库性能 | 检索慢 | Milvus 集群，索引优化 |
| 飞书 API 限流 | 消息延迟 | 消息队列，重试机制 |

### 15.2 合规风险

| 风险 | 影响 | 缓解措施 |
|-----|------|----------|
| 数据泄露 | 法律风险 | 脱敏层，权限控制，审计日志 |
| 合规审计 | 罚款 | 自动化合规报告，操作留痕 |

---

## 十六、未来扩展

### 16.1 可能的增强功能

- **语音交互**：支持语音输入和语音回复
- **多模型路由**：根据问题类型自动选择模型
- **AI 生图**：生成医学示意图、宣传物料
- **智能报表**：自动生成销售数据分析报告
- **智能推荐**：基于历史数据推荐拜访策略

### 16.2 多租户 SaaS 化

- 支持多个医药公司独立部署
- 每个公司完全隔离的数据和配置
- 租户级别的计费和管理

---

## 附录：关键配置示例

### A.1 环境变量

```bash
# 数据库
DATABASE_URL=postgresql://user:pass@postgres:5432/openclaw

# Redis
REDIS_URL=redis://redis:6379

# 飞书
FEISHU_APP_ID=cli_xxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxx
FEISHU_ENCRYPT_KEY=xxxxxxxxx
FEISHU_VERIFICATION_TOKEN=xxxxxxxxx

# AI 模型
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxx

# Milvus
MILVUS_HOST=milvus
MILVUS_PORT=19530

# 存储
WORKSPACE_BASE_PATH=/data/workspaces
STORAGE_QUOTA_DEFAULT=1073741824  # 1GB
```

### A.2 Docker Compose（开发环境）

```yaml
version: '3.8'
services:
  openclaw-gateway:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/openclaw
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
      - milvus

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: openclaw
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  milvus:
    image: milvusdb/milvus:latest
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    depends_on:
      - etcd
      - minio

  etcd:
    image: quay.io/coreos/etcd:latest
    volumes:
      - etcd_data:/etcd

  minio:
    image: minio/minio:latest
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    volumes:
      - minio_data:/minio_data
    command: minio server /minio_data

volumes:
  postgres_data:
  redis_data:
  etcd_data:
  minio_data:
```

---

**文档版本：** v1.0
**最后更新：** 2026-02-01
**作者：** Claude Sonnet 4.5
