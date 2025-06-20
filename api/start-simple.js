// Vercel Serverless Function - Simple Task Starter (No KV, No Dependencies)

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

        // 使用内存存储（简单版本）
        global.taskStorage = global.taskStorage || new Map();
        
        // 创建初始状态记录
        global.taskStorage.set(`job:${jobId}`, {
            status: 'pending',
            progress: 0,
            message: '任务已创建，等待处理...',
            input: input.trim(),
            createdTime: new Date().toISOString(),
            jobId: jobId
        });

        // 异步启动后台处理
        const baseUrl = req.headers.origin || 'https://workflow.lilingbo.top';
        const backgroundUrl = `${baseUrl}/api/process-simple`;
        
        // 使用 setTimeout 确保完全异步
        setTimeout(() => {
            fetch(backgroundUrl, {
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
                // 更新状态为失败
                if (global.taskStorage) {
                    global.taskStorage.set(`job:${jobId}`, {
                        status: 'failed',
                        progress: 0,
                        message: `启动失败: ${error.message}`,
                        error: error.message,
                        failedTime: new Date().toISOString()
                    });
                }
            });
        }, 100); // 100ms 后启动，确保响应已返回

        // 立即返回任务 ID
        return res.status(202).json({
            success: true,
            jobId: jobId,
            status: 'pending',
            message: '任务已启动，请使用 jobId 查询进度',
            checkStatusUrl: `/api/status-simple?jobId=${jobId}`
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
