// Vercel Serverless Function - Start Async Workflow
import { Redis } from '@upstash/redis';

// Initialize Redis
const redis = Redis.fromEnv();

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

        // 生成唯一的任务 ID
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

        console.log(`[${jobId}] 创建新的工作流任务`);

        // 在 Redis 中创建初始状态记录
        await redis.set(`job:${jobId}`, JSON.stringify({
            status: 'pending',
            progress: 0,
            message: '任务已创建，等待处理...',
            input: input.trim(),
            createdTime: new Date().toISOString(),
            jobId: jobId
        }));

        // 立即启动后台处理，不等待结果
        // 使用 fetch 调用后台处理器，确保完全异步
        const backgroundProcessUrl = `${req.headers.origin || 'https://workflow.lilingbo.top'}/api/background-processor`;

        fetch(backgroundProcessUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jobId: jobId,
                input: input.trim()
            })
        }).catch(error => {
            console.error(`[${jobId}] 启动后台处理失败:`, error);
        });

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
}
