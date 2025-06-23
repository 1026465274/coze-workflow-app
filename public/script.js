// DOM 元素获取
const form = document.getElementById('workflow-form');
const userInput = document.getElementById('user-input');
const submitBtn = document.getElementById('submit-btn');
const btnText = document.querySelector('.btn-text');
const loadingSpinner = document.querySelector('.loading-spinner');
const resultsSection = document.getElementById('results-section');
const outDataContainer = document.getElementById('outData-container');
const infoJsonContainer = document.getElementById('info-json-display');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

// 当前任务状态
let currentJobId = null;
let statusCheckInterval = null;
let statusCheckCount = 0;
let initialDelayTimeout = null;
let buttonTimeoutId = null;
let isTaskRunning = false;
const MAX_STATUS_CHECKS = 24; // 最多检查4分钟（24次 * 10秒）
const POLLING_INTERVAL = 10000; // 10秒轮询间隔
const INITIAL_DELAY = 60000; // 前1分钟不轮询
const BUTTON_TIMEOUT = 180000; // 3分钟后重新启用按钮

// 表单提交事件监听
form.addEventListener('submit', async (event) => {
    event.preventDefault();

    console.log('用户输入:', userInput.value);
    const inputValue = userInput.value.trim();

    // 检查是否有任务正在运行
    if (isTaskRunning) {
        showError('有任务正在进行中，请稍候或等待3分钟后重试~ 🕐');
        return;
    }

    // 输入验证
    if (!inputValue) {
        showError('请告诉我你的愿望哦~ 💕');
        return;
    }

    // 清理之前的状态
    cleanupTaskState();

    // 开始处理
    setLoadingState(true);
    hideError();
    hideResults();

    try {
        // 检查是否使用直接 Coze API
        const useDirectAPI = localStorage.getItem('useDirectCozeAPI') === 'true';

        if (useDirectAPI) {
            // 直接调用 Coze API（同步模式）
            const data = await callDirectCozeAPI(inputValue);
            console.log('✨ 直接 API 调用成功:', data);
            displayResults(data);

            // 异步生成文档
            if (data.infoJson && (data.infoJson.extracted_infojson || data.infoJson.response_data)) {
                const workflowData = data.infoJson.extracted_infojson || data.infoJson.response_data;
                generateDocumentAsync(workflowData);
            }
            setLoadingState(false);
        } else {
            // 使用异步工作流模式（修复超时问题）
            await startAsyncWorkflow(inputValue);
        }

    } catch (error) {
        console.error('💔 魔法施展失败:', error);
        showError(`魔法失败了呢~ ${error.message} 😢`);
        setLoadingState(false);
        setTaskRunningState(false); // 确保按钮状态重置
    }
});

// 启动异步工作流
async function startAsyncWorkflow(inputValue) {
    try {
        console.log('🚀 启动异步工作流...');

        // 配置 API 基础 URL
        let API_BASE_URL = '';
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            if (window.location.port === '3000') {
                API_BASE_URL = '';  // 本地 Vercel Dev 服务器
            } else {
                API_BASE_URL = 'https://workflow.lilingbo.top';  // 线上 API
            }
        }

        const startUrl = `${API_BASE_URL}/api/start-workflow`;
        console.log('调用启动 API:', startUrl);

        const response = await fetch(startUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: inputValue
            })
        });

        if (!response.ok) {
            throw new Error(`启动任务失败: ${response.status}`);
        }

        const startData = await response.json();
        currentJobId = startData.jobId;

        console.log('✅ 任务已启动:', startData);

        // 设置按钮为任务运行状态
        setTaskRunningState(true);
        setLoadingState(false); // 停止初始加载状态

        // 显示任务启动状态
        showTaskStatus({
            status: 'pending',
            message: '任务已启动，正在后台处理中...',
            jobId: currentJobId
        });

        // 立即开始轮询状态（更频繁的检查）
        startStatusPolling();

    } catch (error) {
        console.error('启动异步工作流失败:', error);
        throw error;
    }
}

