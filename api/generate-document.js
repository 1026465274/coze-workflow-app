// Vercel Serverless Function for Document Generation
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
        const { workflowData } = req.body;

        // 验证输入
        if (!workflowData) {
            return res.status(400).json({
                error: 'Invalid input',
                message: '请提供工作流数据'
            });
        }

        console.log('开始生成文档，数据长度:', JSON.stringify(workflowData).length);

        // 第一步：调用 Google Apps Script 生成文档
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
            const errorText = await gasResponse.text();
            console.error('Google Apps Script 调用失败:', errorText);
            return res.status(502).json({
                error: 'Google Apps Script error',
                message: `调用 Google Apps Script 失败: ${gasResponse.status}`,
                details: errorText
            });
        }

        const gasData = await gasResponse.json();
        const docId = gasData.docId || gasData.documentId || gasData.id;

        if (!docId) {
            console.error('未能从 Google Apps Script 获取 docId:', gasData);
            return res.status(500).json({
                error: 'Missing document ID',
                message: '未能从 Google Apps Script 获取文档 ID',
                gasResponse: gasData
            });
        }

        console.log('Google Apps Script 成功，docId:', docId);

        // 第二步：调用下载 API 生成下载链接
        const downloadResponse = await fetch(`${req.headers.origin || 'https://workflow.lilingbo.top'}/api/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                docId: docId,
                fileName: `workflow_document_${Date.now()}.docx`
            })
        });

        if (!downloadResponse.ok) {
            const errorText = await downloadResponse.text();
            console.error('下载 API 调用失败:', errorText);
            return res.status(502).json({
                error: 'Download API error',
                message: `调用下载 API 失败: ${downloadResponse.status}`,
                details: errorText,
                docId: docId
            });
        }

        const downloadData = await downloadResponse.json();
        console.log('文档下载链接生成成功:', downloadData.downloadUrl);

        // 返回完整结果
        return res.status(200).json({
            success: true,
            docId: docId,
            downloadUrl: downloadData.downloadUrl,
            fileName: downloadData.fileName,
            fileSize: downloadData.fileSize,
            timestamp: new Date().toISOString(),
            gasResponse: gasData,
            processing_steps: [
                'Google Apps Script 调用成功',
                '文档生成完成',
                '下载链接创建成功'
            ]
        });

    } catch (error) {
        console.error('文档生成错误:', error);
        
        return res.status(500).json({
            error: 'Document generation error',
            message: '文档生成失败，请稍后重试',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
