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

// 表单提交事件监听
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    console.log('用户输入:', userInput.value);
    const inputValue = userInput.value.trim();
    
    // 输入验证
    if (!inputValue) {
        showError('请告诉我你的愿望哦~ 💕');
        return;
    }
    
    // 开始处理
    setLoadingState(true);
    hideError();
    hideResults();
    
    try {
        let data;

        // 检查是否使用直接 Coze API
        const useDirectAPI = localStorage.getItem('useDirectCozeAPI') === 'true';

        if (useDirectAPI) {
            // 直接调用 Coze API
            data = await callDirectCozeAPI(inputValue);
        } else {
            // 使用代理 API
            data = await callProxyAPI(inputValue);
        }
   
        
        // 检查返回数据格式
        if (!data || typeof data !== 'object') {
            throw new Error('魔法咒语格式不正确呢~ 😢');
        }
        
        // 立即显示工作流结果
        displayResults(data);

        // 异步生成文档下载链接
        if (data.infoJson && (data.infoJson.extracted_infojson || data.infoJson.response_data)) {
            // 优先使用提取的 infojson，否则使用 response_data
            const workflowData = data.infoJson.extracted_infojson || data.infoJson.response_data;
            generateDocumentAsync(workflowData);
        }

    } catch (error) {
        console.error('💔 魔法施展失败:', error);
        showError(`魔法失败了呢~ ${error.message} 😢`);
    } finally {
        setLoadingState(false);
    }
});

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

// 显示结果
function displayResults(data) {
    // 显示 outData
    if (data.outData !== undefined) {
        // 如果 outData 是 JSON 格式的 infojson，美化显示
        if (data.infoJson && data.infoJson.extracted_infojson && data.outData.includes('{')) {
            try {
                const parsedData = JSON.parse(data.outData);
                outDataContainer.innerHTML = `
                    <div class="infojson-display">
                        <h4>📋 提取的信息 (infojson)</h4>
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

    // 显示 infoJson
    if (data.infoJson) {
        try {
            // 如果有提取的 infojson，优先显示
            if (data.infoJson.extracted_infojson) {
                const displayData = {
                    ...data.infoJson,
                    主要数据: data.infoJson.extracted_infojson
                };
                const formattedJson = JSON.stringify(displayData, null, 2);
                infoJsonContainer.textContent = formattedJson;
            } else {
                const formattedJson = JSON.stringify(data.infoJson, null, 2);
                infoJsonContainer.textContent = formattedJson;
            }
        } catch (error) {
            infoJsonContainer.textContent = '魔法详情格式化失败了~ 😢';
        }
    } else {
        infoJsonContainer.textContent = '暂时没有魔法详情哦~ ✨';
    }

    // 添加文档生成状态区域
    addDocumentGenerationStatus();
    
    // 显示结果区域
    resultsSection.style.display = 'block';
    
    // 滚动到结果区域
    resultsSection.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
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

// 调用代理 API
async function callProxyAPI(inputValue) {
    // 配置 API 基础 URL
    let API_BASE_URL = '';

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // 本地开发：检查是否有本地 Vercel Dev 服务器运行
        if (window.location.port === '3000') {
            API_BASE_URL = '';  // 使用本地 Vercel Dev 服务器 (localhost:3000)
            console.log('使用本地 Vercel Dev 服务器');
        } else {
            API_BASE_URL = 'https://workflow.lilingbo.top';  // 使用线上 API
            console.log('本地开发，调用线上 API');
        }
    } else {
        API_BASE_URL = '';  // 生产环境使用相对路径
        console.log('生产环境，使用相对路径');
    }

    const apiUrl = `${API_BASE_URL}/api/run-workflow`;
    console.log('调用代理 API:', apiUrl);

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
