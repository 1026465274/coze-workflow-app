// Express.js Server - Coze Workflow App
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Redis } from '@upstash/redis';
import { put } from '@vercel/blob';

// ES Module 兼容性设置
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化 Express 应用
const app = express();
const PORT = process.env.PORT || 3000;

// 初始化 Redis - 使用 Upstash Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// 中间件设置
app.use(cors());
app.use(express.json());

// 静态文件服务 - 提供 public 目录下的文件
app.use(express.static(path.join(__dirname, 'public')));

// 根路径重定向到 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== API 路由 =====

// POST /api/start-workflow - 启动异步工作流任务
app.post('/api/start-workflow', async (req, res) => {
    try {
        const { input } = req.body;

        // 验证输入
        if (!input || typeof input !== 'string' || input.trim() === '') {
            return res.status(400).json({
                error: 'Invalid input',
                message: '请提供有效的输入内容'
            });
        }

        // 生成唯一的任务 ID
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

        console.log(`[${jobId}] ===== 创建新的工作流任务 =====`);
        console.log(`[${jobId}] 输入参数:`, {
            inputLength: input.length,
            inputPreview: input.substring(0, 100) + '...',
            timestamp: new Date().toISOString()
        });

        // 在 Redis 中创建初始状态记录
        console.log(`[${jobId}] 保存初始状态到 Redis...`);
        await redis.set(`job:${jobId}`, {
            status: 'pending',
            progress: 0,
            message: '任务已创建，等待处理...',
            input: input.trim(),
            createdTime: new Date().toISOString(),
            jobId: jobId
        });
        console.log(`[${jobId}] 初始状态保存成功`);

        // 启动后台处理任务（不等待完成）
        console.log(`[${jobId}] 准备启动后台处理任务...`);
        processBackgroundTask(jobId, input.trim()).catch(error => {
            console.error(`[${jobId}] 后台任务执行失败:`, error);
        });

        console.log(`[${jobId}] 后台任务已启动，立即返回响应`);

        // 立即返回任务 ID
        return res.status(202).json({
            success: true,
            jobId: jobId,
            status: 'pending',
            message: '任务已启动，请使用 jobId 查询进度',
            checkStatusUrl: `/api/check-status?jobId=${jobId}`
        });

    } catch (error) {
        console.error('启动工作流任务失败:', error);
        console.error('错误堆栈:', error.stack);

        return res.status(500).json({
            error: 'Internal server error',
            message: '启动任务失败，请稍后重试',
            details: error.message,
            errorType: error.constructor.name
        });
    }
});

