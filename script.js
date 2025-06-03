document.addEventListener('DOMContentLoaded', function() {
    const inputElement = document.getElementById('input');
    const formatBtn = document.getElementById('formatBtn');
    const clearBtn = document.getElementById('clearBtn');
    const tableContainer = document.getElementById('table-container');
    
    // タブ関連の要素
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    // パースされたJSONデータを保持
    let parsedData = [];

    // タブ切り替え機能
    function switchTab(tabName) {
        tabButtons.forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        tabPanels.forEach(panel => {
            if (panel.id === `${tabName}-tab`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    }
    
    // タブボタンのイベントリスナー
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            switchTab(button.dataset.tab);
        });
    });

    function formatJsonLines() {
        const input = inputElement.value.trim();
        parsedData = [];

        if (!input) {
            alert('JSON Lines を入力してください');
            return;
        }

        const lines = input.split('\n').filter(line => line.trim());
        let hasError = false;
        const errors = [];

        lines.forEach((line, index) => {
            try {
                const json = JSON.parse(line);
                parsedData.push(json);
            } catch (e) {
                hasError = true;
                errors.push(`行 ${index + 1}: ${e.message}`);
            }
        });

        if (hasError) {
            alert('JSONパースエラー:\n' + errors.join('\n'));
            return;
        }

        if (parsedData.length > 0) {
            createTable();
            switchTab('table');
        }
    }
    
    // すべてのキーを収集（ネストされたキーは.で結合）
    function collectAllKeys(data) {
        const keys = new Set();
        const objectOnlyKeys = new Set();
        
        function extractKeys(obj, prefix = '') {
            for (const key in obj) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                
                if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                    // オブジェクトの場合は再帰的に処理
                    extractKeys(obj[key], fullKey);
                } else {
                    // プリミティブ値または配列の場合のみキーを追加
                    keys.add(fullKey);
                }
            }
        }
        
        // すべてのデータからキーを抽出
        data.forEach(item => extractKeys(item));
        
        // オブジェクトのみを含むキーをチェック
        const allPossibleKeys = new Set();
        function collectAllPossibleKeys(obj, prefix = '') {
            for (const key in obj) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                allPossibleKeys.add(fullKey);
                
                if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                    collectAllPossibleKeys(obj[key], fullKey);
                }
            }
        }
        
        data.forEach(item => collectAllPossibleKeys(item));
        
        // すべてのデータでオブジェクトのみのキーを特定
        allPossibleKeys.forEach(key => {
            let isAlwaysObject = true;
            let hasValue = false;
            
            data.forEach(item => {
                const value = getNestedValue(item, key, true);
                if (value !== undefined) {
                    hasValue = true;
                    if (!(value !== null && typeof value === 'object' && !Array.isArray(value))) {
                        isAlwaysObject = false;
                    }
                }
            });
            
            if (hasValue && isAlwaysObject) {
                objectOnlyKeys.add(key);
            }
        });
        
        // オブジェクトのみのキーを除外
        const filteredKeys = Array.from(keys).filter(key => {
            // このキーの親キーがオブジェクトのみのキーでないことを確認
            const parts = key.split('.');
            for (let i = 1; i <= parts.length; i++) {
                const parentKey = parts.slice(0, i).join('.');
                if (objectOnlyKeys.has(parentKey)) {
                    return true; // 親がオブジェクトのみでも、子は表示
                }
            }
            return true;
        });
        
        return filteredKeys.sort();
    }
    
    // ネストされたオブジェクトから値を取得
    function getNestedValue(obj, path, returnRaw = false) {
        const keys = path.split('.');
        let value = obj;
        
        for (const key of keys) {
            if (value === null || value === undefined) {
                return returnRaw ? undefined : '';
            }
            value = value[key];
        }
        
        if (returnRaw) {
            return value;
        }
        
        if (value === null || value === undefined) {
            return '';
        }
        
        // オブジェクトは表示しない
        if (typeof value === 'object' && !Array.isArray(value)) {
            return '';
        }
        
        // 配列の場合はJSON文字列として表示
        if (Array.isArray(value)) {
            const jsonStr = JSON.stringify(value);
            if (jsonStr.length > 30) {
                return jsonStr.substring(0, 30) + '…';
            }
            return jsonStr;
        }
        
        // 文字列の場合は30文字で切る
        const strValue = String(value);
        if (strValue.length > 30) {
            return strValue.substring(0, 30) + '…';
        }
        
        return strValue;
    }
    
    // テーブル作成関数
    function createTable() {
        if (parsedData.length === 0) {
            tableContainer.innerHTML = '<div class="empty-state">表示するデータがありません</div>';
            return;
        }
        
        const allKeys = collectAllKeys(parsedData);
        
        // テーブル要素の作成
        const table = document.createElement('table');
        
        // ヘッダー行の作成
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        allKeys.forEach(key => {
            const th = document.createElement('th');
            th.textContent = key;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // データ行の作成
        const tbody = document.createElement('tbody');
        
        parsedData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.dataset.index = index;
            
            allKeys.forEach(key => {
                const td = document.createElement('td');
                const value = getNestedValue(item, key, true);
                const displayValue = getNestedValue(item, key);
                
                // 文字列が省略されている場合、クリック可能にする
                if (typeof value === 'string' && value.length > 30) {
                    td.innerHTML = `<span class="truncated-string" title="クリックして全体を表示">${escapeHtml(displayValue)}</span>`;
                    td.querySelector('.truncated-string').addEventListener('click', (e) => {
                        e.stopPropagation();
                        showStringDialog(value);
                    });
                } else {
                    td.textContent = displayValue;
                }
                
                row.appendChild(td);
            });
            
            // 行クリックイベント
            row.addEventListener('click', () => {
                showJsonDialog(item);
            });
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        
        // テーブルをコンテナに追加
        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
    }

    function clearAll() {
        inputElement.value = '';
        tableContainer.innerHTML = '';
        parsedData = [];
        switchTab('input');
    }

    formatBtn.addEventListener('click', formatJsonLines);
    clearBtn.addEventListener('click', clearAll);

    // Enter キーで整形実行
    inputElement.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            formatJsonLines();
        }
    });

    // インデントガイドを生成
    function createIndentGuides(level) {
        let guides = '';
        for (let i = 1; i <= level; i++) {
            const colorClass = `indent-guide-${((i - 1) % 6) + 1}`;
            guides += `<span class="indent-guide-container"><span class="indent-guide ${colorClass}"></span></span> `;
        }
        return guides;
    }
    
    // JSONをHTMLに変換（構文ハイライトとインデントレインボー付き）
    function jsonToHtml(obj, indent = 0, inArray = false) {
        let html = '';
        
        if (obj === null) {
            return `<span class="json-null">null</span>`;
        }
        
        if (typeof obj === 'boolean') {
            return `<span class="json-boolean">${obj}</span>`;
        }
        
        if (typeof obj === 'number') {
            return `<span class="json-number">${obj}</span>`;
        }
        
        if (typeof obj === 'string') {
            if (obj.length > 30) {
                const truncated = obj.substring(0, 30);
                const stringId = 'str-' + Math.random().toString(36).substr(2, 9);
                // 文字列をグローバルに保存
                window.fullStrings = window.fullStrings || {};
                window.fullStrings[stringId] = obj;
                return `<span class="json-string truncated-string" data-string-id="${stringId}" title="クリックして全体を表示">"${escapeHtml(truncated)}…"</span>`;
            }
            return `<span class="json-string">"${escapeHtml(obj)}"</span>`;
        }
        
        if (Array.isArray(obj)) {
            if (obj.length === 0) {
                return `<span class="json-bracket">[]</span>`;
            }
            
            const arrayId = 'arr-' + Math.random().toString(36).substr(2, 9);
            html += `<span class="json-bracket">[</span>\n`;
            
            if (obj.length > 3) {
                // 最初の3要素を表示
                for (let i = 0; i < 3; i++) {
                    html += `${createIndentGuides(indent + 1)}${jsonToHtml(obj[i], indent + 1, true)}`;
                    html += ',\n';
                }
                
                // 省略表示と残りの要素を格納
                html += `${createIndentGuides(indent + 1)}<span class="expand-array" data-array-id="${arrayId}">… (他${obj.length - 3}要素)</span>`;
                
                // 残りの要素（初期状態では非表示）
                html += `<span id="${arrayId}" style="display: none;">`;
                for (let i = 3; i < obj.length; i++) {
                    html += ',\n';
                    html += `${createIndentGuides(indent + 1)}${jsonToHtml(obj[i], indent + 1, true)}`;
                }
                html += `</span>`;
                html += '\n';
            } else {
                // 3要素以下の場合は通常表示
                obj.forEach((item, index) => {
                    html += `${createIndentGuides(indent + 1)}${jsonToHtml(item, indent + 1, true)}`;
                    if (index < obj.length - 1) {
                        html += ',';
                    }
                    html += '\n';
                });
            }
            
            html += `${createIndentGuides(indent)}<span class="json-bracket">]</span>`;
            return html;
        }
        
        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) {
                return `<span class="json-bracket">{}</span>`;
            }
            
            const objId = 'obj-' + Math.random().toString(36).substr(2, 9);
            
            // 配列内のオブジェクトにも展開ボタンを追加
            if (inArray && keys.length > 0) {
                const keyId = objId + '-arr';
                html += `<span class="json-bracket">{</span> <span class="collapsible-key collapse-icon" data-key-id="${keyId}">▼</span>\n`;
                html += `<span id="${keyId}-value">`;
                html += `<span class="object-content" id="${objId}">`;
                keys.forEach((key, index) => {
                    const value = obj[key];
                    html += `${createIndentGuides(indent + 1)}<span class="json-key">"${escapeHtml(key)}"</span>: ${jsonToHtml(value, indent + 1)}`;
                    if (index < keys.length - 1) {
                        html += ',';
                    }
                    html += '\n';
                });
                html += `</span>`;
                html += `</span>`;
            } else {
                html += `<span class="json-bracket">{</span>\n`;
                // オブジェクトの内容を格納するコンテナ
                html += `<span class="object-content" id="${objId}">`;
                keys.forEach((key, index) => {
                    const value = obj[key];
                    const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
                    
                    if (isObject && Object.keys(value).length > 0) {
                        // 折りたたみ可能なオブジェクト
                        const keyId = objId + '-' + index;
                        const valueHtml = jsonToHtml(value, indent + 1);
                        // {の後に展開ボタンを挿入
                        const modifiedValueHtml = valueHtml.replace(
                            /^<span class="json-bracket">{<\/span>/,
                            `<span class="json-bracket">{</span> <span class="collapsible-key collapse-icon" data-key-id="${keyId}">▼</span>`
                        );
                        html += `${createIndentGuides(indent + 1)}<span class="json-key">"${escapeHtml(key)}"</span>: <span id="${keyId}-value">${modifiedValueHtml}</span>`;
                    } else {
                        // 通常のキー
                        html += `${createIndentGuides(indent + 1)}<span class="json-key">"${escapeHtml(key)}"</span>: ${jsonToHtml(value, indent + 1)}`;
                    }
                    
                    if (index < keys.length - 1) {
                        html += ',';
                    }
                    html += '\n';
                });
                html += `</span>`;
            }
            
            html += `${createIndentGuides(indent)}<span class="json-bracket">}</span>`;
            return html;
        }
        
        return String(obj);
    }
    
    // HTMLエスケープ
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    // ダイアログ表示
    function showJsonDialog(json) {
        const dialog = document.getElementById('json-dialog');
        const jsonDisplay = document.getElementById('json-display');
        
        // 文字列をリセット
        window.fullStrings = {};
        
        jsonDisplay.innerHTML = jsonToHtml(json);
        dialog.classList.add('active');
        
        // 省略された文字列のクリックイベントを設定
        setupTruncatedStringHandlers();
        
        // 折りたたみ可能なキーのクリックイベントを設定
        setupCollapsibleHandlers();
        
        // 配列の展開リンクのクリックイベントを設定
        setupArrayExpandHandlers();
    }
    
    // 省略された文字列のクリックハンドラーを設定
    function setupTruncatedStringHandlers() {
        const truncatedStrings = document.querySelectorAll('.truncated-string');
        truncatedStrings.forEach(elem => {
            elem.addEventListener('click', (e) => {
                e.stopPropagation();
                const stringId = elem.dataset.stringId;
                const fullString = window.fullStrings[stringId];
                if (fullString) {
                    showStringDialog(fullString);
                }
            });
        });
    }
    
    // 文字列詳細ダイアログを表示
    function showStringDialog(str) {
        const dialog = document.getElementById('string-dialog');
        const stringDisplay = document.getElementById('string-display');
        
        stringDisplay.textContent = str;
        dialog.classList.add('active');
    }
    
    // 折りたたみ可能なキーのハンドラーを設定
    function setupCollapsibleHandlers() {
        const collapsibleKeys = document.querySelectorAll('.collapsible-key');
        collapsibleKeys.forEach(elem => {
            elem.addEventListener('click', (e) => {
                e.stopPropagation();
                const keyId = elem.dataset.keyId;
                const valueElem = document.getElementById(keyId + '-value');
                const icon = elem.querySelector('.collapse-icon');
                
                if (valueElem) {
                    const isCollapsed = elem.classList.contains('collapsed');
                    
                    if (isCollapsed) {
                        // 展開
                        elem.classList.remove('collapsed');
                        const originalContent = elem.dataset.originalContent;
                        if (originalContent) {
                            valueElem.innerHTML = originalContent;
                        }
                        icon.textContent = '▼';
                        
                        // 展開後のハンドラーを再設定
                        setupTruncatedStringHandlers();
                        setupCollapsibleHandlers();
                        setupArrayExpandHandlers();
                    } else {
                        // 折りたたむ
                        elem.classList.add('collapsed');
                        // 元のコンテンツをデータ属性に保存
                        elem.dataset.originalContent = valueElem.innerHTML;
                        valueElem.innerHTML = '<span class="collapsed-placeholder">{...}</span>';
                        icon.textContent = '▶';
                    }
                }
            });
        });
    }
    
    // 配列の展開ハンドラーを設定
    function setupArrayExpandHandlers() {
        const expandLinks = document.querySelectorAll('.expand-array');
        expandLinks.forEach(elem => {
            elem.addEventListener('click', (e) => {
                e.stopPropagation();
                const arrayId = elem.dataset.arrayId;
                const hiddenElements = document.getElementById(arrayId);
                
                if (hiddenElements) {
                    // 省略表示を削除
                    elem.style.display = 'none';
                    // 残りの要素を表示
                    hiddenElements.style.display = 'inline';
                    
                    // ハンドラーを再設定
                    setupTruncatedStringHandlers();
                    setupCollapsibleHandlers();
                }
            });
        });
    }
    
    // ダイアログ関連のイベントリスナー
    const jsonDialog = document.getElementById('json-dialog');
    const stringDialog = document.getElementById('string-dialog');
    
    // JSONダイアログのイベント
    const jsonCloseButton = jsonDialog.querySelector('.dialog-close');
    jsonCloseButton.addEventListener('click', () => {
        jsonDialog.classList.remove('active');
    });
    
    jsonDialog.addEventListener('click', (e) => {
        if (e.target === jsonDialog) {
            jsonDialog.classList.remove('active');
        }
    });
    
    // 文字列ダイアログのイベント
    const stringCloseButton = stringDialog.querySelector('.dialog-close');
    stringCloseButton.addEventListener('click', () => {
        stringDialog.classList.remove('active');
    });
    
    stringDialog.addEventListener('click', (e) => {
        if (e.target === stringDialog) {
            stringDialog.classList.remove('active');
        }
    });
    
    // コピーボタンのイベント
    const copyButton = document.getElementById('copy-string-btn');
    copyButton.addEventListener('click', async () => {
        const stringDisplay = document.getElementById('string-display');
        const text = stringDisplay.textContent;
        
        try {
            await navigator.clipboard.writeText(text);
            copyButton.textContent = 'コピーしました！';
            setTimeout(() => {
                copyButton.textContent = 'クリップボードにコピー';
            }, 2000);
        } catch (err) {
            console.error('コピーに失敗しました:', err);
            copyButton.textContent = 'コピーに失敗しました';
            setTimeout(() => {
                copyButton.textContent = 'クリップボードにコピー';
            }, 2000);
        }
    });
    
    // ESCキーでダイアログを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (stringDialog.classList.contains('active')) {
                stringDialog.classList.remove('active');
            } else if (jsonDialog.classList.contains('active')) {
                jsonDialog.classList.remove('active');
            }
        }
    });

    // 初期状態の設定
    tableContainer.innerHTML = '';
});