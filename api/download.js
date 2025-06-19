// Vercel Serverless Function for Document Download
import { put } from '@vercel/blob';

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
}
