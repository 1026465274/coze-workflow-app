// Vercel Serverless Function for Coze Workflow API Proxy
import { CozeAPI } from '@coze/api';

export default async function handler(req, res) {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            message: '只支持 POST 请求' 
        });
    }

    try {
        // 从环境变量获取配置
        const COZE_API_KEY = process.env.COZE_API_KEY;
        const COZE_WORKFLOW_ID = process.env.COZE_WORKFLOW_ID;

        // 验证环境变量
        console.log('环境变量检查:', {
            hasApiKey: !!COZE_API_KEY,
            apiKeyLength: COZE_API_KEY ? COZE_API_KEY.length : 0,
            apiKeyPrefix: COZE_API_KEY ? COZE_API_KEY.substring(0, 10) + '...' : 'undefined',
            hasWorkflowId: !!COZE_WORKFLOW_ID,
            workflowId: COZE_WORKFLOW_ID
        });

        if (!COZE_API_KEY) {
            console.error('COZE_API_KEY 环境变量未设置');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'API 密钥未配置'
            });
        }

        if (!COZE_WORKFLOW_ID) {
            console.error('COZE_WORKFLOW_ID 环境变量未设置');
            return res.status(500).json({
                error: 'Server configuration error',
                message: '工作流 ID 未配置'
            });
        }

        // 获取请求体
        const { input } = req.body;

        // 验证输入
        if (!input || typeof input !== 'string' || input.trim() === '') {
            return res.status(400).json({
                error: 'Invalid input',
                message: '请提供有效的输入内容'
            });
        }

        // 初始化 Coze API 客户端
        const apiClient = new CozeAPI({
            token: COZE_API_KEY,
            baseURL: 'https://api.coze.cn'
        });

        console.log('调用 Coze API (使用官方 SDK):', {
            workflow_id: COZE_WORKFLOW_ID,
            input_length: input.length,
            apiKeyPrefix: COZE_API_KEY.substring(0, 10) + '...'
        });

        // 调用 Coze 工作流 API（添加超时处理）
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('API 调用超时')), 8000); // 8秒超时
        });

        // 尝试使用流式 API（根据官方文档）
        const apiPromise = apiClient.workflows.runs.stream({
            workflow_id: COZE_WORKFLOW_ID,
            parameters: {
                input: input.trim()
            }
        });

        const cozeResponse = await Promise.race([apiPromise, timeoutPromise]);

        console.log('Coze API 响应 (流式 SDK):', {
            success: true,
            hasData: !!cozeResponse,
            responseType: typeof cozeResponse
        });

        // 处理流式响应
        let cozeData = {};
        let finalResult = '';

        if (cozeResponse && typeof cozeResponse[Symbol.asyncIterator] === 'function') {
            // 处理流式响应
            for await (const chunk of cozeResponse) {
                console.log('收到流式数据块:', chunk);
                if (chunk.data) {
                    finalResult += chunk.data;
                }
                if (chunk.event === 'done') {
                    cozeData = chunk;
                    break;
                }
            }
        } else {
            // 非流式响应
            cozeData = cozeResponse;
            finalResult = cozeData.data || cozeData.output || cozeData.result || '处理完成';
        }
        
        console.log('Coze API 响应:', {
            success: true,
            hasData: !!cozeData,
            dataKeys: cozeData ? Object.keys(cozeData) : []
        });

        // 返回结果给前端
        return res.status(200).json({
            success: true,
            outData: finalResult || '处理完成',
            infoJson: {
                timestamp: new Date().toISOString(),
                workflow_id: COZE_WORKFLOW_ID,
                input_length: input.length,
                response_data: cozeData,
                processing_time: Date.now(),
                api_method: 'stream'
            }
        });

    } catch (error) {
        console.error('服务器错误:', error);

        // 特殊处理超时错误
        if (error.message === 'API 调用超时') {
            return res.status(408).json({
                error: 'Request timeout',
                message: 'API 调用超时，请稍后重试',
                details: '工作流处理时间过长，已超过 8 秒限制'
            });
        }

        return res.status(500).json({
            error: 'Internal server error',
            message: '服务器内部错误，请稍后重试',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
