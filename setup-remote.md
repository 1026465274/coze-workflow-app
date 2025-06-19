# 🚀 设置远程仓库指南

## 第一步：在 GitHub 创建仓库

1. 访问 [GitHub.com](https://github.com) 并登录
2. 点击右上角的 "+" → "New repository"
3. 填写仓库信息：
   ```
   Repository name: coze-workflow-app
   Description: 🌸 少女风格的 Coze 工作流 API 调用应用
   Public ✅ (推荐，这样可以免费部署到 Vercel)
   不要勾选 "Add a README file"
   不要勾选 "Add .gitignore"
   可以选择 "MIT License"
   ```
4. 点击 "Create repository"

## 第二步：连接本地仓库到远程

创建仓库后，GitHub 会显示一个页面，复制其中的 HTTPS URL（类似：`https://github.com/yourusername/coze-workflow-app.git`）

然后在项目目录中运行以下命令：

```bash
# 添加远程仓库（替换 YOUR_USERNAME 为您的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/coze-workflow-app.git

# 推送代码到远程仓库
git branch -M main
git push -u origin main
```

## 第三步：验证推送成功

推送成功后，刷新 GitHub 页面，您应该能看到所有文件已经上传。

## 第四步：部署到 Vercel

1. 访问 [Vercel.com](https://vercel.com) 并登录
2. 点击 "New Project"
3. 选择 "Import Git Repository"
4. 选择您刚创建的 `coze-workflow-app` 仓库
5. 点击 "Import"
6. 在 "Environment Variables" 部分添加：
   ```
   COZE_API_KEY=your_coze_api_key_here
   COZE_WORKFLOW_ID=your_workflow_id_here
   ```
7. 点击 "Deploy"

## 🎉 完成！

部署成功后，Vercel 会提供一个 URL，您的少女风格 Coze 魔法工作流应用就可以在线访问了！

## 📝 备用命令

如果您需要，以下是一些有用的 Git 命令：

```bash
# 查看当前状态
git status

# 查看远程仓库
git remote -v

# 添加所有文件
git add .

# 提交更改
git commit -m "更新描述"

# 推送到远程
git push origin main
```

## 🔧 故障排除

### 如果推送失败：

1. **认证问题**：确保您已登录 GitHub，可能需要设置 Personal Access Token
2. **分支名称**：确保使用 `main` 分支而不是 `master`
3. **网络问题**：检查网络连接

### 如果需要重新设置远程仓库：

```bash
# 删除现有远程仓库
git remote remove origin

# 重新添加
git remote add origin https://github.com/YOUR_USERNAME/coze-workflow-app.git
```
