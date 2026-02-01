@echo off
REM OpenClaw Feishu Plugin 发布脚本 - Windows 版本

setlocal enabledelayedexpansion

echo ========================================
echo   OpenClaw Feishu Plugin 发布工具
echo ========================================
echo.

REM 检查是否已登录 npm
echo [1/5] 检查 npm 登录状态...
npm whoami >nul 2>&1
if errorlevel 1 (
    echo ❌ 未登录 npm，请先运行: npm login
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm whoami') do set NPM_USER=%%i
echo ✅ npm 已登录: !NPM_USER!
echo.

REM 构建项目
echo [2/5] 构建项目...
cd /d "%~dp0.."
call pnpm build
if errorlevel 1 (
    echo ❌ 构建失败
    pause
    exit /b 1
)
echo ✅ 构建完成
echo.

REM 检查将要发布的内容
echo [3/5] 检查发布内容...
call npm pack --dry-run
echo.

REM 确认发布
echo [4/5] 确认发布...
set /p CONFIRM="确认发布? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo ❌ 取消发布
    pause
    exit /b 1
)
echo.

REM 发布到 npm
echo [5/5] 发布到 npm...
call npm publish --access public
if errorlevel 1 (
    echo ❌ 发布失败
    pause
    exit /b 1
)
echo.

REM 验证
echo ✅ 验证发布...
call npm view @timoxue/openclaw-feishu
echo.

echo ========================================
echo   🎉 发布成功！
echo ========================================
echo.
echo 📍 包地址: https://www.npmjs.com/package/@timoxue/openclaw-feishu
echo 📍 仓库: https://github.com/timoxue/openclaw-feishu
echo.
pause
