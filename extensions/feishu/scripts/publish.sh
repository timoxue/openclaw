#!/bin/bash

# OpenClaw Feishu Plugin 发布脚本

set -e

echo "🚀 开始发布 @timoxue/openclaw-feishu"
echo ""

# 检查是否已登录 npm
echo "📋 检查 npm 登录状态..."
if ! npm whoami &> /dev/null; then
    echo "❌ 未登录 npm，请先运行: npm login"
    exit 1
fi

echo "✅ npm 已登录: $(npm whoami)"
echo ""

# 运行测试
echo "🧪 运行测试..."
# npm test  # 如果有测试的话
echo "⚠️  跳过测试（未配置）"
echo ""

# 构建项目
echo "🔨 构建项目..."
cd "$(dirname "$0")/.."
pnpm build
echo "✅ 构建完成"
echo ""

# 检查将要发布的内容
echo "📦 检查发布内容..."
npm pack --dry-run
echo ""

# 确认发布
read -p "确认发布? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消发布"
    exit 1
fi

# 发布到 npm
echo "📤 发布到 npm..."
npm publish --access public
echo ""

# 验证
echo "✅ 验证发布..."
npm view @timoxue/openclaw-feishu | head -n 20
echo ""

echo "🎉 发布成功！"
echo "📍 包地址: https://www.npmjs.com/package/@timoxue/openclaw-feishu"
echo "📍 仓库: https://github.com/timoxue/openclaw-feishu"
