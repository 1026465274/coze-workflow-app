// Vercel Serverless Function - Background Processor for Long-Running Tasks
import { CozeAPI } from '@coze/api';
import { Redis } from '@upstash/redis';

// Initialize Redis
const redis = Redis.fromEnv();

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

    console.log(`[${jobId}] ===== 后台处理器接收到请求 =====`);
    console.log(`[${jobId}] 请求参数:`, {
        hasJobId: !!jobId,
        hasInput: !!input,
        inputLength: input ? input.length : 0,
        timestamp: new Date().toISOString()
    });

    if (!jobId || !input) {
        console.error(`[${jobId}] 参数验证失败:`, { jobId, hasInput: !!input });
        return res.status(400).json({
            error: 'Invalid input',
            message: '缺少必要参数'
        });
    }

    // 立即返回确认，开始后台处理
    console.log(`[${jobId}] 参数验证通过，立即返回确认并启动后台处理`);
    res.status(200).json({
        success: true,
        message: '后台处理已启动',
        jobId: jobId
    });

    // 直接调用后台任务处理函数（HTTP 调用模式）
    console.log(`[${jobId}] HTTP 模式：直接执行后台处理任务...`);
    try {
        await runBackgroundTask(jobId, input);
        console.log(`[${jobId}] HTTP 模式：后台任务执行完成`);
    } catch (error) {
        console.error(`[${jobId}] ❌ HTTP 模式：后台处理异常:`, error);
        console.error(`[${jobId}] 错误堆栈:`, error.stack);
    }
}

// Redis 连接测试函数
async function testRedisConnection(jobId) {
    try {
        console.log(`[${jobId}] 测试 Redis 连接...`);

        const testKey = `test:${jobId}`;
        const testValue = { test: true, timestamp: new Date().toISOString() };

        // 测试写入
        const setOperation = redis.set(testKey, testValue);
        const setTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Redis SET 超时')), 3000);
        });

        await Promise.race([setOperation, setTimeoutPromise]);
        console.log(`[${jobId}] ✅ Redis 写入测试成功`);

        // 测试读取
        const getOperation = redis.get(testKey);
        const getTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Redis GET 超时')), 3000);
        });

        const retrievedValue = await Promise.race([getOperation, getTimeoutPromise]);
        console.log(`[${jobId}] ✅ Redis 读取测试成功:`, !!retrievedValue);

        // 清理测试数据
        redis.del(testKey).catch(err => console.warn(`[${jobId}] 清理测试数据失败:`, err));

        return true;
    } catch (error) {
        console.error(`[${jobId}] ❌ Redis 连接测试失败:`, error);
        return false;
    }
}

// 导出的后台任务处理函数 - 供其他模块调用
export async function runBackgroundTask(jobId, input) {
    console.log(`[${jobId}] ===== runBackgroundTask 函数开始执行 =====`);

    // 首先测试 Redis 连接
    const redisOk = await testRedisConnection(jobId);
    if (!redisOk) {
        console.error(`[${jobId}] Redis 连接失败，无法继续执行`);
        throw new Error('Redis 连接失败');
    }

    return await processLongRunningTask(jobId, input);
}