// 设置加载状态
function setLoadingState(isLoading) {
    if (isLoading) {
        submitBtn.disabled = true;
        btnText.textContent = '施展魔法中';
        loadingSpinner.style.display = 'block';
    } else {
        submitBtn.disabled = false;
        btnText.textContent = '施展魔法';
        loadingSpinner.style.display = 'none';
    }
}

// 设置按钮为任务运行状态
function setTaskRunningState(isRunning) {
    isTaskRunning = isRunning;

    if (isRunning) {
        submitBtn.disabled = true;
        btnText.textContent = '任务进行中，请稍候...';
        loadingSpinner.style.display = 'block';

        // 设置3分钟超时，之后重新启用按钮
        buttonTimeoutId = setTimeout(() => {
            console.log('⏰ 3分钟超时，重新启用按钮');
            enableButtonAfterTimeout();
        }, BUTTON_TIMEOUT);

    } else {
        // 清除超时定时器
        if (buttonTimeoutId) {
            clearTimeout(buttonTimeoutId);
            buttonTimeoutId = null;
        }

        submitBtn.disabled = false;
        btnText.textContent = '施展魔法';
        loadingSpinner.style.display = 'none';
    }
}

// 超时后启用按钮
function enableButtonAfterTimeout() {
    isTaskRunning = false;

    if (buttonTimeoutId) {
        clearTimeout(buttonTimeoutId);
        buttonTimeoutId = null;
    }

    submitBtn.disabled = false;
    btnText.textContent = '施展魔法';
    loadingSpinner.style.display = 'none';

    // 显示超时提示
    showError('任务处理时间较长，按钮已重新启用。您可以重新提交或等待当前任务完成。⏰');
}

// 清理所有定时器和状态
function cleanupTaskState() {
    // 清理轮询定时器
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }

    // 清理初始延迟定时器
    if (initialDelayTimeout) {
        clearTimeout(initialDelayTimeout);
        initialDelayTimeout = null;
    }

    // 清理按钮超时定时器
    if (buttonTimeoutId) {
        clearTimeout(buttonTimeoutId);
        buttonTimeoutId = null;
    }

    // 重置状态
    isTaskRunning = false;
    statusCheckCount = 0;
    currentJobId = null;
}

