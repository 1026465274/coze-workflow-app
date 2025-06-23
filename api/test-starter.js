// 文件: api/test-starter.js

import { runTestTask } from './test-worker.js';

export default function handler(req, res) {
    const testId = `test_run_${Date.now()}`;
    console.log(`[test-starter] Invoking test worker with ID: ${testId}`);

    // 直接调用，不等待
    runTestTask(testId);
    
    console.log(`[test-starter] Invocation sent. Returning response immediately.`);
    res.status(202).send(`Test task started with ID: ${testId}`);
}