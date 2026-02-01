# 更新日志

本文档记录了 `@timoxue/openclaw-feishu` 的所有重要更改。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-02-01

### 新增
- ✨ 飞书（Lark）频道插件初始版本
- ✅ 支持私聊消息接收与发送
- ✅ 支持群聊消息接收与发送（@机器人）
- ✅ WebSocket 长连接模式（开发环境）
- ✅ Webhook 回调模式（生产环境）
- ✅ 多账号支持
- ✅ 事件订阅：`im.message.receive_v1`
- ✅ 完整的 TypeScript 类型定义
- ✅ 详细的中文文档

### 依赖
- @larksuiteoapi/node-sdk: ^1.24.0

### OpenClaw 兼容性
- 最低版本: 2026.1.0

---

## 未来计划

### v1.1.0 (计划中)
- [ ] 支持富文本消息
- [ ] 支持卡片消息
- [ ] 支持图片/文件上传
- [ ] 支持消息撤回
- [ ] 支持已读回执

### v1.2.0 (计划中)
- [ ] 支持群组管理功能
- [ ] 支持用户信息获取
- [ ] 支持部门信息获取
- [ ] 性能优化和错误处理增强

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件