// 显示结果
function displayResults(data) {
    console.log('📊 显示结果数据:', data);

    // 优先显示 infojson 数据（主要内容）
    if (data.infoJson && data.infoJson.extracted_infojson) {
        const infojsonData = data.infoJson.extracted_infojson;
        console.log('📋 提取到的 infojson 数据:', infojsonData);

        // 创建美化的 infojson 显示
        outDataContainer.innerHTML = `
            <div class="infojson-display">
                <h4>📋 提取的客户信息</h4>
                <div class="infojson-grid">
                    ${Object.entries(infojsonData).map(([key, value]) => `
                        <div class="info-item">
                            <span class="info-key">${key}:</span>
                            <span class="info-value">${value || '未填写'}</span>
                        </div>
                    `).join('')}
                </div>
                <details class="raw-json">
                    <summary>查看原始 JSON 数据</summary>
                    <pre>${JSON.stringify(infojsonData, null, 2)}</pre>
                </details>
            </div>
        `;
    } else if (data.outData !== undefined) {
        // 备用显示 outData
        if (data.outData.includes('{')) {
            try {
                const parsedData = JSON.parse(data.outData);
                outDataContainer.innerHTML = `
                    <div class="infojson-display">
                        <h4>📋 提取的信息</h4>
                        <pre>${JSON.stringify(parsedData, null, 2)}</pre>
                    </div>
                `;
            } catch (e) {
                outDataContainer.textContent = data.outData;
            }
        } else {
            outDataContainer.textContent = data.outData;
        }
    } else {
        outDataContainer.textContent = '魔法还在准备中呢~ 🌟';
    }

    // 显示技术详情 (infoJson)
    if (data.infoJson) {
        try {
            const formattedJson = JSON.stringify(data.infoJson, null, 2);
            infoJsonContainer.textContent = formattedJson;
        } catch (error) {
            infoJsonContainer.textContent = '魔法详情格式化失败了~ 😢';
        }
    } else {
        infoJsonContainer.textContent = '暂时没有魔法详情哦~ ✨';
    }

    // 如果有下载链接，直接显示下载按钮
    if (data.downloadUrl) {
        console.log('🔗 发现下载链接:', data.downloadUrl);
        addDownloadSection(data.downloadUrl, data.fileName);
    } else {
        // 没有下载链接时，显示文档生成状态
        addDocumentGenerationStatus();
    }

    // 显示结果区域
    resultsSection.style.display = 'block';

    // 滚动到结果区域
    resultsSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// 添加下载区域
function addDownloadSection(downloadUrl, fileName) {
    const downloadSection = document.createElement('div');
    downloadSection.className = 'download-section';
    downloadSection.innerHTML = `
        <h3 class="status-title">📄 文档已生成</h3>
        <div class="download-content">
            <p>您的魔法文档已经准备好了！✨</p>
            <a href="${downloadUrl}"
               class="download-btn"
               download="${fileName || 'workflow_result.docx'}"
               target="_blank">
                📄 下载魔法文档
            </a>
            <p class="download-info">
                生成时间: ${new Date().toLocaleString()}
            </p>
        </div>
    `;

    // 添加到结果区域
    resultsSection.appendChild(downloadSection);
}

// 显示错误信息
function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'block';
    
    // 滚动到错误信息
    errorMessage.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

// 隐藏错误信息
function hideError() {
    errorMessage.style.display = 'none';
}

// 隐藏结果
function hideResults() {
    resultsSection.style.display = 'none';
    // 清除之前的下载区域和状态区域
    const existingDownloadSection = document.querySelector('.download-section');
    const existingStatusSection = document.querySelector('.document-status-section');
    if (existingDownloadSection) {
        existingDownloadSection.remove();
    }
    if (existingStatusSection) {
        existingStatusSection.remove();
    }
}

// 输入框焦点效果
userInput.addEventListener('focus', () => {
    userInput.parentElement.classList.add('focused');
});

userInput.addEventListener('blur', () => {
    userInput.parentElement.classList.remove('focused');
});

// 键盘快捷键支持
document.addEventListener('keydown', (event) => {
    // Ctrl/Cmd + Enter 提交表单
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!submitBtn.disabled) {
            form.dispatchEvent(new Event('submit'));
        }
    }
});

// 添加文档生成状态区域
function addDocumentGenerationStatus() {
    const statusSection = document.createElement('div');
    statusSection.className = 'document-status-section';
    statusSection.id = 'document-status';
    statusSection.innerHTML = `
        <h3 class="status-title">📄 文档生成状态</h3>
        <div class="status-content">
            <div class="status-indicator">
                <span class="status-icon">⏳</span>
                <span class="status-text">正在生成魔法文档...</span>
            </div>
            <div class="status-progress">
                <div class="progress-bar"></div>
            </div>
        </div>
    `;

    // 添加到结果区域
    resultsSection.appendChild(statusSection);
}