// GET /api/check-status - 查询任务状态
app.get('/api/check-status', async (req, res) => {
    try {
        // 从 URL query 中获取 jobId
        const { jobId } = req.query;

        // 验证 jobId
        if (!jobId || typeof jobId !== 'string') {
            return res.status(400).json({
                error: 'Invalid jobId',
                message: '请提供有效的任务 ID'
            });
        }

        console.log(`[${jobId}] ===== 查询任务状态 =====`);

        // 从 Redis 中查询任务状态
        console.log(`[${jobId}] 从 Redis 查询数据...`);
        const jobData = await redis.get(`job:${jobId}`);

        console.log(`[${jobId}] Redis 查询结果:`, {
            hasData: !!jobData,
            dataType: typeof jobData,
            status: jobData?.status,
            progress: jobData?.progress,
            message: jobData?.message,
            dataKeys: jobData ? Object.keys(jobData) : []
        });

        if (!jobData) {
            return res.status(404).json({
                error: 'Job not found',
                message: '未找到指定的任务',
                jobId: jobId
            });
        }

        // 计算任务运行时间
        const createdTime = new Date(jobData.createdTime);
        const currentTime = new Date();
        const runningTime = Math.floor((currentTime - createdTime) / 1000); // 秒

        // 构建响应数据
        const response = {
            success: true,
            jobId: jobId,
            status: jobData.status,
            progress: jobData.progress || 0,
            message: jobData.message || '',
            runningTime: runningTime,
            createdTime: jobData.createdTime
        };

        // 根据状态添加额外信息
        switch (jobData.status) {
            case 'pending':
                response.estimatedTime = '预计 30-60 秒';
                break;
                
            case 'processing':
                response.currentStep = jobData.message;
                response.estimatedRemaining = Math.max(0, 60 - runningTime) + ' 秒';
                break;
                
            case 'completed':
                response.result = jobData.result;
                response.completedTime = jobData.completedTime;
                response.totalTime = Math.floor((new Date(jobData.completedTime) - createdTime) / 1000);
                
                // 如果有文档下载链接，添加到响应中
                if (jobData.result && jobData.result.documentResult) {
                    response.downloadUrl = jobData.result.documentResult.downloadUrl;
                    response.fileName = jobData.result.documentResult.fileName;
                }
                break;
                
            case 'failed':
                response.error = jobData.error;
                response.failedTime = jobData.failedTime;
                break;
        }

        return res.status(200).json(response);

    } catch (error) {
        console.error('查询任务状态失败:', error);
        
        return res.status(500).json({
            error: 'Internal server error',
            message: '查询状态失败，请稍后重试',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/download - 文档下载处理
app.post('/api/download', async (req, res) => {
    try {
        // 支持两种参数名：docId (Cloudflare Worker) 和 documentId (直接调用)
        const { docId, documentId, fileName } = req.body;
        const finalDocId = docId || documentId;

        // 验证输入
        if (!finalDocId) {
            return res.status(400).json({
                error: 'Invalid input',
                message: '请提供文档 ID (docId 或 documentId)'
            });
        }

        console.log('开始处理文档下载:', {
            docId: finalDocId,
            fileName: fileName || 'document.docx',
            source: docId ? 'cloudflare-worker' : 'direct-call'
        });

        // 1. 从 Google Docs 下载文档
        const googleDocsExportUrl = `https://docs.google.com/document/d/${finalDocId}/export?format=docx`;

        console.log('下载 Google Docs 文档:', googleDocsExportUrl);

        const docResponse = await fetch(googleDocsExportUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!docResponse.ok) {
            throw new Error(`下载文档失败: ${docResponse.status} ${docResponse.statusText}`);
        }

        // 2. 获取文档内容
        const docBuffer = await docResponse.arrayBuffer();
        const docBlob = new Uint8Array(docBuffer);

        console.log('文档下载成功，大小:', docBlob.length, 'bytes');

        // 3. 上传到 Vercel Blob
        const finalFileName = fileName || `document_${Date.now()}.docx`;

        const blob = await put(finalFileName, docBlob, {
            access: 'public',
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

        console.log('文档上传到 Vercel Blob 成功:', blob.url);

        // 4. 返回下载链接
        return res.status(200).json({
            success: true,
            downloadUrl: blob.url,
            fileName: finalFileName,
            fileSize: docBlob.length,
            documentId: finalDocId,
            docId: finalDocId, // 兼容两种命名
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('文档处理错误:', error);

        return res.status(500).json({
            error: 'Document processing error',
            message: '文档处理失败，请稍后重试',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ===== 后台任务处理函数 =====

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

// 主要的后台任务处理函数
async function processBackgroundTask(jobId, input) {
    console.log(`[${jobId}] ===== 后台任务处理开始 =====`);

    // 首先测试 Redis 连接
    const redisOk = await testRedisConnection(jobId);
    if (!redisOk) {
        console.error(`[${jobId}] Redis 连接失败，无法继续执行`);
        throw new Error('Redis 连接失败');
    }

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

        // Coze 已经直接返回下载链接，不需要额外生成文档
        console.log(`[${jobId}] Coze 工作流已完成，检查返回的下载链接...`);
        console.log(`[${jobId}] 下载链接:`, workflowResult.downloadUrl);

        // 更新进度到 90%
        try {
            await redis.set(`job:${jobId}`, {
                status: 'processing',
                progress: 90,
                message: '正在整理结果...'
            });
        } catch (updateError) {
            console.error(`[${jobId}] ❌ 进度更新失败:`, updateError.message);
        }

        // 完成 - 使用 Coze 直接返回的结果
        const finalResult = {
            ...workflowResult,
            // 如果 Coze 返回了下载链接，添加到结果中
            downloadUrl: workflowResult.downloadUrl,
            fileName: workflowResult.downloadUrl ? `workflow_result_${Date.now()}.docx` : null
        };

        console.log(`[${jobId}] 准备更新最终状态为 completed...`);
        console.log(`[${jobId}] 最终结果摘要:`, {
            hasWorkflowResult: !!workflowResult,
            workflowSuccess: workflowResult?.success,
            hasDownloadUrl: !!workflowResult.downloadUrl,
            hasInfojson: !!workflowResult.infoJson?.extracted_infojson
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

    console.log(`[${jobId}] 准备调用 Coze API 非流式接口...`);
    console.log(`[${jobId}] 请求参数:`, {
        workflow_id: COZE_WORKFLOW_ID,
        inputLength: input.length,
        inputPreview: input.substring(0, 50) + '...'
    });

    // 使用非流式接口 /v1/workflow/run
    const response = await fetch('https://api.coze.cn/v1/workflow/run', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${COZE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            workflow_id: COZE_WORKFLOW_ID,
            parameters: {
                input: input.trim()
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Coze API 调用失败: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    console.log(`[${jobId}] Coze API 调用成功，响应:`, {
        hasData: !!responseData.data,
        hasInfojson: !!responseData.data?.infojson,
        dataKeys: responseData.data ? Object.keys(responseData.data) : []
    });

    // 解析 Coze 返回的数据
    let parsedData = null;
    let infojson = null;
    let downloadUrl = null;

    try {
        // responseData.data 是一个字符串，需要解析
        if (typeof responseData.data === 'string') {
            parsedData = JSON.parse(responseData.data);
        } else {
            parsedData = responseData.data;
        }

        infojson = parsedData.infojson;

        // 检查是否有 outData 包含 downloadUrl
        if (parsedData.outData) {
            if (typeof parsedData.outData === 'string') {
                const outDataParsed = JSON.parse(parsedData.outData);
                downloadUrl = outDataParsed.downloadUrl;
            } else {
                downloadUrl = parsedData.outData.downloadUrl;
            }
        }

        console.log(`[${jobId}] ✅ 数据解析成功:`, {
            hasInfojson: !!infojson,
            hasDownloadUrl: !!downloadUrl,
            infojsonKeys: infojson ? Object.keys(infojson) : [],
            downloadUrl: downloadUrl
        });

    } catch (parseError) {
        console.error(`[${jobId}] ❌ 解析 Coze 响应数据失败:`, parseError);
        console.log(`[${jobId}] 原始数据:`, responseData.data);
        throw new Error('解析 Coze 响应数据失败');
    }

    if (!infojson) {
        console.warn(`[${jobId}] ❌ 响应中没有找到 infojson 数据`);
        console.log(`[${jobId}] 解析后的数据:`, parsedData);
    }

    console.log(`[${jobId}] 构建最终结果...`);

    const result = {
        success: true,
        outData: infojson ? JSON.stringify(infojson, null, 2) : '处理完成',
        downloadUrl: downloadUrl, // 直接使用 Coze 返回的下载链接
        infoJson: {
            timestamp: new Date().toISOString(),
            workflow_id: COZE_WORKFLOW_ID,
            input_length: input.length,
            response_data: infojson,
            api_method: 'direct',
            extracted_infojson: infojson,
            download_url: downloadUrl
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

    // 调用本地的下载 API
    const downloadUrl = process.env.NODE_ENV === 'production'
        ? `${process.env.APP_URL || 'http://localhost:' + PORT}/api/download`
        : `http://localhost:${PORT}/api/download`;

    console.log(`[${jobId}] 调用下载 API:`, downloadUrl);

    const downloadResponse = await fetch(downloadUrl, {
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

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 Express 服务器已启动`);
    console.log(`📍 服务器地址: http://localhost:${PORT}`);
    console.log(`📁 静态文件目录: ${path.join(__dirname, 'public')}`);
    console.log(`🔗 API 端点:`);
    console.log(`   POST /api/start-workflow - 启动工作流任务`);
    console.log(`   GET  /api/check-status   - 查询任务状态`);
    console.log(`⏰ 启动时间: ${new Date().toISOString()}`);
});
