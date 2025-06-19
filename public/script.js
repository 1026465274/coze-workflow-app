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

        // 检测是否在本地开发环境
        const isLocalDev = window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1' ||
                          window.location.hostname.includes('localhost') ||
                          (window.location.port && ['3000', '3001', '8080', '5000'].includes(window.location.port));

        if (isLocalDev) {
            // 本地开发模式：使用模拟数据
            console.log('✨ 魔法开发模式：使用模拟咒语响应');

            // 模拟 API 延迟
            await new Promise(resolve => setTimeout(resolve, 1500));

            // 模拟 API 响应
            data = {
                success: true,
                outData: `🌟 魔法已施展完成！✨\n\n你的愿望："${inputValue}"\n\n💕 这是模拟的魔法结果哦~ 当部署到真实的魔法世界（Vercel）后，这里将显示真正的 Coze 工作流魔法效果！\n\n🎀 愿你的每个梦想都能实现~ `,
                infoJson: {
                    timestamp: new Date().toISOString(),
                    magic_spell_id: "✨魔法咒语ID✨",
                    wish_length: inputValue.length,
                    mode: "🌸 少女魔法开发模式 🌸",
                    note: "这是模拟的魔法数据，部署后将显示真实的 Coze 魔法响应 💖",
                    magic_details: {
                        status: "success ✨",
                        casting_time: "1.5s 🕐",
                        is_simulation: true,
                        sparkles: "✨🌟💫⭐",
                        cuteness_level: "Maximum 💕"
                    }
                }
            };
        } else {
            // 生产环境：调用真实 API
            const response = await fetch('/api/run-workflow', {
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

            data = await response.json();
        }
        
        // 检查返回数据格式
        if (!data || typeof data !== 'object') {
            throw new Error('魔法咒语格式不正确呢~ 😢');
        }
        
        // 立即显示工作流结果
        displayResults(data);

        // 异步生成文档下载链接
        if (data.infoJson && data.infoJson.response_data) {
            generateDocumentAsync(data.infoJson.response_data);
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
        outDataContainer.textContent = data.outData;
    } else {
        outDataContainer.textContent = '魔法还在准备中呢~ 🌟';
    }

    // 显示 infoJson
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

        const response = await fetch('/api/generate-document', {
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

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
    // 聚焦到输入框
    userInput.focus();

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