// 异步生成文档
async function generateDocumentAsync(workflowData) {
    const statusSection = document.getElementById('document-status');
    const statusIcon = statusSection.querySelector('.status-icon');
    const statusText = statusSection.querySelector('.status-text');

    try {
        statusText.textContent = '正在调用 Google Apps Script...';

        // 配置 API 基础 URL
        const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'https://workflow.lilingbo.top'  // 本地开发时使用线上 API
            : '';  // 生产环境使用相对路径

        const apiUrl = `${API_BASE_URL}/api/generate-document`;
        console.log('调用文档生成 API:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                workflowData: workflowData
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        // 更新状态为成功
        statusIcon.textContent = '✅';
        statusText.textContent = '文档生成成功！';

        // 添加下载按钮
        const downloadHtml = `
            <div class="download-section">
                <p>您的魔法文档已经准备好了！✨</p>
                <a href="${result.downloadUrl}"
                   class="download-btn"
                   download="${result.fileName}"
                   target="_blank">
                    📄 下载魔法文档
                </a>
                <p class="download-info">
                    文档 ID: ${result.docId}<br>
                    文件大小: ${(result.fileSize / 1024).toFixed(1)} KB<br>
                    生成时间: ${new Date(result.timestamp).toLocaleString()}
                </p>
            </div>
        `;

        statusSection.querySelector('.status-content').innerHTML += downloadHtml;

    } catch (error) {
        console.error('文档生成失败:', error);
        statusIcon.textContent = '❌';
        statusText.textContent = '文档生成失败，请稍后重试';
    }
}

// 开始状态轮询
function startStatusPolling() {
    // 清理之前的定时器
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    if (initialDelayTimeout) {
        clearTimeout(initialDelayTimeout);
    }

    statusCheckCount = 0; // 重置计数器

    console.log('📅 状态轮询策略：前1分钟不查询，之后每10秒查询一次');

    // 前1分钟不查询，1分钟后开始轮询
    initialDelayTimeout = setTimeout(() => {
        console.log('⏰ 1分钟等待结束，开始状态轮询...');

        statusCheckInterval = setInterval(async () => {
            try {
                statusCheckCount++;

                // 超时保护
                if (statusCheckCount > MAX_STATUS_CHECKS) {
                    clearInterval(statusCheckInterval);
                    statusCheckInterval = null;
                    setLoadingState(false);
                    setTaskRunningState(false); // 重置按钮状态
                    showError('任务处理超时（4分钟），请稍后重试或联系管理员 ⏰');
                    return;
                }

                console.log(`🔍 第 ${statusCheckCount} 次状态检查...`);
                await checkJobStatus();
            } catch (error) {
                console.error('状态检查失败:', error);
                // 继续轮询，不中断
            }
        }, POLLING_INTERVAL); // 每10秒检查一次
    }, INITIAL_DELAY); // 1分钟后开始
}

// 检查任务状态
async function checkJobStatus() {
    if (!currentJobId) return;

    // 配置 API 基础 URL
    let API_BASE_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        if (window.location.port === '3000') {
            API_BASE_URL = '';
        } else {
            API_BASE_URL = 'https://workflow.lilingbo.top';
        }
    }

    const checkUrl = `${API_BASE_URL}/api/check-status?jobId=${currentJobId}`;

    const response = await fetch(checkUrl);
    if (!response.ok) {
        throw new Error(`状态检查失败: ${response.status}`);
    }

    const statusData = await response.json();
    console.log('📊 任务状态更新:', statusData);

    // 更新状态显示
    updateTaskStatus(statusData);

    // 如果任务完成或失败，停止轮询
    if (statusData.status === 'completed' || statusData.status === 'failed') {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
        setLoadingState(false);
        setTaskRunningState(false); // 重置按钮状态

        if (statusData.status === 'completed') {
            // 显示完成结果
            displayResults(statusData.result);
        } else if (statusData.status === 'failed') {
            // 显示失败信息
            showError(`任务处理失败: ${statusData.error || '未知错误'} 😢`);
        }
    }
}

