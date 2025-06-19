# 本地开发指南

## 🚀 快速开始

### 方法一：简单本地服务器（推荐用于界面开发）

```bash
npm run dev-simple
```

这将启动一个简单的静态文件服务器，访问 http://localhost:3000

**特点：**
- ✅ 快速启动，无需额外配置
- ✅ 自动使用模拟 API 响应
- ✅ 适合界面开发和样式调试
- ❌ 无法测试真实的 Coze API 调用

### 方法二：Vercel 本地开发服务器（推荐用于完整功能测试）

```bash
# 首先安装 Vercel CLI（如果还没有安装）
npm install -g vercel

# 启动 Vercel 本地开发服务器
npm run dev
```

**特点：**
- ✅ 完全模拟 Vercel 生产环境
- ✅ 可以测试真实的 Serverless Function
- ✅ 支持环境变量
- ❌ 需要配置 Coze API 密钥

## 🔧 本地开发模式说明

### 自动检测开发环境

项目已经配置了智能环境检测：

- **本地开发环境**（localhost:3000）：自动使用模拟 API 响应
- **生产环境**（Vercel 部署）：调用真实的 Coze API

### 模拟 API 响应

在本地开发环境中，点击"执行工作流"按钮会：

1. 显示加载动画（1.5秒）
2. 返回模拟的工作流结果
3. 展示格式化的 JSON 信息

模拟响应包含：
- 您的输入内容
- 模拟的处理结果
- 时间戳和元数据
- 开发模式标识

## 🛠️ 配置真实 API（可选）

如果您想在本地测试真实的 Coze API：

### 1. 获取 Coze API 信息

- **API Key**: 在 [Coze 控制台](https://www.coze.cn/open/oauth/pats) 创建 Personal Access Token
- **Workflow ID**: 从您的工作流 URL 中获取

### 2. 配置环境变量

编辑 `.env.local` 文件：

```bash
# 替换为您的真实值
COZE_API_KEY=pat_your_actual_api_key_here
COZE_WORKFLOW_ID=your_actual_workflow_id_here
```

### 3. 使用 Vercel 本地开发

```bash
npm run dev
```

这将启动 Vercel 本地开发服务器，可以测试真实的 API 调用。

## 🎨 界面开发技巧

### 实时预览样式更改

1. 启动开发服务器：`npm run dev-simple`
2. 在编辑器中修改 `style.css`
3. 刷新浏览器查看更改

### 测试不同的输入内容

在模拟模式下，您可以测试各种输入内容：
- 短文本
- 长文本
- 特殊字符
- 多行内容

### 调试 JavaScript

1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签页的日志
3. 在 Network 标签页查看请求（生产模式）

## 🔍 故障排除

### 问题：页面无法加载

**解决方案：**
```bash
# 检查端口是否被占用
netstat -ano | findstr :3000

# 或者使用不同端口
npx serve . -p 3001
```

### 问题：样式显示异常

**解决方案：**
1. 检查 `style.css` 文件路径
2. 清除浏览器缓存（Ctrl+F5）
3. 检查控制台是否有 CSS 加载错误

### 问题：JavaScript 功能异常

**解决方案：**
1. 打开浏览器开发者工具
2. 查看 Console 中的错误信息
3. 检查 `script.js` 文件是否正确加载

### 问题：模拟 API 不工作

**检查项：**
1. 确认访问的是 `localhost:3000`
2. 检查浏览器控制台是否显示"本地开发模式"日志
3. 确认 JavaScript 没有语法错误

## 📝 开发工作流建议

### 1. 界面开发阶段
```bash
npm run dev-simple
```
- 专注于 HTML/CSS 开发
- 快速迭代样式更改
- 测试响应式设计

### 2. 功能测试阶段
```bash
npm run dev
```
- 配置真实 API 密钥
- 测试完整的工作流程
- 验证错误处理

### 3. 部署前检查
- 确认所有文件已提交到 Git
- 测试生产环境配置
- 验证环境变量设置

## 🚀 部署到生产环境

完成本地开发后，按照 `DEPLOYMENT.md` 中的指南部署到 Vercel：

1. 推送代码到 GitHub
2. 在 Vercel 导入项目
3. 配置生产环境变量
4. 测试部署的应用

## 💡 开发技巧

### 快速重启服务器
```bash
# Ctrl+C 停止服务器，然后重新启动
npm run dev-simple
```

### 查看实时日志
在浏览器开发者工具的 Console 中查看应用日志。

### 测试不同屏幕尺寸
使用浏览器的响应式设计模式（F12 → 设备工具栏）测试移动端显示效果。
