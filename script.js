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
            return JSON.stringify(value);
        }
        
        return String(value);
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
                td.textContent = getNestedValue(item, key);
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
    function jsonToHtml(obj, indent = 0) {
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
            return `<span class="json-string">"${escapeHtml(obj)}"</span>`;
        }
        
        if (Array.isArray(obj)) {
            if (obj.length === 0) {
                return `<span class="json-bracket">[]</span>`;
            }
            
            html += `<span class="json-bracket">[</span>\n`;
            obj.forEach((item, index) => {
                html += `${createIndentGuides(indent + 1)}${jsonToHtml(item, indent + 1)}`;
                if (index < obj.length - 1) {
                    html += ',';
                }
                html += '\n';
            });
            html += `${createIndentGuides(indent)}<span class="json-bracket">]</span>`;
            return html;
        }
        
        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) {
                return `<span class="json-bracket">{}</span>`;
            }
            
            html += `<span class="json-bracket">{</span>\n`;
            keys.forEach((key, index) => {
                html += `${createIndentGuides(indent + 1)}<span class="json-key">"${escapeHtml(key)}"</span>: ${jsonToHtml(obj[key], indent + 1)}`;
                if (index < keys.length - 1) {
                    html += ',';
                }
                html += '\n';
            });
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
        
        jsonDisplay.innerHTML = jsonToHtml(json);
        dialog.classList.add('active');
    }
    
    // ダイアログ関連のイベントリスナー
    const dialog = document.getElementById('json-dialog');
    const closeButton = dialog.querySelector('.dialog-close');
    
    closeButton.addEventListener('click', () => {
        dialog.classList.remove('active');
    });
    
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            dialog.classList.remove('active');
        }
    });
    
    // ESCキーでダイアログを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dialog.classList.contains('active')) {
            dialog.classList.remove('active');
        }
    });

    // 初期状態の設定
    tableContainer.innerHTML = '';
});