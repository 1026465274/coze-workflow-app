// Vercel Serverless Function - Background Worker for Coze Workflow
import { CozeAPI } from '@coze/api';

// 初始化 KV 存储
let kv = null;
let kvInitialized = false;

async function initKV() {
    if (kvInitialized) return kv;

    try {
        const kvModule = await import('@vercel/kv');
        kv = kvModule.kv;
        console.log('Vercel KV 初始化成功');
    } catch (error) {
        console.warn('Vercel KV 不可用，使用内存存储作为降级方案');
        // 内存存储降级方案
        const memoryStore = new Map();
        kv = {
            set: async (key, value) => {
                memoryStore.set(key, value);
                return 'OK';
            },
            get: async (key) => {
                return memoryStore.get(key) || null;
            }
        };
    }

    kvInitialized = true;
    return kv;
}

// 主要的工作函数，可以被其他 API 调用
export async function processWorkflow(jobId, input) {
    try {
        console.log(`[${jobId}] 开始处理工作流...`);

        // 初始化 KV
        const kvStore = await initKV();

        // 更新状态为处理中
        await kvStore.set(`job:${jobId}`, {
            status: 'processing',
            progress: 0,
            message: '正在调用 Coze 工作流...',
            startTime: new Date().toISOString()
        });

        // 原有的工作流处理逻辑
        const result = await executeWorkflow(input);

        // 更新进度
        await kvStore.set(`job:${jobId}`, {
            status: 'processing',
            progress: 50,
            message: '工作流完成，开始生成文档...',
            workflowResult: result
        });

        // 处理文档生成
        let documentResult = null;
        if (result.infoJson && (result.infoJson.extracted_infojson || result.infoJson.response_data)) {
            try {
                const workflowData = result.infoJson.extracted_infojson || result.infoJson.response_data;
                documentResult = await generateDocument(workflowData);

                await kvStore.set(`job:${jobId}`, {
                    status: 'processing',
                    progress: 90,
                    message: '文档生成完成，正在整理结果...'
                });
            } catch (docError) {
                console.error(`[${jobId}] 文档生成失败:`, docError);
                // 文档生成失败不影响主流程
            }
        }

        // 完成
        const finalResult = {
            ...result,
            documentResult
        };

        await kvStore.set(`job:${jobId}`, {
            status: 'completed',
            progress: 100,
            message: '任务完成',
            result: finalResult,
            completedTime: new Date().toISOString()
        });

        console.log(`[${jobId}] 工作流处理完成`);
        return finalResult;

    } catch (error) {
        console.error(`[${jobId}] 工作流处理失败:`, error);

        try {
            const kvStore = await initKV();
            await kvStore.set(`job:${jobId}`, {
                status: 'failed',
                progress: 0,
                message: `处理失败: ${error.message}`,
                error: error.message,
                failedTime: new Date().toISOString()
            });
        } catch (kvError) {
            console.error('更新失败状态时出错:', kvError);
        }

        throw error;
    }
}

// 执行工作流的核心逻辑
async function executeWorkflow(input) {
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

    // 验证输入
    if (!input || typeof input !== 'string' || input.trim() === '') {
        throw new Error('请提供有效的输入内容');
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

    // 调用 Coze 工作流 API（移除超时限制，让后台任务慢慢处理）
    const cozeResponse = await apiClient.workflows.runs.stream({
        workflow_id: COZE_WORKFLOW_ID,
        parameters: {
            input: input.trim()
        }
    });

    // 处理流式响应
    let cozeData = {};
    let finalResult = '';
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
                cozeData = chunk;
                break;
            }
        }
    } else {
        // 非流式响应
        cozeData = cozeResponse;
        finalResult = JSON.stringify(cozeData, null, 2);
    }

    // 构建返回结果
    return {
        success: true,
        outData: outData || JSON.stringify(infojson, null, 2) || finalResult || '处理完成',
        infoJson: {
            timestamp: new Date().toISOString(),
            workflow_id: COZE_WORKFLOW_ID,
            input_length: input.length,
            response_data: infojson || messageData || cozeData,
            api_method: 'stream',
            extracted_infojson: infojson
        }
    };
}

// 导出函数供其他模块使用
export { executeWorkflow, processWorkflow, generateDocument };

// 文档生成函数
async function generateDocument(workflowData) {
    try {
        console.log('开始生成文档...');

        // 调用 Google Apps Script
        const googleAppsScriptURL = 'https://script.google.com/macros/s/AKfycbw44ekOAjkT0xc1ZkQhiIQowZRot_cGTsKd4Z6dVUATM8ROGQMvue3rAWueqb7WEzmlEw/exec';

        const gasResponse = await fetch(googleAppsScriptURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: workflowData,
                source: 'coze-workflow',
                timestamp: new Date().toISOString()
            })
        });

        if (!gasResponse.ok) {
            throw new Error(`Google Apps Script 调用失败: ${gasResponse.status}`);
        }

        const gasData = await gasResponse.json();
        const docId = gasData.docId || gasData.documentId || gasData.id;

        if (!docId) {
            throw new Error('未能从 Google Apps Script 获取文档 ID');
        }

        console.log('Google Apps Script 成功，docId:', docId);

        // 调用下载 API
        const downloadResponse = await fetch('https://workflow.lilingbo.top/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                docId: docId,
                fileName: `workflow_result_${Date.now()}.docx`
            })
        });

        if (!downloadResponse.ok) {
            throw new Error(`下载 API 调用失败: ${downloadResponse.status}`);
        }

        const downloadData = await downloadResponse.json();
        console.log('文档下载链接生成成功:', downloadData.downloadUrl);

        return {
            docId,
            downloadUrl: downloadData.downloadUrl,
            fileName: downloadData.fileName,
            fileSize: downloadData.fileSize
        };

    } catch (error) {
        console.error('文档生成失败:', error);
        throw error;
    }
}

// 兼容原有的 HTTP 处理器（用于直接调用测试）
export default async function handler(req, res) {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: '只支持 POST 请求'
        });
    }

    try {
        const { input } = req.body;
        const result = await executeWorkflow(input);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Worker 直接调用失败:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
