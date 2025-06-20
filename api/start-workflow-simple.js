// Vercel Serverless Function - Simple Async Workflow (without KV)
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
        const { input } = req.body;

        // 验证输入
        if (!input || typeof input !== 'string' || input.trim() === '') {
            return res.status(400).json({
                error: 'Invalid input',
                message: '请提供有效的输入内容'
            });
        }

        console.log('开始处理工作流 (简化版本)...');

        // 获取环境变量
        const COZE_API_KEY = process.env.COZE_API_KEY;
        const COZE_WORKFLOW_ID = process.env.COZE_WORKFLOW_ID;

        // 验证环境变量
        if (!COZE_API_KEY) {
            throw new Error('COZE_API_KEY 环境变量未设置');
        }

        if (!COZE_WORKFLOW_ID) {
            throw new Error('COZE_WORKFLOW_ID 环境变量未设置');
        }

        // 初始化 Coze API 客户端
        const apiClient = new CozeAPI({
            token: COZE_API_KEY,
            baseURL: 'https://api.coze.cn'
        });

        console.log('调用 Coze API:', {
            workflow_id: COZE_WORKFLOW_ID,
            input_length: input.length
        });

        // 调用 Coze 工作流 API
        const cozeResponse = await apiClient.workflows.runs.stream({
            workflow_id: COZE_WORKFLOW_ID,
            parameters: {
                input: input.trim()
            }
        });

        // 处理流式响应
        let messageData = null;
        let infojson = null;
        let outData = '';

        console.log('开始处理流式响应...');

        if (cozeResponse && typeof cozeResponse[Symbol.asyncIterator] === 'function') {
            // 处理流式响应
            for await (const chunk of cozeResponse) {
                console.log('收到流式数据块:', chunk);

                // 根据实际返回格式解析
                if (chunk.event === 'Message' && chunk.data && chunk.data.content) {
                    try {
                        const contentData = JSON.parse(chunk.data.content);
                        if (contentData.infojson) {
                            infojson = contentData.infojson;
                            console.log('提取到 infojson:', infojson);
                        }
                        if (contentData.outData) {
                            outData = contentData.outData;
                        }
                        messageData = contentData;
                    } catch (e) {
                        console.warn('解析 Message content 失败:', e);
                    }
                }

                if (chunk.event === 'Done') {
                    break;
                }
            }
        }

        // 构建返回结果
        const result = {
            success: true,
            outData: outData || JSON.stringify(infojson, null, 2) || '处理完成',
            infoJson: {
                timestamp: new Date().toISOString(),
                workflow_id: COZE_WORKFLOW_ID,
                input_length: input.length,
                response_data: infojson || messageData,
                api_method: 'stream',
                extracted_infojson: infojson
            }
        };

        console.log('工作流处理完成');

        // 返回结果
        return res.status(200).json({
            success: true,
            status: 'completed',
            result: result,
            message: '工作流处理完成'
        });

    } catch (error) {
        console.error('工作流处理失败:', error);
        console.error('错误堆栈:', error.stack);
        
        return res.status(500).json({
            error: 'Internal server error',
            message: '工作流处理失败，请稍后重试',
            details: error.message,
            errorType: error.constructor.name
        });
    }
}