// 显示任务状态
function showTaskStatus(statusData) {
    // 创建状态显示区域
    const statusSection = document.createElement('div');
    statusSection.className = 'task-status-section';
    statusSection.id = 'task-status';
    statusSection.innerHTML = `
        <h3 class="status-title">🔄 任务处理状态</h3>
        <div class="status-content">
            <div class="status-indicator">
                <span class="status-icon">⏳</span>
                <span class="status-text">${statusData.message}</span>
            </div>
            <div class="status-details">
                <p>任务 ID: ${statusData.jobId}</p>
                <p>状态: <span class="status-badge ${statusData.status}">${getStatusText(statusData.status)}</span></p>
                <p>轮询策略: 前1分钟不查询，之后每10秒查询</p>
                <p>超时时间: 4分钟</p>
            </div>
        </div>
    `;

    // 显示状态区域
    resultsSection.style.display = 'block';
    resultsSection.appendChild(statusSection);

    // 滚动到状态区域
    statusSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// 更新任务状态
function updateTaskStatus(statusData) {
    const statusSection = document.getElementById('task-status');
    if (!statusSection) return;

    const statusIcon = statusSection.querySelector('.status-icon');
    const statusText = statusSection.querySelector('.status-text');
    const statusBadge = statusSection.querySelector('.status-badge');

    // 更新图标
    switch (statusData.status) {
        case 'pending':
            statusIcon.textContent = '⏳';
            break;
        case 'processing':
            statusIcon.textContent = '⚙️';
            break;
        case 'completed':
            statusIcon.textContent = '✅';
            break;
        case 'failed':
            statusIcon.textContent = '❌';
            break;
    }

    // 更新文本和状态
    statusText.textContent = statusData.message;
    statusBadge.textContent = getStatusText(statusData.status);
    statusBadge.className = `status-badge ${statusData.status}`;

    // 如果完成，显示下载链接
    if (statusData.status === 'completed' && statusData.downloadUrl) {
        const downloadHtml = `
            <div class="download-section">
                <p>您的魔法文档已经准备好了！✨</p>
                <a href="${statusData.downloadUrl}"
                   class="download-btn"
                   download="${statusData.fileName || 'workflow_result.docx'}"
                   target="_blank">
                    📄 下载魔法文档
                </a>
            </div>
        `;
        statusSection.querySelector('.status-content').innerHTML += downloadHtml;
    }
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'pending': '等待中',
        'processing': '处理中',
        'completed': '已完成',
        'failed': '失败'
    };
    return statusMap[status] || status;
}

// 调用代理 API（现在改为异步模式，这个函数已废弃，保留用于兼容）
async function callProxyAPI(inputValue) {
    console.warn('callProxyAPI 已废弃，请使用 startAsyncWorkflow');

    // 为了兼容性，这里调用旧的 worker API
    let API_BASE_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        if (window.location.port === '3000') {
            API_BASE_URL = '';
        } else {
            API_BASE_URL = 'https://workflow.lilingbo.top';
        }
    }

    const apiUrl = `${API_BASE_URL}/api/worker`;
    console.log('调用 Worker API (兼容模式):', apiUrl);

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            input: inputValue
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
}

