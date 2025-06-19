# 🌸 GitHub CLI 安装和设置指南

## 📥 安装 GitHub CLI

### 推荐方法：直接下载安装包

1. **访问下载页面**
   - 打开 [https://cli.github.com/](https://cli.github.com/)
   - 点击 "Download for Windows"

2. **安装**
   - 下载 `gh_x.x.x_windows_amd64.msi` 文件
   - 双击运行安装程序
   - 按照向导完成安装
   - **重要**: 安装完成后重启 PowerShell 或命令提示符

## 🔐 登录和认证

安装完成后，在项目目录中运行以下命令：

```bash
# 1. 验证安装
gh --version

# 2. 登录 GitHub
gh auth login
```

登录时选择：
- `GitHub.com`
- `HTTPS`
- `Login with a web browser` (推荐)

## 🚀 创建远程仓库并推送

登录成功后，运行以下命令：

```bash
# 1. 创建远程仓库
gh repo create coze-workflow-app --public --description "🌸 少女风格的 Coze 工作流 API 调用应用"

# 2. 添加所有文件
git add .

# 3. 提交代码
git commit -m "✨ Initial commit: 少女风格 Coze 魔法工作流应用

🌸 功能特点:
- 少女风格界面设计 (粉色系渐变背景)
- 安全的 Vercel Serverless Function API 代理
- 本地开发模式支持 (自动模拟 API 响应)
- 响应式设计适配各种设备
- 可爱的动画效果和装饰元素
- 温馨的用户体验和文案"

# 4. 推送到远程仓库
git push -u origin main
```

## 🎉 成功后的步骤

### 1. 验证仓库创建
```bash
# 查看远程仓库信息
gh repo view

# 在浏览器中打开仓库
gh repo view --web
```

### 2. 部署到 Vercel

仓库创建成功后：

1. 访问 [Vercel.com](https://vercel.com)
2. 点击 "New Project"
3. 选择您的 `coze-workflow-app` 仓库
4. 添加环境变量：
   ```
   COZE_API_KEY=your_coze_api_key_here
   COZE_WORKFLOW_ID=your_workflow_id_here
   ```
5. 点击 "Deploy"

## 🔧 故障排除

### 如果 `gh` 命令不被识别：

1. **重启终端**: 关闭并重新打开 PowerShell
2. **检查 PATH**: 确保 GitHub CLI 已添加到系统 PATH
3. **重新安装**: 如果仍有问题，重新下载并安装

### 如果登录失败：

1. **检查网络**: 确保能访问 GitHub.com
2. **使用 Token**: 可以选择使用 Personal Access Token 登录
3. **防火墙**: 检查防火墙是否阻止了连接

### 如果创建仓库失败：

1. **检查仓库名**: 确保名称没有被占用
2. **权限问题**: 确保已正确登录并有创建仓库的权限

## 📝 备用方案

如果 GitHub CLI 安装有问题，您也可以：

1. **手动在 GitHub 网站创建仓库**
2. **使用我之前提供的 `setup-remote.md` 指南**
3. **通过 Git 命令连接远程仓库**

## 🌟 完成后的好处

使用 GitHub CLI 的优势：
- ✅ 一键创建仓库
- ✅ 自动设置远程连接
- ✅ 命令行管理 Issues 和 PR
- ✅ 快速部署和管理

安装完成后，您就可以轻松管理 GitHub 仓库了！🎉