// 长时间运行的任务处理函数
async function processLongRunningTask(jobId, input) {

    try {
        console.log(`[${jobId}] ===== 后台处理函数启动 =====`);
        console.log(`[${jobId}] 输入参数:`, {
            jobId,
            inputLength: input.length,
            inputPreview: input.substring(0, 100) + '...',
            timestamp: new Date().toISOString()
        });

        console.log(`[${jobId}] 开始更新 Redis 状态为 processing...`);

        // 更新状态为处理中 - 添加超时保护
        try {
            const redisOperation = redis.set(`job:${jobId}`, {
                status: 'processing',
                progress: 10,
                message: '正在调用 Coze 工作流...',
                startTime: new Date().toISOString()
            });

            // 添加 10 秒超时保护
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Redis 操作超时')), 10000);
            });

            await Promise.race([redisOperation, timeoutPromise]);
            console.log(`[${jobId}] ✅ Redis 状态更新成功，开始执行工作流...`);

        } catch (redisError) {
            console.error(`[${jobId}] ❌ Redis 状态更新失败:`, redisError);
            console.error(`[${jobId}] Redis 错误详情:`, {
                errorMessage: redisError.message,
                errorStack: redisError.stack,
                errorName: redisError.name
            });

            // Redis 失败不应该阻止整个流程，继续执行
            console.log(`[${jobId}] Redis 更新失败，但继续执行工作流...`);
        }

        // 执行 Coze 工作流
        console.log(`[${jobId}] 开始调用 executeCozeWorkflow 函数...`);
        const workflowResult = await executeCozeWorkflow(input, jobId);
        console.log(`[${jobId}] executeCozeWorkflow 函数执行完成，结果:`, {
            success: workflowResult?.success,
            hasInfoJson: !!workflowResult?.infoJson,
            hasExtractedInfojson: !!workflowResult?.infoJson?.extracted_infojson,
            outDataLength: workflowResult?.outData?.length || 0
        });

        // 更新进度 - 添加超时保护
        console.log(`[${jobId}] 更新进度到 60%...`);
        try {
            const updateOperation = redis.set(`job:${jobId}`, {
                status: 'processing',
                progress: 60,
                message: '工作流完成，开始生成文档...',
                workflowResult: workflowResult
            });

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Redis 更新超时')), 5000);
            });

            await Promise.race([updateOperation, timeoutPromise]);
            console.log(`[${jobId}] ✅ 进度更新完成，准备处理文档生成...`);
        } catch (updateError) {
            console.error(`[${jobId}] ❌ 进度更新失败:`, updateError.message);
            console.log(`[${jobId}] 继续处理文档生成...`);
        }

        // 处理文档生成
        let documentResult = null;
        console.log(`[${jobId}] 检查是否需要生成文档...`);
        console.log(`[${jobId}] workflowResult.infoJson:`, !!workflowResult.infoJson);
        console.log(`[${jobId}] extracted_infojson:`, !!workflowResult.infoJson?.extracted_infojson);

        if (workflowResult.infoJson && workflowResult.infoJson.extracted_infojson) {
            try {
                console.log(`[${jobId}] 开始生成文档...`);
                documentResult = await generateDocument(workflowResult.infoJson.extracted_infojson, jobId);
                console.log(`[${jobId}] 文档生成成功:`, {
                    hasDocId: !!documentResult?.docId,
                    hasDownloadUrl: !!documentResult?.downloadUrl,
                    fileName: documentResult?.fileName
                });

                await redis.set(`job:${jobId}`, {
                    status: 'processing',
                    progress: 90,
                    message: '文档生成完成，正在整理结果...'
                });
            } catch (docError) {
                console.error(`[${jobId}] 文档生成失败:`, docError);
                console.error(`[${jobId}] 文档生成错误堆栈:`, docError.stack);
                // 文档生成失败不影响主流程
            }
        } else {
            console.log(`[${jobId}] 跳过文档生成：没有 extracted_infojson 数据`);
        }

        // 完成
        const finalResult = {
            ...workflowResult,
            documentResult
        };

        console.log(`[${jobId}] 准备更新最终状态为 completed...`);
        console.log(`[${jobId}] 最终结果摘要:`, {
            hasWorkflowResult: !!workflowResult,
            hasDocumentResult: !!documentResult,
            workflowSuccess: workflowResult?.success,
            documentHasDownloadUrl: !!documentResult?.downloadUrl
        });

        // 最终状态更新 - 添加超时保护
        try {
            const finalUpdateOperation = redis.set(`job:${jobId}`, {
                status: 'completed',
                progress: 100,
                message: '任务完成',
                result: finalResult,
                completedTime: new Date().toISOString()
            });

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('最终状态更新超时')), 5000);
            });

            await Promise.race([finalUpdateOperation, timeoutPromise]);
            console.log(`[${jobId}] ✅ 最终状态更新成功`);
        } catch (finalUpdateError) {
            console.error(`[${jobId}] ❌ 最终状态更新失败:`, finalUpdateError.message);
        }

        console.log(`[${jobId}] ===== 后台处理完成 =====`);

    } catch (error) {
        console.error(`[${jobId}] 后台处理失败:`, error);
        
        try {
            await redis.set(`job:${jobId}`, {
                status: 'failed',
                progress: 0,
                message: `处理失败: ${error.message}`,
                error: error.message,
                failedTime: new Date().toISOString()
            });
        } catch (redisError) {
            console.error('更新失败状态时出错:', redisError);
        }
    }
}