// 直接调用 Coze API
async function callDirectCozeAPI(inputValue) {
    const token = localStorage.getItem('cozeApiToken');
    const workflowId = localStorage.getItem('cozeWorkflowId');

    if (!token || !workflowId) {
        throw new Error('请先配置 Coze API Token 和 Workflow ID');
    }

    console.log('直接调用 Coze API:', {
        workflowId,
        tokenPrefix: token.substring(0, 10) + '...'
    });

    // 使用工作流流式运行端点
    const response = await fetch('https://api.coze.cn/v1/workflow/stream_run', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
            workflow_id: workflowId,
            parameters: {
                input: inputValue
            },
            stream: true
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Coze API 错误: ${response.status} ${response.statusText}\n${errorText}`);
    }

    // 处理流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    let messageData = null;
    let infojson = null;
    let outData = '';

    console.log('开始处理流式响应...');

    while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        result += chunk;

        // 解析 Server-Sent Events
        const lines = chunk.split('\n');
        let currentEvent = '';

        for (const line of lines) {
            if (line.startsWith('event: ')) {
                currentEvent = line.substring(7).trim();
            } else if (line.startsWith('data: ')) {
                const dataStr = line.substring(6);
                if (dataStr && dataStr !== '[DONE]') {
                    try {
                        const eventData = JSON.parse(dataStr);
                        console.log('收到事件:', currentEvent, eventData);

                        // 处理 Message 事件
                        if (currentEvent === 'Message' && eventData.content) {
                            try {
                                const contentData = JSON.parse(eventData.content);
                                console.log('解析 Message 内容:', contentData);

                                if (contentData.infojson) {
                                    infojson = contentData.infojson;
                                    console.log('提取到 infojson:', infojson);
                                }

                                if (contentData.outData) {
                                    outData = contentData.outData;
                                }

                                messageData = contentData;
                            } catch (contentParseError) {
                                console.warn('解析 Message content 失败:', contentParseError);
                            }
                        }
                    } catch (e) {
                        console.warn('解析事件数据失败:', e);
                    }
                }
            }
        }
    }

    console.log('流式响应处理完成:', {
        hasInfojson: !!infojson,
        hasOutData: !!outData,
        hasMessageData: !!messageData
    });

    // 返回标准格式
    return {
        success: true,
        outData: outData || JSON.stringify(infojson, null, 2) || '处理完成',
        infoJson: {
            timestamp: new Date().toISOString(),
            workflow_id: workflowId,
            input_length: inputValue.length,
            response_data: infojson || messageData,
            api_method: 'direct_coze_stream',
            raw_response: result,
            extracted_infojson: infojson
        }
    };
}

// 切换直接 API 模式
function toggleDirectAPI() {
    const configSection = document.getElementById('api-config');
    const isVisible = configSection.style.display !== 'none';

    if (isVisible) {
        configSection.style.display = 'none';
    } else {
        configSection.style.display = 'block';
        // 加载已保存的配置
        const savedToken = localStorage.getItem('cozeApiToken');
        const savedWorkflowId = localStorage.getItem('cozeWorkflowId');

        if (savedToken) {
            document.getElementById('coze-token').value = savedToken;
        }
        if (savedWorkflowId) {
            document.getElementById('workflow-id').value = savedWorkflowId;
        }
    }
}

// 保存直接 API 配置
function saveDirectAPIConfig() {
    const token = document.getElementById('coze-token').value.trim();
    const workflowId = document.getElementById('workflow-id').value.trim();

    if (!token) {
        alert('请输入 Coze API Token');
        return;
    }

    if (!workflowId) {
        alert('请输入 Workflow ID');
        return;
    }

    // 保存配置
    localStorage.setItem('cozeApiToken', token);
    localStorage.setItem('cozeWorkflowId', workflowId);
    localStorage.setItem('useDirectCozeAPI', 'true');

    // 隐藏配置区域
    document.getElementById('api-config').style.display = 'none';

    // 更新按钮文本
    const toggleBtn = document.querySelector('.toggle-btn');
    toggleBtn.textContent = '🔧 使用代理 API';
    toggleBtn.onclick = () => {
        localStorage.setItem('useDirectCozeAPI', 'false');
        toggleBtn.textContent = '🔧 直接调用 Coze API';
        toggleBtn.onclick = toggleDirectAPI;
        alert('已切换到代理 API 模式');
    };

    alert('配置已保存！现在将直接调用 Coze API');
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    // 聚焦到输入框
    userInput.focus();

    // 检查是否使用直接 API
    const useDirectAPI = localStorage.getItem('useDirectCozeAPI') === 'true';
    if (useDirectAPI) {
        const toggleBtn = document.querySelector('.toggle-btn');
        toggleBtn.textContent = '🔧 使用代理 API';
        toggleBtn.onclick = () => {
            localStorage.setItem('useDirectCozeAPI', 'false');
            toggleBtn.textContent = '🔧 直接调用 Coze API';
            toggleBtn.onclick = toggleDirectAPI;
            alert('已切换到代理 API 模式');
        };
    }

    // 添加一些视觉效果
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
});

// 工具函数：复制到剪贴板
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        return new Promise((resolve, reject) => {
            document.execCommand('copy') ? resolve() : reject();
            textArea.remove();
        });
    }
}

// 为结果添加复制功能
function addCopyFunctionality() {
    const resultContainers = document.querySelectorAll('.result-container');
    
    resultContainers.forEach(container => {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = '📋 复制';
        copyBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 255, 255, 0.2);
            border: 1px solid #00ffff;
            color: #00ffff;
            padding: 5px 10px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.8rem;
        `;
        
        container.style.position = 'relative';
        container.appendChild(copyBtn);
        
        copyBtn.addEventListener('click', async () => {
            const content = container.querySelector('.result-content').textContent;
            try {
                await copyToClipboard(content);
                copyBtn.innerHTML = '✅ 已复制';
                setTimeout(() => {
                    copyBtn.innerHTML = '📋 复制';
                }, 2000);
            } catch (error) {
                console.error('复制失败:', error);
                copyBtn.innerHTML = '❌ 复制失败';
                setTimeout(() => {
                    copyBtn.innerHTML = '📋 复制';
                }, 2000);
            }
        });
    });
}
