// Vercel Serverless Function - Simple Background Processor (No KV)
import { CozeAPI } from '@coze/api';

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

    const { jobId, input } = req.body;
    
    if (!jobId || !input) {
        return res.status(400).json({
            error: 'Invalid input',
            message: '缺少必要参数'
        });
    }

    // 立即返回确认，开始后台处理
    res.status(200).json({
        success: true,
        message: '后台处理已启动',
        jobId: jobId
    });

    // 异步处理长时间任务
    processLongRunningTask(jobId, input).catch(error => {
        console.error(`[${jobId}] 后台处理异常:`, error);
    });
}

// 长时间运行的任务处理函数
async function processLongRunningTask(jobId, input) {
    // 使用全局内存存储
    global.taskStorage = global.taskStorage || new Map();
    
    try {
        console.log(`[${jobId}] 开始后台处理...`);
        
        // 更新状态为处理中
        global.taskStorage.set(`job:${jobId}`, {
            status: 'processing',
            progress: 10,
            message: '正在调用 Coze 工作流...',
            startTime: new Date().toISOString()
        });

        // 执行 Coze 工作流
        const workflowResult = await executeCozeWorkflow(input, jobId);
        
        // 更新进度
        global.taskStorage.set(`job:${jobId}`, {
            status: 'processing',
            progress: 60,
            message: '工作流完成，开始生成文档...',
            workflowResult: workflowResult
        });

        // 处理文档生成
        let documentResult = null;
        if (workflowResult.infoJson && workflowResult.infoJson.extracted_infojson) {
            try {
                documentResult = await generateDocument(workflowResult.infoJson.extracted_infojson, jobId);
                
                global.taskStorage.set(`job:${jobId}`, {
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
            ...workflowResult,
            documentResult
        };

        global.taskStorage.set(`job:${jobId}`, {
            status: 'completed',
            progress: 100,
            message: '任务完成',
            result: finalResult,
            completedTime: new Date().toISOString()
        });

        console.log(`[${jobId}] 后台处理完成`);

    } catch (error) {
        console.error(`[${jobId}] 后台处理失败:`, error);
        
        try {
            global.taskStorage.set(`job:${jobId}`, {
                status: 'failed',
                progress: 0,
                message: `处理失败: ${error.message}`,
                error: error.message,
                failedTime: new Date().toISOString()
            });
        } catch (storageError) {
            console.error('更新失败状态时出错:', storageError);
        }
    }
}

// 执行 Coze 工作流
async function executeCozeWorkflow(input, jobId) {
    const COZE_API_KEY = process.env.COZE_API_KEY;
    const COZE_WORKFLOW_ID = process.env.COZE_WORKFLOW_ID;

    if (!COZE_API_KEY || !COZE_WORKFLOW_ID) {
        throw new Error('Coze API 配置缺失');
    }

    const apiClient = new CozeAPI({
        token: COZE_API_KEY,
        baseURL: 'https://api.coze.cn'
    });

    console.log(`[${jobId}] 调用 Coze API...`);

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
    let progress = 20;

    if (cozeResponse && typeof cozeResponse[Symbol.asyncIterator] === 'function') {
        for await (const chunk of cozeResponse) {
            console.log(`[${jobId}] 收到流式数据:`, chunk.event);
            
            // 更新进度
            progress = Math.min(progress + 5, 50);
            global.taskStorage.set(`job:${jobId}`, {
                status: 'processing',
                progress: progress,
                message: `正在处理 Coze 响应... (${chunk.event})`
            });

            if (chunk.event === 'Message' && chunk.data && chunk.data.content) {
                try {
                    const contentData = JSON.parse(chunk.data.content);
                    if (contentData.infojson) {
                        infojson = contentData.infojson;
                        console.log(`[${jobId}] 提取到 infojson`);
                    }
                    if (contentData.outData) {
                        outData = contentData.outData;
                    }
                    messageData = contentData;
                } catch (e) {
                    console.warn(`[${jobId}] 解析 Message content 失败:`, e);
                }
            }

            if (chunk.event === 'Done') {
                break;
            }
        }
    }

    return {
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
}

// 生成文档
async function generateDocument(workflowData, jobId) {
    console.log(`[${jobId}] 开始生成文档...`);
    
    global.taskStorage.set(`job:${jobId}`, {
        status: 'processing',
        progress: 70,
        message: '正在调用 Google Apps Script...'
    });

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

    console.log(`[${jobId}] Google Apps Script 成功，docId:`, docId);
    
    global.taskStorage.set(`job:${jobId}`, {
        status: 'processing',
        progress: 80,
        message: '正在生成下载链接...'
    });

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
    console.log(`[${jobId}] 文档下载链接生成成功`);

    return {
        docId,
        downloadUrl: downloadData.downloadUrl,
        fileName: downloadData.fileName,
        fileSize: downloadData.fileSize
    };
}
