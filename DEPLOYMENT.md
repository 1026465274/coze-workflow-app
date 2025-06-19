# 部署指南

## 🚀 快速部署到 Vercel

### 步骤 1: 准备 Coze API 信息

在开始部署之前，您需要准备以下信息：

1. **Coze Personal Access Token (PAT)**
   - 访问 [Coze 控制台](https://www.coze.cn/open/oauth/pats)
   - 创建一个新的 Personal Access Token
   - 复制生成的 token（格式类似：`pat_xxx...`）

2. **Coze 工作流 ID**
   - 在 Coze 平台创建或选择一个工作流
   - 从工作流页面的 URL 中获取 ID（格式类似：`7389xxx...`）

### 步骤 2: 部署到 Vercel

#### 方法一：通过 GitHub（推荐）

1. **推送代码到 GitHub**
   ```bash
   git add .
   git commit -m "Initial commit: Coze Workflow App"
   git remote add origin https://github.com/yourusername/coze-workflow-app.git
   git push -u origin main
   ```

2. **在 Vercel 导入项目**
   - 访问 [Vercel](https://vercel.com)
   - 点击 "New Project"
   - 选择 "Import Git Repository"
   - 选择您的 GitHub 仓库
   - 点击 "Import"

3. **配置环境变量**
   - 在项目导入后，进入项目设置
   - 找到 "Environment Variables" 部分
   - 添加以下环境变量：
     - `COZE_API_KEY`: 您的 Coze Personal Access Token
     - `COZE_WORKFLOW_ID`: 您的工作流 ID

4. **部署**
   - 点击 "Deploy" 按钮
   - 等待部署完成

#### 方法二：通过 Vercel CLI

1. **安装 Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **部署项目**
   ```bash
   vercel
   ```

4. **设置环境变量**
   ```bash
   vercel env add COZE_API_KEY
   vercel env add COZE_WORKFLOW_ID
   ```

5. **重新部署以应用环境变量**
   ```bash
   vercel --prod
   ```

### 步骤 3: 验证部署

1. **访问您的应用**
   - Vercel 会提供一个 URL（如：`https://your-app.vercel.app`）
   - 在浏览器中打开这个 URL

2. **测试功能**
   - 在输入框中输入一些测试内容
   - 点击 "执行工作流" 按钮
   - 检查是否能正常获取结果

## 🔧 故障排除

### 常见问题

#### 1. API 调用失败
**错误信息**: "API 密钥未配置" 或 "工作流 ID 未配置"

**解决方案**:
- 检查 Vercel 项目设置中的环境变量是否正确设置
- 确保环境变量名称完全匹配：`COZE_API_KEY` 和 `COZE_WORKFLOW_ID`
- 重新部署项目以应用环境变量更改

#### 2. CORS 错误
**错误信息**: "Access to fetch at ... has been blocked by CORS policy"

**解决方案**:
- 这通常在本地开发时出现
- 确保使用 `/api/run-workflow` 端点而不是直接调用 Coze API
- 检查 `vercel.json` 中的 CORS 配置

#### 3. 工作流执行失败
**错误信息**: "Coze API 返回错误: 400/401/403"

**解决方案**:
- 验证 Coze API Token 是否有效且未过期
- 确认工作流 ID 是否正确
- 检查工作流是否已发布且可访问
- 确认 API Token 有访问该工作流的权限

#### 4. 部署失败
**错误信息**: Build 或 deployment 失败

**解决方案**:
- 检查 `package.json` 格式是否正确
- 确保所有必需文件都已提交到 Git
- 查看 Vercel 部署日志获取详细错误信息
- 确认 Node.js 版本兼容性

### 调试技巧

1. **查看 Vercel 函数日志**
   - 在 Vercel 控制台的 "Functions" 标签页查看日志
   - 检查 API 调用的详细错误信息

2. **本地测试**
   ```bash
   # 创建本地环境变量文件
   cp .env.example .env.local
   # 编辑 .env.local 填入真实值
   
   # 启动本地服务器
   npm run dev
   ```

3. **检查网络请求**
   - 使用浏览器开发者工具的 Network 标签页
   - 查看 API 请求和响应的详细信息

## 📝 自定义配置

### 修改 Coze API 端点

如果需要使用不同的 Coze API 端点，请修改 `api/run-workflow.js` 文件中的 `cozeApiUrl` 变量：

```javascript
const cozeApiUrl = 'https://api.coze.cn/v1/workflow/run'; // 修改为您需要的端点
```

### 自定义样式

您可以通过修改 `style.css` 文件来自定义界面样式：

```css
/* 修改主色调 */
:root {
  --primary-color: #00ffff; /* 青色 */
  --secondary-color: #ff00ff; /* 紫色 */
}
```

### 添加新功能

要添加新功能，您可以：

1. 修改 `index.html` 添加新的 UI 元素
2. 在 `style.css` 中添加相应的样式
3. 在 `script.js` 中添加交互逻辑
4. 如需要，修改 `api/run-workflow.js` 添加新的 API 处理逻辑

## 🔒 安全注意事项

1. **永远不要在前端代码中暴露 API 密钥**
2. **使用环境变量存储敏感信息**
3. **定期轮换 API 密钥**
4. **监控 API 使用情况**
5. **设置适当的 CORS 策略**

## 📞 获取帮助

如果您在部署过程中遇到问题：

1. 检查本文档的故障排除部分
2. 查看 [Vercel 官方文档](https://vercel.com/docs)
3. 查看 [Coze API 文档](https://www.coze.cn/docs)
4. 在项目 GitHub 仓库提交 Issue
