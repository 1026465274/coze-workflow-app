// 文件: api/test-worker.js

export async function runTestTask(someData) {
    console.log(`===== TEST WORKER STARTED with data: ${someData} =====`);
    
    // 模拟5秒的耗时工作
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log(`===== TEST WORKER FINISHED =====`);
}

// 保留一个默认的 handler 以便 Vercel 正确识别为函数
export default async function handler(req, res) {
    await runTestTask('Direct HTTP Call');
    res.status(200).send('Test worker ran directly.');
}