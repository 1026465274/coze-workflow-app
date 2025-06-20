# 🔍 本地调试指南

## 🚀 启动本地 Vercel 开发服务器

### 第一步：配置环境变量

1. **编辑 `.env.local` 文件**：
   ```bash
   # Coze Personal Access Token
   COZE_API_KEY=您的真实API密钥
   
   # Coze 工作流 ID  
   COZE_WORKFLOW_ID=7515309664160399414
   
   # Vercel Blob Token (用于文档下载)
   BLOB_READ_WRITE_TOKEN=您的Vercel_Blob令牌
   ```

### 第二步：启动本地服务器

```bash
# 启动 Vercel 本地开发服务器（推荐）
npm run dev

# 或者指定端口
npm run dev-local
```

这将启动：
- **前端**: http://localhost:3000
- **API 函数**: http://localhost:3000/api/*

### 第三步：测试 API

1. **访问**: http://localhost:3000
2. **输入测试内容**
3. **查看浏览器控制台**，会显示：
   ```
   使用本地 Vercel Dev 服务器
   调用真实 API: /api/run-workflow
   ```

## 🔍 调试 API 响应问题

### 查看详细日志

在 Vercel Dev 服务器的终端中，您会看到详细的日志：

```bash
Coze 响应类型检查: {
  hasAsyncIterator: false,
  responseType: "object", 
  isArray: false,
  responseKeys: ["data", "status"]
}
处理非流式响应...
```

### 常见问题排查

#### 1. outData 显示 [object Object]

**原因**: 响应数据不是字符串格式
**解决**: 已修复，现在会自动转换为 JSON 字符串

#### 2. API 调用失败

**检查**:
- 环境变量是否正确设置
- Coze API 密钥是否有效
- 工作流 ID 是否正确

#### 3. 流式响应处理

**调试**:
```javascript
// 在浏览器控制台查看
console.log('Coze 响应:', cozeResponse);
```

## 🛠️ 不同的开发模式

### 模式 1: 本地 Vercel Dev + 真实 API
```bash
npm run dev
# 访问 http://localhost:3000
# 调用本地 API 函数，使用真实 Coze API
```

### 模式 2: 静态服务器 + 线上 API  
```bash
npm run dev-simple
# 访问 http://localhost:端口
# 调用线上 API (workflow.lilingbo.top)
```

### 模式 3: 模拟数据调试
在 `public/script.js` 第 34 行：
```javascript
const USE_MOCK_DATA = true; // 改为 true
```

## 📋 API 端点测试

### 直接测试 API

```bash
# 测试工作流 API
curl -X POST http://localhost:3000/api/run-workflow \
  -H "Content-Type: application/json" \
  -d '{"input": "测试输入"}'

# 测试文档生成 API  
curl -X POST http://localhost:3000/api/generate-document \
  -H "Content-Type: application/json" \
  -d '{"workflowData": {"test": "data"}}'

# 测试下载 API
curl -X POST http://localhost:3000/api/download \
  -H "Content-Type: application/json" \
  -d '{"docId": "your_document_id"}'
```

## 🔧 调试技巧

### 1. 查看 Vercel 函数日志
在运行 `npm run dev` 的终端中查看实时日志

### 2. 浏览器开发者工具
- **Console**: 查看前端日志
- **Network**: 查看 API 请求和响应
- **Application**: 查看本地存储

### 3. 添加调试日志
在 API 文件中添加：
```javascript
console.log('调试信息:', data);
```

### 4. 测试不同的输入
- 短文本
- 长文本  
- JSON 格式
- 特殊字符

## 🚨 常见错误解决

### Error: COZE_API_KEY 环境变量未设置
**解决**: 检查 `.env.local` 文件是否存在且配置正确

### Error: 504 Gateway Timeout
**解决**: Coze API 响应太慢，已添加 8 秒超时保护

### Error: 401 Unauthorized  
**解决**: 检查 Coze API 密钥是否有效

### outData 为空或格式错误
**解决**: 检查工作流配置，确保有正确的输出格式

## 📞 获取帮助

如果遇到问题：
1. 查看终端日志
2. 查看浏览器控制台
3. 检查 API 响应格式
4. 验证环境变量配置
