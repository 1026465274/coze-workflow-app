// Vercel Serverless Function for Coze Workflow API Proxy
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

        // 构建 Coze API 请求
        const cozeApiUrl = 'https://api.coze.cn/v1/workflow/run';
        
        const requestBody = {
            workflow_id: COZE_WORKFLOW_ID,
            parameters: {
                input: input.trim()
            }
        };

        console.log('调用 Coze API:', {
            url: cozeApiUrl,
            workflow_id: COZE_WORKFLOW_ID,
            input_length: input.length
        });

        // 调用 Coze API
        const cozeResponse = await fetch(cozeApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${COZE_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        // 检查响应状态
        if (!cozeResponse.ok) {
            const errorText = await cozeResponse.text();
            console.error('Coze API 错误:', {
                status: cozeResponse.status,
                statusText: cozeResponse.statusText,
                body: errorText
            });

            return res.status(cozeResponse.status).json({
                error: 'Coze API error',
                message: `Coze API 返回错误: ${cozeResponse.status} ${cozeResponse.statusText}`,
                details: errorText
            });
        }

        // 解析响应
        const cozeData = await cozeResponse.json();
        
        console.log('Coze API 响应:', {
            success: true,
            hasData: !!cozeData,
            dataKeys: cozeData ? Object.keys(cozeData) : []
        });

        // 返回结果给前端
        return res.status(200).json({
            success: true,
            outData: cozeData.data || cozeData.output || cozeData.result || '处理完成',
            infoJson: {
                timestamp: new Date().toISOString(),
                workflow_id: COZE_WORKFLOW_ID,
                input_length: input.length,
                response_data: cozeData,
                processing_time: Date.now()
            }
        });

    } catch (error) {
        console.error('服务器错误:', error);
        
        return res.status(500).json({
            error: 'Internal server error',
            message: '服务器内部错误，请稍后重试',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