// 执行 Coze 工作流
async function executeCozeWorkflow(input, jobId) {
    console.log(`[${jobId}] ===== executeCozeWorkflow 函数开始 =====`);

    const COZE_API_KEY = process.env.COZE_API_KEY;
    const COZE_WORKFLOW_ID = process.env.COZE_WORKFLOW_ID;

    console.log(`[${jobId}] 环境变量检查:`, {
        hasApiKey: !!COZE_API_KEY,
        apiKeyLength: COZE_API_KEY ? COZE_API_KEY.length : 0,
        hasWorkflowId: !!COZE_WORKFLOW_ID,
        workflowId: COZE_WORKFLOW_ID
    });

    if (!COZE_API_KEY || !COZE_WORKFLOW_ID) {
        console.error(`[${jobId}] Coze API 配置缺失!`);
        throw new Error('Coze API 配置缺失');
    }

    console.log(`[${jobId}] 初始化 Coze API 客户端...`);
    const apiClient = new CozeAPI({
        token: COZE_API_KEY,
        baseURL: 'https://api.coze.cn'
    });

    console.log(`[${jobId}] 准备调用 Coze API 流式接口...`);
    console.log(`[${jobId}] 请求参数:`, {
        workflow_id: COZE_WORKFLOW_ID,
        inputLength: input.length,
        inputPreview: input.substring(0, 50) + '...'
    });

    const cozeResponse = await apiClient.workflows.runs.stream({
        workflow_id: COZE_WORKFLOW_ID,
        parameters: {
            input: input.trim()
        }
    });

    console.log(`[${jobId}] Coze API 调用完成，开始处理流式响应...`);
    console.log(`[${jobId}] 响应类型检查:`, {
        hasResponse: !!cozeResponse,
        hasAsyncIterator: cozeResponse && typeof cozeResponse[Symbol.asyncIterator] === 'function',
        responseType: typeof cozeResponse
    });

    // 处理流式响应
    let messageData = null;
    let infojson = null;
    let outData = '';
    let progress = 20;
    let chunkCount = 0;

    if (cozeResponse && typeof cozeResponse[Symbol.asyncIterator] === 'function') {
        console.log(`[${jobId}] 开始处理流式数据...`);
        for await (const chunk of cozeResponse) {
            chunkCount++;
            console.log(`[${jobId}] 收到第 ${chunkCount} 个数据块:`, {
                event: chunk.event,
                hasData: !!chunk.data,
                dataType: typeof chunk.data
            });
            
            // 更新进度
            progress = Math.min(progress + 5, 50);
            await redis.set(`job:${jobId}`, {
                status: 'processing',
                progress: progress,
                message: `正在处理 Coze 响应... (${chunk.event})`
            });

            if (chunk.event === 'Message' && chunk.data && chunk.data.content) {
                try {
                    console.log(`[${jobId}] 解析 Message 内容...`);
                    const contentData = JSON.parse(chunk.data.content);
                    console.log(`[${jobId}] Message 内容解析成功:`, {
                        hasInfojson: !!contentData.infojson,
                        hasOutData: !!contentData.outData,
                        contentKeys: Object.keys(contentData)
                    });

                    if (contentData.infojson) {
                        infojson = contentData.infojson;
                        console.log(`[${jobId}] ✅ 成功提取到 infojson 数据`);
                    }
                    if (contentData.outData) {
                        outData = contentData.outData;
                        console.log(`[${jobId}] ✅ 成功提取到 outData`);
                    }
                    messageData = contentData;
                } catch (e) {
                    console.warn(`[${jobId}] ❌ 解析 Message content 失败:`, e);
                    console.warn(`[${jobId}] 原始 content:`, chunk.data.content);
                }
            }

            if (chunk.event === 'Done') {
                console.log(`[${jobId}] 收到 Done 事件，流式处理结束`);
                break;
            }
        }
        console.log(`[${jobId}] 流式数据处理完成，共处理 ${chunkCount} 个数据块`);
    } else {
        console.log(`[${jobId}] ❌ 响应不是流式格式或为空`);
    }

    console.log(`[${jobId}] 构建最终结果...`);
    console.log(`[${jobId}] 数据提取结果:`, {
        hasInfojson: !!infojson,
        hasOutData: !!outData,
        hasMessageData: !!messageData,
        outDataLength: outData ? outData.length : 0
    });

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

    console.log(`[${jobId}] ===== executeCozeWorkflow 函数完成 =====`);
    return result;
}

// 生成文档
async function generateDocument(workflowData, jobId) {
    console.log(`[${jobId}] 开始生成文档...`);

    await redis.set(`job:${jobId}`, {
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

    await redis.set(`job:${jobId}`, {
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
