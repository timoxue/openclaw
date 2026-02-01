# 贡献指南

感谢你有兴趣为 `@timoxue/openclaw-feishu` 做贡献！

## 如何贡献

### 报告 Bug

如果你发现了 bug，请：

1. 检查 [Issues](https://github.com/timoxue/openclaw-feishu/issues) 确保问题还没有被报告
2. 创建一个新的 Issue，包含：
   - 清晰的标题
   - 详细的 bug 描述
   - 重现步骤
   - 期望行为
   - 实际行为
   - 环境信息（Node.js 版本、操作系统等）
   - 相关日志或截图

### 建议新功能

如果你有好的功能建议：

1. 先检查 [Issues](https://github.com/timoxue/openclaw-feishu/issues) 确保类似功能还没有被建议
2. 创建一个 Feature Request Issue，包含：
   - 功能描述
   - 使用场景
   - 可能的实现方案
   - 示例代码（可选）

### 提交代码

#### 准备工作

1. **Fork 仓库**
   ```bash
   # 在 GitHub 上点击 Fork 按钮
   ```

2. **克隆你的 Fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/openclaw-feishu.git
   cd openclaw-feishu
   ```

3. **安装依赖**
   ```bash
   npm install
   ```

4. **构建项目**
   ```bash
   npm run build
   ```

#### 开发流程

1. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

2. **编写代码**
   - 遵循现有代码风格
   - 添加必要的注释
   - 更新相关文档

3. **编写测试**
   ```bash
   # 运行测试
   npm test
   ```

4. **提交更改**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   # 或
   git commit -m "fix: fix bug description"
   ```

   **提交信息格式**：
   - `feat:` 新功能
   - `fix:` Bug 修复
   - `docs:` 文档更新
   - `style:` 代码格式（不影响功能）
   - `refactor:` 代码重构
   - `test:` 测试相关
   - `chore:` 构建/工具相关

5. **推送到 GitHub**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **创建 Pull Request**
   - 访问 https://github.com/timoxue/openclaw-feishu
   - 点击 "New Pull Request"
   - 填写 PR 模板
   - 等待审核

#### 代码规范

- **TypeScript**: 使用 TypeScript 编写，确保类型安全
- **ESLint**: 遵循 ESLint 规则
- **注释**: 为复杂逻辑添加注释
- **文档**: 更新 README 和相关文档

#### Pull Request 检查清单

- [ ] 代码通过所有测试
- [ ] 代码符合项目风格
- [ ] 添加了必要的注释
- [ ] 更新了相关文档
- [ ] 提交信息清晰明确
- [ ] PR 描述详细说明了更改内容

## 开发环境

### 项目结构

```
openclaw-feishu/
├── src/
│   ├── channel.ts      # 频道插件主实现
│   ├── client.ts       # 飞书客户端
│   ├── events.ts       # 事件处理
│   └── runtime.ts      # 运行时
├── index.ts            # 插件入口
├── package.json        # 包配置
├── README.md           # 使用文档
└── CHANGELOG.md        # 更新日志
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式
npm run test:watch
```

### 构建项目

```bash
# 开发构建
npm run build:dev

# 生产构建
npm run build

# 监听模式
npm run build:watch
```

### 本地测试

在本地测试插件：

1. **链接到本地 OpenClaw**
   ```bash
   cd D:\openclaw\extensions\feishu
   npm link

   cd D:\openclaw
   npm link @timoxue/openclaw-feishu
   ```

2. **启动 Gateway**
   ```bash
   npx openclaw gateway
   ```

3. **测试功能**
   - 发送飞书消息
   - 查看日志输出
   - 验证功能正常

## 发布流程

发布由维护者负责：

1. 更新版本号
   ```bash
   npm version patch  # 或 minor, major
   ```

2. 更新 CHANGELOG.md

3. 创建 Git 标签
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

4. 发布到 npm
   ```bash
   npm publish --access public
   ```

## 行为准则

- 尊重所有贡献者
- 欢迎不同观点和建设性反馈
- 关注解决问题而非指责个人
- 保持友善和专业

## 获取帮助

如果你有任何问题：

- 📧 Email: timo@xue.me
- 💬 Discussions: https://github.com/timoxue/openclaw-feishu/discussions
- 🐛 Issues: https://github.com/timoxue/openclaw-feishu/issues

## 许可证

贡献的代码将采用 [MIT License](LICENSE)。

---

再次感谢你的贡献！🎉
