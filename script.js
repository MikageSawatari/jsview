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
    
    // 折りたたみ可能なオブジェクトをレンダリング
    function renderCollapsibleObject(obj, indent, trailingComma = '', isTopLevel = false) {
        const objId = 'obj-' + Math.random().toString(36).substr(2, 9);
        const keys = Object.keys(obj);
        let html = '';
        
        // 開き括弧と折りたたみボタン（最上位階層では折りたたみボタンを表示しない）
        html += `<span class="json-bracket">{</span>`;
        if (!isTopLevel) {
            html += ` <span class="collapsible-toggle" data-action="toggle-collapse" data-target="${objId}">`;
            html += `<span class="collapse-icon">▼</span>`;
            html += `</span>`;
        }
        
        // 折りたたみ可能なコンテンツ
        html += `<span class="collapsible-group" id="${objId}">`;
        keys.forEach((key, index) => {
            const value = obj[key];
            const comma = index < keys.length - 1 ? ',' : '';
            html += `<span class="line">`;
            html += createIndentGuides(indent + 1);
            html += `<span class="json-key">"${escapeHtml(key)}"</span>: `;
            html += jsonToHtml(value, indent + 1, false, comma);
            html += `</span>`;
        });
        html += `</span>`;
        
        // 閉じ括弧（末尾カンマ付き）- 折りたたみ時には非表示
        html += `<span class="closing-bracket" id="${objId}-closing">`;
        html += `<span class="line">${createIndentGuides(indent)}<span class="json-bracket">}</span>${trailingComma}</span>`;
        html += `</span>`;
        
        // 折りたたみ時のプレースホルダー（最上位階層では不要）- 1行で表示
        if (!isTopLevel) {
            html += `<span class="collapsed-placeholder" id="${objId}-placeholder" style="display: none;" data-action="toggle-collapse" data-target="${objId}">`;
            html += `<span class="expand-trigger">... </span>`;
            html += `<span class="json-bracket">}</span>${trailingComma}`;
            html += `</span>`;
        }
        
        return html;
    }
    
    // JSONをHTMLに変換（構文ハイライトとインデントレインボー付き）
    function jsonToHtml(obj, indent = 0, inArray = false, arrayComma = '', isTopLevel = false) {
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
                return `<span class="json-string truncated-string" data-action="show-string" data-string-id="${stringId}" title="クリックして全体を表示">"${escapeHtml(truncated)}…"</span>`;
            }
            return `<span class="json-string">"${escapeHtml(obj)}"</span>`;
        }
        
        if (Array.isArray(obj)) {
            if (obj.length === 0) {
                return `<span class="json-bracket">[]</span>`;
            }
            
            const arrayId = 'arr-' + Math.random().toString(36).substr(2, 9);
            html += `<span class="json-bracket">[</span>`;
            
            if (obj.length > 3) {
                // 最初の3要素を表示（すべてカンマ付き）
                for (let i = 0; i < 3; i++) {
                    html += `<span class="line">${createIndentGuides(indent + 1)}<span class="array-item">${jsonToHtml(obj[i], indent + 1, true, ',')}</span></span>`;
                }
                
                // 省略表示（行全体を1つの要素として扱う）
                html += `<span class="line">`;
                html += `${createIndentGuides(indent + 1)}`;
                html += `<span class="expand-array" data-action="expand-array" data-target="${arrayId}">… (他${obj.length - 3}要素)</span>`;
                html += `</span>`;
                
                // 残りの要素（初期状態では非表示）
                html += `<span id="${arrayId}-hidden" style="display: none;">`;
                for (let i = 3; i < obj.length; i++) {
                    const comma = i < obj.length - 1 ? ',' : '';
                    html += `<span class="line">${createIndentGuides(indent + 1)}<span class="array-item">${jsonToHtml(obj[i], indent + 1, true, comma)}</span></span>`;
                }
                html += `</span>`;
            } else {
                // 3要素以下の場合は通常表示
                obj.forEach((item, index) => {
                    const comma = index < obj.length - 1 ? ',' : '';
                    html += `<span class="line">${createIndentGuides(indent + 1)}<span class="array-item">${jsonToHtml(item, indent + 1, true, comma)}</span></span>`;
                });
            }
            
            html += `<span class="line">${createIndentGuides(indent)}<span class="json-bracket">]</span>${arrayComma}</span>`;
            return html;
        }
        
        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) {
                return `<span class="json-bracket">{}</span>`;
            }
            
            // すべての非空オブジェクトは折りたたみ可能
            return renderCollapsibleObject(obj, indent, arrayComma, isTopLevel);
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
        
        jsonDisplay.innerHTML = jsonToHtml(json, 0, false, '', true);
        dialog.classList.add('active');
        
        // イベントデリゲーションハンドラーを初期化（一度だけ）
        initializeJsonEventHandlers();
    }
    
    // イベントデリゲーションの初期化
    let jsonEventHandlersInitialized = false;
    function initializeJsonEventHandlers() {
        if (jsonEventHandlersInitialized) return;
        
        const jsonDisplay = document.getElementById('json-display');
        jsonDisplay.addEventListener('click', handleJsonClick);
        jsonEventHandlersInitialized = true;
    }
    
    // 統一的なクリックハンドラー
    function handleJsonClick(e) {
        const actionElement = e.target.closest('[data-action]');
        if (!actionElement) return;
        
        e.stopPropagation();
        const action = actionElement.dataset.action;
        
        switch (action) {
            case 'expand-array':
                expandArray(actionElement.dataset.target);
                break;
            case 'toggle-collapse':
                toggleObjectCollapse(actionElement.dataset.target);
                break;
            case 'show-string':
                showStringDialog(window.fullStrings[actionElement.dataset.stringId]);
                break;
        }
    }
    
    // 配列展開の処理
    function expandArray(arrayId) {
        // 省略表示の行を非表示
        const expandLine = document.querySelector(`[data-action="expand-array"][data-target="${arrayId}"]`).closest('.line');
        if (expandLine) {
            expandLine.style.display = 'none';
        }
        
        // 隠れていた要素を表示
        const hiddenContent = document.getElementById(arrayId + '-hidden');
        if (hiddenContent) {
            hiddenContent.style.display = 'inline';
        }
    }
    
    // オブジェクト折りたたみの処理
    function toggleObjectCollapse(objId) {
        const contentGroup = document.getElementById(objId);
        const placeholder = document.getElementById(objId + '-placeholder');
        const closingBracket = document.getElementById(objId + '-closing');
        const icon = document.querySelector(`[data-target="${objId}"] .collapse-icon`);
        
        if (contentGroup && placeholder && icon) {
            if (contentGroup.style.display === 'none') {
                // 展開
                contentGroup.style.display = 'inline';
                placeholder.style.display = 'none';
                if (closingBracket) closingBracket.style.display = 'inline';
                icon.textContent = '▼';
            } else {
                // 折りたたみ
                contentGroup.style.display = 'none';
                placeholder.style.display = 'inline';
                if (closingBracket) closingBracket.style.display = 'none';
                icon.textContent = '▶';
            }
        }
    }
    
    // 文字列詳細ダイアログを表示
    function showStringDialog(str) {
        const dialog = document.getElementById('string-dialog');
        const stringDisplay = document.getElementById('string-display');
        
        stringDisplay.textContent = str;
        dialog.classList.add('active');
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