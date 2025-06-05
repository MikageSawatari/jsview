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
    
    // 非表示列の管理
    const hiddenColumns = new Set();
    const hiddenByParent = new Map(); // 親によって非表示になった列
    const autoHiddenColumns = new Set(); // 自動的に非表示になった列
    let columnHierarchy = {}; // 列の階層関係
    let flatKeys = []; // フラットなキーリスト（データ表示用）

    // タブ切り替え機能
    function switchTab(tabName, pushState = true) {
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
        
        // テーブルタブの場合、bodyとcontainerにクラスを追加
        const tableControls = document.querySelector('.table-controls');
        if (tabName === 'table') {
            document.body.classList.add('table-tab-active');
            document.querySelector('.container').classList.add('table-tab-active');
            if (tableControls) tableControls.style.display = 'block';
            // スクロールボタンの表示状態を更新
            if (typeof setupScrollButtons === 'function') {
                setupScrollButtons();
            }
        } else {
            document.body.classList.remove('table-tab-active');
            document.querySelector('.container').classList.remove('table-tab-active');
            if (tableControls) tableControls.style.display = 'none';
        }
        
        // History APIに状態を追加
        if (pushState) {
            const state = { view: 'tab', tab: tabName };
            const url = `#${tabName}`;
            history.pushState(state, '', url);
        }
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
            // 非表示列の状態をクリア
            hiddenColumns.clear();
            hiddenByParent.clear();
            autoHiddenColumns.clear();
            columnHierarchy = {};
            
            // メニューを閉じる
            const menu = document.getElementById('hidden-columns-menu');
            if (menu) {
                menu.classList.remove('active');
            }
            
            createTable();
            switchTab('table');
        }
    }
    
    // KeyNodeクラス：階層ツリーのノード
    class KeyNode {
        constructor(key) {
            this.key = key;
            this.children = {};
            this.isLeaf = true;
            this.hasDirectValue = false; // 直接値を持つかどうか
            this.colspan = 1;
            this.rowspan = 1;
            this.depth = 0;
        }
    }
    
    // キーパスから階層ツリーを構築
    function buildKeyTree(allKeyPaths) {
        const root = new KeyNode('root');
        
        allKeyPaths.forEach(pathInfo => {
            const path = pathInfo.path;
            const hasDirectValue = pathInfo.hasDirectValue || false;
            let current = root;
            const parts = path.split('.');
            
            parts.forEach((part, index) => {
                if (!current.children[part]) {
                    current.children[part] = new KeyNode(part);
                    current.isLeaf = false;
                }
                current = current.children[part];
                current.depth = index + 1;
                
                // 最後のパートで直接値を持つ場合
                if (index === parts.length - 1 && hasDirectValue) {
                    current.hasDirectValue = true;
                }
            });
        });
        
        return root;
    }
    
    // colspan/rowspan計算
    function calculateSpans(node, maxDepth) {
        if (node.isLeaf && !node.hasDirectValue) {
            node.rowspan = maxDepth - node.depth + 1;
            return 1; // リーフのcolspanは1
        }
        
        let totalColspan = 0;
        
        // 直接値を持つ場合、値用の列を追加
        if (node.hasDirectValue) {
            totalColspan = 1;
            // 値用の仮想ノードを作成（最初に追加するため、一時的に保存）
            if (!node.children['']) {
                const valueNode = new KeyNode('');
                valueNode.depth = node.depth + 1;
                valueNode.rowspan = maxDepth - node.depth;
                
                // 既存の子ノードを一時保存
                const existingChildren = { ...node.children };
                // childrenをリセットして値用ノードを最初に追加
                node.children = { '': valueNode };
                // 既存の子ノードを再追加
                Object.assign(node.children, existingChildren);
            }
        }
        
        Object.values(node.children).forEach(child => {
            if (child.key !== '') { // 値用ノード以外
                totalColspan += calculateSpans(child, maxDepth);
            }
        });
        
        node.colspan = totalColspan;
        return totalColspan;
    }
    
    // ヘッダ行の生成
    function generateHeaderRows(root, maxDepth) {
        const rows = Array(maxDepth).fill(null).map(() => []);
        
        function traverse(node, depth, parentPath = '') {
            if (depth > 0) { // rootノードは除外
                const fullPath = parentPath ? `${parentPath}.${node.key}` : node.key;
                rows[depth - 1].push({
                    key: node.key,
                    fullPath: fullPath,
                    colspan: node.colspan,
                    rowspan: node.rowspan,
                    isLeaf: node.isLeaf && !node.hasDirectValue,
                    hasDirectValue: node.hasDirectValue
                });
            }
            
            if (!node.isLeaf || node.hasDirectValue) {
                const currentPath = depth === 0 ? '' : (parentPath ? `${parentPath}.${node.key}` : node.key);
                
                // 値用ノード（''）を最初に処理
                const childrenArray = Object.values(node.children);
                const sortedChildren = childrenArray.sort((a, b) => {
                    if (a.key === '') return -1;
                    if (b.key === '') return 1;
                    return 0; // それ以外は順序を維持
                });
                
                sortedChildren.forEach(child => {
                    traverse(child, depth + 1, currentPath);
                });
            }
        }
        
        traverse(root, 0);
        return rows;
    }
    
    // すべてのキーを収集（階層情報を保持）
    function collectAllKeys(data) {
        const keyPaths = [];
        const keySet = new Set();
        const keyTypes = {}; // キーごとの型情報を保存
        
        // キーの型情報を収集
        function analyzeKeyTypes(obj, prefix = '') {
            for (const key in obj) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = obj[key];
                
                if (!keyTypes[fullKey]) {
                    keyTypes[fullKey] = { hasDirectValue: false, hasObject: false };
                }
                
                if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                    keyTypes[fullKey].hasObject = true;
                    analyzeKeyTypes(value, fullKey);
                } else {
                    keyTypes[fullKey].hasDirectValue = true;
                }
            }
        }
        
        // すべてのデータから型情報を収集
        data.forEach(item => analyzeKeyTypes(item));
        
        // キーパスを収集
        function extractKeys(obj, prefix = '') {
            for (const key in obj) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = obj[key];
                
                // このキーが値とオブジェクトの両方を持つ場合
                if (keyTypes[fullKey].hasDirectValue && keyTypes[fullKey].hasObject) {
                    // 値用のパスを追加
                    if (!keySet.has(fullKey)) {
                        keyPaths.push({ path: fullKey, hasDirectValue: true });
                        keySet.add(fullKey);
                    }
                }
                
                if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                    // オブジェクトの場合は再帰的に処理
                    extractKeys(value, fullKey);
                } else {
                    // プリミティブ値または配列の場合
                    if (!keySet.has(fullKey)) {
                        keyPaths.push({ path: fullKey, hasDirectValue: false });
                        keySet.add(fullKey);
                    }
                }
            }
        }
        
        // すべてのデータからキーを抽出
        data.forEach(item => extractKeys(item));
        
        return keyPaths;
    }
    
    // ネストされたオブジェクトから値を取得
    function getNestedValue(obj, path, returnRaw = false) {
        let value;
        
        // 値用ノードの場合（パスが"." で終わる場合）
        if (path.endsWith('.')) {
            const realPath = path.slice(0, -1);
            if (realPath === '') {
                // ルートレベルの値は存在しない
                return returnRaw ? undefined : '';
            }
            const keys = realPath.split('.');
            value = obj;
            
            for (const key of keys) {
                if (value === null || value === undefined) {
                    return returnRaw ? undefined : '';
                }
                value = value[key];
            }
            
            // このキーがオブジェクトの場合は値ではない
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                return returnRaw ? undefined : '';
            }
        } else {
            // 通常のパスの場合
            const keys = path.split('.');
            value = obj;
            
            for (const key of keys) {
                if (value === null || value === undefined) {
                    return returnRaw ? undefined : '';
                }
                value = value[key];
            }
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
        
        const allKeyPaths = collectAllKeys(parsedData);
        
        // キーツリーを構築
        const keyTree = buildKeyTree(allKeyPaths);
        
        // 最大深さを計算
        let maxDepth = 0;
        function findMaxDepth(node) {
            if (node.isLeaf && !node.hasDirectValue) {
                return node.depth;
            }
            let max = node.depth;
            Object.values(node.children).forEach(child => {
                max = Math.max(max, findMaxDepth(child));
            });
            return max;
        }
        maxDepth = findMaxDepth(keyTree);
        
        // colspan/rowspanを計算
        calculateSpans(keyTree, maxDepth);
        
        // ヘッダ行を生成
        const headerRows = generateHeaderRows(keyTree, maxDepth);
        
        // フラットなキーリストを作成（データ表示用）
        flatKeys = []; // グローバル変数をリセット
        function collectFlatKeys(rows) {
            // 最終的なキーの順序を決定するため、視覚的な列の順序を構築
            const columnOrder = [];
            const maxRow = rows.length;
            
            // 各列の開始位置を記録
            const columnStarts = new Map();
            let currentColumn = 0;
            
            rows.forEach((row, rowIndex) => {
                let colPos = 0;
                row.forEach(cell => {
                    // この列の開始位置を記録
                    if (!columnStarts.has(cell.fullPath)) {
                        columnStarts.set(cell.fullPath, colPos);
                    }
                    
                    // リーフノードまたは値用ノードで、かつこのセルが最終行まで延びている場合
                    if ((cell.isLeaf || cell.key === '') && 
                        (rowIndex + cell.rowspan === maxRow)) {
                        columnOrder.push({ path: cell.fullPath, position: colPos });
                    }
                    
                    // 次の列位置を計算
                    colPos += cell.colspan || 1;
                });
            });
            
            // 位置順にソートしてパスを抽出
            columnOrder.sort((a, b) => a.position - b.position);
            columnOrder.forEach(col => flatKeys.push(col.path));
        }
        if (headerRows.length > 0) {
            collectFlatKeys(headerRows);
        }
        
        // テーブル要素の作成
        const table = document.createElement('table');
        
        // ヘッダー行の作成
        const thead = document.createElement('thead');
        
        headerRows.forEach(rowCells => {
            const headerRow = document.createElement('tr');
            
            rowCells.forEach(cell => {
                const th = document.createElement('th');
                th.dataset.columnPath = cell.fullPath;
                
                // セルの内容を作成
                const cellContent = document.createElement('span');
                cellContent.textContent = cell.key;  // 空文字列の場合は空のまま
                th.appendChild(cellContent);
                
                // 長いキー名の場合はtitle属性を追加
                if (cell.key && cell.key.length > 20) {
                    th.title = cell.key;
                }
                
                // ×アイコンを追加（すべての列に）
                const hideBtn = document.createElement('span');
                hideBtn.className = 'column-hide-btn';
                hideBtn.innerHTML = '<span class="hide-icon-circle">×</span>';
                hideBtn.title = '列を非表示';
                hideBtn.dataset.columnPath = cell.fullPath;
                th.appendChild(hideBtn);
                
                if (cell.colspan > 1) {
                    th.setAttribute('colspan', cell.colspan);
                }
                if (cell.rowspan > 1) {
                    th.setAttribute('rowspan', cell.rowspan);
                }
                
                headerRow.appendChild(th);
            });
            
            thead.appendChild(headerRow);
        });
        
        table.appendChild(thead);
        
        // データ行の作成
        const tbody = document.createElement('tbody');
        
        parsedData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.dataset.index = index;
            
            flatKeys.forEach(key => {
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
        // setupHorizontalScrollSyncで要素が置き換えられるため、毎回取得
        const currentTableContainer = document.getElementById('table-container');
        currentTableContainer.innerHTML = '';
        currentTableContainer.appendChild(table);
        
        // 列の階層関係を構築
        buildColumnHierarchy(headerRows);
        
        // 列の非表示/再表示イベントを設定
        setupColumnVisibilityEvents();
        
        // ＋ボタンの初期状態を設定（非表示列がないのでdisabled）
        updateShowColumnsButton();
        
        // 横スクロールの同期設定
        setupHorizontalScrollSync();
        
        // スクロールボタンの設定
        setupScrollButtons();
    }
    
    // 横スクロールの同期設定
    function setupHorizontalScrollSync() {
        const tableContainer = document.getElementById('table-container');
        const scrollWrapper = document.getElementById('horizontal-scroll-wrapper');
        const scrollContent = document.getElementById('horizontal-scroll-content');
        
        if (!tableContainer || !scrollWrapper || !scrollContent) return;
        
        // 既存のイベントリスナーを削除するため、要素を再作成
        // ただし、テーブルの内容は保持する
        const table = tableContainer.querySelector('table');
        if (!table) return;
        
        // スクロールコンテナのみ再作成（内容は保持）
        const parent = tableContainer.parentNode;
        const newTableContainer = document.createElement('div');
        newTableContainer.id = 'table-container';
        newTableContainer.appendChild(table);
        parent.replaceChild(newTableContainer, tableContainer);
        
        // 横スクロールバーも同様に再作成
        const scrollParent = scrollWrapper.parentNode;
        const newScrollWrapper = document.createElement('div');
        newScrollWrapper.id = 'horizontal-scroll-wrapper';
        newScrollWrapper.className = 'horizontal-scroll-wrapper';
        const newScrollContent = document.createElement('div');
        newScrollContent.id = 'horizontal-scroll-content';
        newScrollWrapper.appendChild(newScrollContent);
        scrollParent.replaceChild(newScrollWrapper, scrollWrapper);
        
        // 要素を再取得
        const tc = document.getElementById('table-container');
        const sw = document.getElementById('horizontal-scroll-wrapper');
        const sc = document.getElementById('horizontal-scroll-content');
        
        // テーブルの実際の幅を取得（既に上で取得済みなので再利用）
        if (!table) return;
        
        // 少し遅延してサイズを取得（レンダリング完了を待つ）
        setTimeout(() => {
            const tableWidth = table.scrollWidth;
            const containerWidth = tc.clientWidth;
            
            // スクロールが必要な場合のみ表示
            if (tableWidth > containerWidth) {
                // スクロールバーの幅を考慮した幅を設定
                // コンテナの幅とスクロール可能な幅の差分を計算
                const scrollableWidth = tableWidth - containerWidth;
                
                // 下部スクロールバーの表示エリアの幅を取得
                const wrapperWidth = sw.clientWidth;
                
                // スクロールコンテンツの幅を設定
                // スクロールバーが同じ範囲をカバーするように調整
                sc.style.width = (wrapperWidth + scrollableWidth) + 'px';
                
                // 横スクロールバーを表示
                sw.style.display = 'block';
                
                // スクロールイベントの同期
                let syncing = false;
                
                tc.addEventListener('scroll', () => {
                    if (!syncing) {
                        syncing = true;
                        // 同じ割合でスクロール
                        const scrollRatio = tc.scrollLeft / (tableWidth - containerWidth);
                        sw.scrollLeft = scrollRatio * (sc.offsetWidth - wrapperWidth);
                        syncing = false;
                    }
                });
                
                sw.addEventListener('scroll', () => {
                    if (!syncing) {
                        syncing = true;
                        // 同じ割合でスクロール
                        const scrollRatio = sw.scrollLeft / (sc.offsetWidth - wrapperWidth);
                        tc.scrollLeft = scrollRatio * (tableWidth - containerWidth);
                        syncing = false;
                    }
                });
            } else {
                // スクロールが不要な場合は非表示
                sw.style.display = 'none';
            }
        }, 100);
    }

    function clearAll() {
        inputElement.value = '';
        // setupHorizontalScrollSyncで要素が置き換えられるため、毎回取得
        const currentTableContainer = document.getElementById('table-container');
        if (currentTableContainer) {
            currentTableContainer.innerHTML = '';
        }
        parsedData = [];
        // 横スクロールバーを非表示
        const scrollWrapper = document.getElementById('horizontal-scroll-wrapper');
        if (scrollWrapper) {
            scrollWrapper.style.display = 'none';
        }
        switchTab('input');
        
        // 非表示列をリセット
        hiddenColumns.clear();
        hiddenByParent.clear();
        autoHiddenColumns.clear();
        columnHierarchy = {};
    }

    // 列の階層関係を構築
    function buildColumnHierarchy(headerRows) {
        columnHierarchy = {};
        
        // フラットなキーリストから階層を構築
        headerRows.forEach(row => {
            row.forEach(cell => {
                const path = cell.fullPath;
                if (!path) return;
                
                // 親のパスを取得
                const parts = path.split('.');
                if (parts.length > 1) {
                    const parentPath = parts.slice(0, -1).join('.');
                    if (!columnHierarchy[parentPath]) {
                        columnHierarchy[parentPath] = [];
                    }
                    if (!columnHierarchy[parentPath].includes(path)) {
                        columnHierarchy[parentPath].push(path);
                    }
                }
                
                // 自分自身のエントリも作成
                if (!columnHierarchy[path]) {
                    columnHierarchy[path] = [];
                }
            });
        });
    }
    
    // 列を非表示にする
    function hideColumn(fullPath) {
        // 手動で非表示にする場合、自動非表示状態を解除
        autoHiddenColumns.delete(fullPath);
        if (hiddenByParent.get(fullPath) === 'auto-hidden') {
            hiddenByParent.delete(fullPath);
        }
        
        // 自身を非表示リストに追加
        hiddenColumns.add(fullPath);
        
        // 子列を検索
        const children = columnHierarchy[fullPath] || [];
        
        // 子列を非表示リストに追加（親による非表示として記録）
        children.forEach(child => {
            if (!hiddenColumns.has(child)) {
                hiddenByParent.set(child, fullPath);
            }
            hiddenColumns.add(child);
            // 再帰的に子の子も処理
            hideColumn(child);
        });
        
        // 表示を更新
        updateTableDisplay();
    }
    
    // 列を再表示する
    function showColumn(fullPath) {
        // 自身を表示
        hiddenColumns.delete(fullPath);
        autoHiddenColumns.delete(fullPath);
        
        // 親によって非表示になっていた子列を確認
        const childrenToShow = [];
        hiddenByParent.forEach((parent, child) => {
            if (parent === fullPath) {
                childrenToShow.push(child);
            }
        });
        
        // 該当する子列を表示
        childrenToShow.forEach(child => {
            hiddenColumns.delete(child);
            hiddenByParent.delete(child);
            // 再帰的に子の子も処理
            showColumn(child);
        });
        
        // 親要素も連動して表示（自動非表示されていた場合）
        const parentPath = getParentPath(fullPath);
        if (parentPath && hiddenColumns.has(parentPath)) {
            // 親が自動非表示になっていた場合、解除を検討
            if (autoHiddenColumns.has(parentPath)) {
                const siblings = columnHierarchy[parentPath] || [];
                const hasVisibleChild = siblings.some(sibling => 
                    sibling === fullPath || !hiddenColumns.has(sibling)
                );
                if (hasVisibleChild) {
                    hiddenColumns.delete(parentPath);
                    autoHiddenColumns.delete(parentPath);
                    if (hiddenByParent.get(parentPath) === 'auto-hidden') {
                        hiddenByParent.delete(parentPath);
                    }
                    // 再帰的に上位の親も確認
                    showColumn(parentPath);
                }
            }
        }
        
        // 表示を更新
        updateTableDisplay();
    }
    
    // パスから親パスを取得
    function getParentPath(path) {
        const parts = path.split('.');
        if (parts.length > 1) {
            return parts.slice(0, -1).join('.');
        }
        return null;
    }
    
    // テーブル表示を更新
    function updateTableDisplay() {
        const table = document.querySelector('#table-container table');
        if (!table) return;
        
        // まず、子が全て非表示の親を検出
        updateParentVisibility();
        
        // colspanを再計算
        updateColspans();
        
        // ヘッダの更新
        const headerCells = table.querySelectorAll('th');
        headerCells.forEach(th => {
            const path = th.dataset.columnPath;
            if (path && hiddenColumns.has(path)) {
                th.classList.add('column-hidden');
            } else {
                th.classList.remove('column-hidden');
            }
        });
        
        // データ行の更新（flatKeysの順序を使用）
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            // flatKeysとセルの対応を正しく行う
            flatKeys.forEach((key, index) => {
                if (index < cells.length) {
                    if (hiddenColumns.has(key)) {
                        cells[index].classList.add('column-hidden');
                    } else {
                        cells[index].classList.remove('column-hidden');
                    }
                }
            });
        });
        
        // ＋ボタンの状態を更新
        updateShowColumnsButton();
        
        // スクロールボタンの表示状態を更新
        setTimeout(() => {
            if (typeof setupScrollButtons === 'function') {
                setupScrollButtons();
            }
        }, 100);
    }
    
    // 子が全て非表示の親を自動的に非表示にする
    function updateParentVisibility() {
        // 親子関係を逆引き
        const parentToChildren = {};
        Object.entries(columnHierarchy).forEach(([parent, children]) => {
            parentToChildren[parent] = children;
        });
        
        // 各親について、全ての子が非表示かチェック
        Object.entries(parentToChildren).forEach(([parent, children]) => {
            if (children.length > 0) {
                const allChildrenHidden = children.every(child => hiddenColumns.has(child));
                if (allChildrenHidden && !hiddenColumns.has(parent)) {
                    // 子が全て非表示だが親は表示されている場合、親も自動非表示に
                    hiddenColumns.add(parent);
                    autoHiddenColumns.add(parent);
                    // 親による非表示として記録
                    if (!hiddenByParent.has(parent)) {
                        hiddenByParent.set(parent, 'auto-hidden');
                    }
                } else if (!allChildrenHidden && autoHiddenColumns.has(parent)) {
                    // 子が表示されていて、親が自動非表示の場合、自動非表示を解除
                    hiddenColumns.delete(parent);
                    autoHiddenColumns.delete(parent);
                    if (hiddenByParent.get(parent) === 'auto-hidden') {
                        hiddenByParent.delete(parent);
                    }
                }
            }
        });
    }
    
    // colspanを動的に更新
    function updateColspans() {
        const table = document.querySelector('#table-container table');
        if (!table) return;
        
        const thead = table.querySelector('thead');
        const rows = Array.from(thead.querySelectorAll('tr'));
        
        // 各行のセルを処理
        rows.forEach((row, rowIndex) => {
            const cells = Array.from(row.querySelectorAll('th'));
            
            cells.forEach(cell => {
                const path = cell.dataset.columnPath;
                if (!path || hiddenColumns.has(path)) return;
                
                // このセルの子要素で表示されているものの数を計算
                const children = columnHierarchy[path] || [];
                if (children.length > 0) {
                    const visibleChildCount = countVisibleDescendants(path);
                    if (visibleChildCount > 0) {
                        cell.setAttribute('colspan', visibleChildCount);
                    } else {
                        cell.setAttribute('colspan', 1);
                    }
                }
            });
        });
    }
    
    // 指定されたパスの表示されている子孫の数を再帰的にカウント
    function countVisibleDescendants(path) {
        const children = columnHierarchy[path] || [];
        
        if (children.length === 0) {
            // リーフノードの場合
            return hiddenColumns.has(path) ? 0 : 1;
        }
        
        let count = 0;
        children.forEach(child => {
            if (!hiddenColumns.has(child)) {
                const childDescendants = countVisibleDescendants(child);
                count += childDescendants > 0 ? childDescendants : 1;
            }
        });
        
        return count;
    }
    
    // ＋ボタンの状態を更新
    function updateShowColumnsButton() {
        const btn = document.getElementById('show-columns-btn');
        if (hiddenColumns.size > 0) {
            btn.classList.remove('disabled');
        } else {
            btn.classList.add('disabled');
        }
    }
    
    // 列の非表示/再表示イベントを設定
    function setupColumnVisibilityEvents() {
        // ×アイコンのクリックイベント（イベントデリゲーション）
        const table = document.querySelector('#table-container table');
        if (table) {
            table.addEventListener('click', (e) => {
                // クリックされた要素またはその親要素がcolumn-hide-btnクラスを持っているか確認
                const hideBtn = e.target.closest('.column-hide-btn');
                if (hideBtn) {
                    e.stopPropagation();
                    const path = hideBtn.dataset.columnPath;
                    if (path) {
                        hideColumn(path);
                    }
                }
            });
        }
    }
    
    // 非表示列のリストを更新
    function updateHiddenColumnsList() {
        const list = document.getElementById('hidden-columns-list');
        list.innerHTML = '';
        
        if (hiddenColumns.size === 0) {
            list.innerHTML = '<div class="empty-message">非表示の列はありません</div>';
            return;
        }
        
        // ユーザーが直接非表示にした列のみ表示（自動非表示と親による非表示を除外）
        const userHiddenColumns = Array.from(hiddenColumns).filter(path => 
            !hiddenByParent.has(path) && !autoHiddenColumns.has(path)
        );
        
        userHiddenColumns.forEach(path => {
            const item = document.createElement('div');
            item.className = 'hidden-column-item';
            item.innerHTML = `<span class="column-path">${escapeHtml(path)}</span>`;
            item.addEventListener('click', () => {
                showColumn(path);
                const menu = document.getElementById('hidden-columns-menu');
                menu.classList.remove('active');
            });
            list.appendChild(item);
        });
    }
    
    formatBtn.addEventListener('click', formatJsonLines);
    clearBtn.addEventListener('click', clearAll);

    // Enter キーで整形実行
    inputElement.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            formatJsonLines();
        }
    });

    // 左右スクロールボタンの設定
    function setupScrollButtons() {
        const leftButton = document.getElementById('scroll-left-area');
        const rightButton = document.getElementById('scroll-right-area');
        const tableContainer = document.getElementById('table-container');
        const scrollWrapper = document.getElementById('horizontal-scroll-wrapper');
        
        if (!leftButton || !rightButton || !tableContainer) return;
        
        // スクロール量（画面幅の半分）
        const getScrollAmount = () => window.innerWidth / 2;
        
        // スムーズスクロール関数
        function smoothScroll(element, targetScrollLeft, duration = 100) {
            const startScrollLeft = element.scrollLeft;
            const distance = targetScrollLeft - startScrollLeft;
            const startTime = performance.now();
            
            function animation(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // イージング関数（ease-out）
                const easeOut = 1 - Math.pow(1 - progress, 3);
                
                element.scrollLeft = startScrollLeft + (distance * easeOut);
                
                if (progress < 1) {
                    requestAnimationFrame(animation);
                }
            }
            
            requestAnimationFrame(animation);
        }
        
        // 左スクロールボタンのクリック
        leftButton.addEventListener('click', () => {
            const scrollAmount = getScrollAmount();
            
            if (tableContainer) {
                const newScrollLeft = Math.max(0, tableContainer.scrollLeft - scrollAmount);
                smoothScroll(tableContainer, newScrollLeft);
            }
            
            if (scrollWrapper) {
                const scrollContent = scrollWrapper.querySelector('#horizontal-scroll-content');
                if (scrollContent) {
                    const newScrollLeft = Math.max(0, scrollContent.scrollLeft - scrollAmount);
                    smoothScroll(scrollContent, newScrollLeft);
                }
            }
        });
        
        // 右スクロールボタンのクリック
        rightButton.addEventListener('click', () => {
            const scrollAmount = getScrollAmount();
            
            if (tableContainer) {
                const maxScroll = tableContainer.scrollWidth - tableContainer.clientWidth;
                const newScrollLeft = Math.min(maxScroll, tableContainer.scrollLeft + scrollAmount);
                smoothScroll(tableContainer, newScrollLeft);
            }
            
            if (scrollWrapper) {
                const scrollContent = scrollWrapper.querySelector('#horizontal-scroll-content');
                if (scrollContent) {
                    const maxScroll = scrollContent.scrollWidth - scrollContent.clientWidth;
                    const newScrollLeft = Math.min(maxScroll, scrollContent.scrollLeft + scrollAmount);
                    smoothScroll(scrollContent, newScrollLeft);
                }
            }
        });
        
        // スクロール可能かチェックして表示/非表示を制御
        function updateScrollButtonsVisibility() {
            if (!tableContainer) return;
            
            const hasHorizontalScroll = tableContainer.scrollWidth > tableContainer.clientWidth;
            const isTableTabActive = document.body.classList.contains('table-tab-active');
            
            if (hasHorizontalScroll && isTableTabActive) {
                leftButton.style.display = 'flex';
                rightButton.style.display = 'flex';
            } else {
                leftButton.style.display = 'none';
                rightButton.style.display = 'none';
            }
        }
        
        // ウィンドウのリサイズ時に表示状態を更新
        window.addEventListener('resize', updateScrollButtonsVisibility);
        
        // 初期状態をチェック
        updateScrollButtonsVisibility();
    }
    
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
    function showJsonDialog(json, pushState = true) {
        const dialog = document.getElementById('json-dialog');
        const jsonDisplay = document.getElementById('json-display');
        
        // 文字列をリセット
        window.fullStrings = {};
        
        jsonDisplay.innerHTML = jsonToHtml(json, 0, false, '', true);
        dialog.classList.add('active');
        
        // イベントデリゲーションハンドラーを初期化（一度だけ）
        initializeJsonEventHandlers();
        
        // History APIに状態を追加
        if (pushState) {
            const rowIndex = parsedData.indexOf(json);
            if (rowIndex !== -1) {
                const state = { view: 'json-dialog', rowIndex: rowIndex };
                const url = `#table/row/${rowIndex}`;
                history.pushState(state, '', url);
            }
        }
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
    function showStringDialog(str, pushState = true) {
        const dialog = document.getElementById('string-dialog');
        const stringDisplay = document.getElementById('string-display');
        
        stringDisplay.textContent = str;
        dialog.classList.add('active');
        
        // History APIに状態を追加
        if (pushState) {
            // 文字列全体を保存（大きすぎる場合の対策として、一定サイズ以上は切り詰める）
            const maxLength = 10000;
            const storedString = str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
            const state = { view: 'string-dialog', fullString: storedString };
            const url = '#table/string';
            history.pushState(state, '', url);
        }
    }
    
    // ダイアログ関連のイベントリスナー
    const jsonDialog = document.getElementById('json-dialog');
    const stringDialog = document.getElementById('string-dialog');
    
    // JSONダイアログのイベント
    const jsonCloseButton = jsonDialog.querySelector('.dialog-close');
    jsonCloseButton.addEventListener('click', () => {
        closeJsonDialog();
    });
    
    jsonDialog.addEventListener('click', (e) => {
        if (e.target === jsonDialog) {
            closeJsonDialog();
        }
    });
    
    // 文字列ダイアログのイベント
    const stringCloseButton = stringDialog.querySelector('.dialog-close');
    stringCloseButton.addEventListener('click', () => {
        closeStringDialog();
    });
    
    stringDialog.addEventListener('click', (e) => {
        if (e.target === stringDialog) {
            closeStringDialog();
        }
    });
    
    // ダイアログを閉じる関数
    function closeJsonDialog() {
        jsonDialog.classList.remove('active');
        // テーブルタブに戻る
        if (document.body.classList.contains('table-tab-active')) {
            history.pushState({ view: 'tab', tab: 'table' }, '', '#table');
        }
    }
    
    function closeStringDialog() {
        stringDialog.classList.remove('active');
        // 前の状態に戻る
        const currentState = history.state;
        if (currentState && currentState.view === 'string-dialog') {
            history.back();
        }
    }
    
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
                closeStringDialog();
            } else if (jsonDialog.classList.contains('active')) {
                closeJsonDialog();
            }
        }
    });

    // popstateイベントリスナー（ブラウザの戻る/進むボタン対応）
    window.addEventListener('popstate', (e) => {
        const state = e.state;
        
        // ダイアログを閉じる
        jsonDialog.classList.remove('active');
        stringDialog.classList.remove('active');
        
        if (!state) {
            // 初期状態（入力タブ）
            switchTab('input', false);
            return;
        }
        
        switch (state.view) {
            case 'tab':
                switchTab(state.tab, false);
                break;
                
            case 'json-dialog':
                if (state.rowIndex !== undefined && parsedData[state.rowIndex]) {
                    switchTab('table', false);
                    showJsonDialog(parsedData[state.rowIndex], false);
                }
                break;
                
            case 'string-dialog':
                if (state.fullString) {
                    showStringDialog(state.fullString, false);
                }
                break;
        }
    });
    
    // 初期状態の設定
    const initialHash = window.location.hash;
    if (initialHash) {
        if (initialHash === '#table') {
            switchTab('table', false);
        } else if (initialHash === '#input') {
            switchTab('input', false);
        }
    } else {
        // 初期状態を履歴に追加
        history.replaceState({ view: 'tab', tab: 'input' }, '', '#input');
    }
    
    const initialTableContainer = document.getElementById('table-container');
    if (initialTableContainer) {
        initialTableContainer.innerHTML = '';
    }
    
    // ウィンドウリサイズ時に横スクロールを再設定
    window.addEventListener('resize', () => {
        if (document.body.classList.contains('table-tab-active')) {
            setupHorizontalScrollSync();
        }
    });
    
    // ＋ボタンのイベント設定
    const showBtn = document.getElementById('show-columns-btn');
    const menu = document.getElementById('hidden-columns-menu');
    
    showBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (hiddenColumns.size === 0) return;
        
        // メニューの表示/非表示を切り替え
        menu.classList.toggle('active');
        
        // 非表示列のリストを更新
        updateHiddenColumnsList();
    });
    
    // メニュー外をクリックしたら閉じる
    document.addEventListener('click', () => {
        menu.classList.remove('active');
    });
    
    menu.addEventListener('click', (e) => {
        e.stopPropagation();
    });
});