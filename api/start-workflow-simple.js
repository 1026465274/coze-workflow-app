// Vercel Serverless Function - Simple Async Workflow (without KV)
import { executeWorkflow } from './worker.js';

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

        // 直接调用工作流处理函数
        const result = await executeWorkflow(input.trim());

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
