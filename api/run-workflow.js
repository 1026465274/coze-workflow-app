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
                input: input.trim(),
                getJson: true,
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

        // 立即返回工作流结果给前端，让用户先看到内容
        const workflowResult = {
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
        };

        // 异步处理文档生成（不阻塞响应）
        if (cozeData && (cozeData.infoJson || cozeData.info || cozeData.result)) {
            // 使用 setTimeout 异步处理，不阻塞当前响应
            setTimeout(async () => {
                try {
                    console.log('开始异步处理文档生成...');

                    // 调用 Google Apps Script
                    const googleAppsScriptURL = 'https://script.google.com/macros/s/AKfycbw44ekOAjkT0xc1ZkQhiIQowZRot_cGTsKd4Z6dVUATM8ROGQMvue3rAWueqb7WEzmlEw/exec';

                    const gasResponse = await fetch(googleAppsScriptURL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            data: cozeData.infoJson || cozeData.info || cozeData.result || cozeData,
                            source: 'coze-workflow',
                            timestamp: new Date().toISOString()
                        })
                    });

                    if (gasResponse.ok) {
                        const gasData = await gasResponse.json();
                        const docId = gasData.docId || gasData.documentId || gasData.id;

                        if (docId) {
                            console.log('Google Apps Script 成功，docId:', docId);

                            // 调用下载 API
                            const downloadResponse = await fetch(`${req.headers.origin || 'https://workflow.lilingbo.top'}/api/download`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    docId: docId,
                                    fileName: `workflow_result_${Date.now()}.docx`
                                })
                            });

                            if (downloadResponse.ok) {
                                const downloadData = await downloadResponse.json();
                                console.log('文档下载链接生成成功:', downloadData.downloadUrl);
                                // 这里可以通过 WebSocket 或其他方式通知前端，但现在先记录日志
                            }
                        }
                    }
                } catch (asyncError) {
                    console.error('异步文档处理错误:', asyncError);
                }
            }, 0);
        }

        // 立即返回工作流结果
        return res.status(200).json(workflowResult);

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
