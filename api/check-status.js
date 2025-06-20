// Vercel Serverless Function - Check Workflow Status

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

    // 只允许 GET 请求
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            message: '只支持 GET 请求' 
        });
    }

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

        console.log(`查询任务状态: ${jobId}`);

        // 初始化 KV 并查询任务状态
        const kvStore = await initKV();
        const jobData = await kvStore.get(`job:${jobId}`);

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
}
