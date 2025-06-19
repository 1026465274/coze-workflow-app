# Coze 魔法工作流 ✨

一个具有少女风格界面的 Coze 工作流 API 调用表单，部署在 Vercel 上。

## 功能特点

- 🌸 **少女风格界面**: 采用粉色系渐变设计，温柔的色彩搭配，可爱的装饰元素
- 🔒 **安全的 API 调用**: 通过 Vercel Serverless Function 代理，保护 API 密钥
- 📱 **响应式设计**: 适配各种屏幕尺寸
- ⚡ **实时反馈**: 可爱的加载动画、友好的错误提示、美观的结果展示
- 🎨 **动画效果**: 渐变显示、闪烁特效、平滑过渡
- 💕 **可爱元素**: 表情符号装饰、少女风格的文案、温馨的用户体验

## 技术栈

- **前端**: HTML5, CSS3, Vanilla JavaScript
- **后端**: Vercel Serverless Functions (Node.js)
- **部署**: Vercel
- **API**: Coze Workflow API

## 本地开发

### 快速开始（推荐）

1. 克隆项目
```bash
git clone <your-repo-url>
cd coze-workflow-app
```

2. 启动开发服务器
```bash
npm run dev-simple
```

3. 打开浏览器访问 http://localhost:3000

**注意：** 本地开发模式会自动使用模拟 API 响应，无需配置真实的 Coze API 密钥。

### 完整功能测试（可选）

如果需要测试真实的 Coze API 调用：

1. 安装 Vercel CLI
```bash
npm install -g vercel
```

2. 创建环境变量文件 `.env.local`
```
COZE_API_KEY=your_coze_api_key_here
COZE_WORKFLOW_ID=your_workflow_id_here
```

3. 启动 Vercel 开发服务器
```bash
npm run dev
```

详细的本地开发指南请查看 [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)

## 部署到 Vercel

### 方法一：通过 Vercel CLI

1. 安装 Vercel CLI
```bash
npm i -g vercel
```

2. 登录并部署
```bash
vercel
```

3. 在 Vercel 控制台设置环境变量：
   - `COZE_API_KEY`: 你的 Coze Personal Access Token
   - `COZE_WORKFLOW_ID`: 你要运行的 Coze 工作流 ID

### 方法二：通过 GitHub 集成

1. 将代码推送到 GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. 在 [Vercel](https://vercel.com) 导入 GitHub 仓库

3. 在项目设置中添加环境变量：
   - `COZE_API_KEY`: 你的 Coze Personal Access Token
   - `COZE_WORKFLOW_ID`: 你要运行的 Coze 工作流 ID

## 环境变量说明

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `COZE_API_KEY` | Coze Personal Access Token | `pat_xxx...` |
| `COZE_WORKFLOW_ID` | Coze 工作流 ID | `7389xxx...` |

## API 接口

### POST /api/run-workflow

调用 Coze 工作流的代理接口。

**请求体:**
```json
{
  "input": "用户输入的内容"
}
```

**响应:**
```json
{
  "success": true,
  "outData": "工作流输出结果",
  "infoJson": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "workflow_id": "7389xxx...",
    "input_length": 10,
    "response_data": {},
    "processing_time": 1234567890
  }
}
```

## 项目结构

```
coze-workflow-app/
├── api/
│   └── run-workflow.js     # Vercel Serverless Function
├── index.html              # 主页面
├── style.css              # 样式文件
├── script.js              # 前端逻辑
├── package.json           # 项目配置
├── .gitignore            # Git 忽略文件
└── README.md             # 项目说明
```

## 自定义配置

### 修改样式主题

在 `style.css` 中修改颜色值来自定义主题：

```css
/* 主要颜色 */
background: linear-gradient(135deg, #ffeef8 0%, #f8e8ff 30%, #e8f4ff 70%, #fff0f8 100%);
color: #d63384; /* 粉色主色调 */
border-color: rgba(255, 182, 193, 0.6); /* 粉色边框 */
```

### 修改 API 端点

如果需要调用不同的 Coze API 端点，请修改 `api/run-workflow.js` 中的 `cozeApiUrl` 变量。

## 故障排除

### 常见问题

1. **API 调用失败**
   - 检查环境变量是否正确设置
   - 确认 Coze API 密钥有效
   - 检查工作流 ID 是否正确

2. **部署失败**
   - 确认所有文件都已提交到 Git
   - 检查 package.json 格式是否正确
   - 查看 Vercel 部署日志

3. **样式显示异常**
   - 检查 CSS 文件路径是否正确
   - 确认字体文件加载正常

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
