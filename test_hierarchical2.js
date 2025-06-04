// 修正版のテストコード
// Node.jsで実行: node test_hierarchical2.js

// KeyNodeクラス
class KeyNode {
    constructor(key) {
        this.key = key;
        this.children = {};
        this.isLeaf = true;
        this.hasDirectValue = false;
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
        return 1;
    }
    
    let totalColspan = 0;
    
    // 直接値を持つ場合、値用の列を追加
    if (node.hasDirectValue) {
        totalColspan = 1;
        // 値用の仮想ノードを作成
        if (!node.children['']) {
            node.children[''] = new KeyNode('');
            node.children[''].depth = node.depth + 1;
            node.children[''].rowspan = maxDepth - node.depth;
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
            Object.values(node.children).forEach(child => {
                traverse(child, depth + 1, currentPath);
            });
        }
    }
    
    traverse(root, 0);
    return rows;
}

// キー収集関数（簡略版）
function collectAllKeys(data) {
    const keyPaths = [];
    const keySet = new Set();
    const keyTypes = {};
    
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

// 最大深さを計算
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

// 修正版：フラットキー収集
function collectFlatKeys(rows) {
    const flatKeys = [];
    // すべての行をチェックして、リーフノードを収集
    rows.forEach((row, rowIndex) => {
        row.forEach(cell => {
            // リーフノードまたは値用ノードで、かつこのセルが最終行まで延びている場合
            if ((cell.isLeaf || cell.key === '') && 
                (rowIndex + cell.rowspan === rows.length)) {
                flatKeys.push(cell.fullPath);
            }
        });
    });
    return flatKeys;
}

// テスト実行関数
function runTest(testName, testData) {
    console.log(`\n=== ${testName} ===`);
    console.log('Input data:', JSON.stringify(testData));
    
    // キー収集
    const keyPaths = collectAllKeys(testData);
    console.log('\nCollected key paths:');
    keyPaths.forEach(kp => console.log(`  ${kp.path} (hasDirectValue: ${kp.hasDirectValue})`));
    
    // ツリー構築
    const keyTree = buildKeyTree(keyPaths);
    
    // 最大深さ計算
    const maxDepth = findMaxDepth(keyTree);
    console.log(`\nMax depth: ${maxDepth}`);
    
    // colspan/rowspan計算
    calculateSpans(keyTree, maxDepth);
    
    // ヘッダ行生成
    const headerRows = generateHeaderRows(keyTree, maxDepth);
    
    // ヘッダ表示
    console.log('\nHeader rows:');
    headerRows.forEach((row, index) => {
        console.log(`Row ${index + 1}:`);
        row.forEach(cell => {
            const spans = [];
            if (cell.colspan > 1) spans.push(`colspan=${cell.colspan}`);
            if (cell.rowspan > 1) spans.push(`rowspan=${cell.rowspan}`);
            const spanInfo = spans.length > 0 ? ` (${spans.join(', ')})` : '';
            console.log(`  "${cell.key}"${spanInfo} [path: ${cell.fullPath}]`);
        });
    });
    
    // フラットキーリスト（データ表示用）
    const flatKeys = collectFlatKeys(headerRows);
    console.log('\nFlat keys for data display:', flatKeys);
    
    // ビジュアル表示
    console.log('\nVisual representation:');
    headerRows.forEach((row, rowIndex) => {
        let line = '| ';
        row.forEach(cell => {
            const content = cell.key || '(value)';
            const width = Math.max(content.length + 2, 8);
            line += content.padEnd(width) + '| ';
        });
        console.log(line);
    });
    
    // データ表示のテスト
    console.log('\nData display test:');
    testData.forEach((item, index) => {
        console.log(`Row ${index + 1}:`);
        flatKeys.forEach(key => {
            const value = getNestedValue(item, key);
            console.log(`  ${key}: ${value}`);
        });
    });
}

// ネストされたオブジェクトから値を取得（簡略版）
function getNestedValue(obj, path) {
    if (path === '') return ''; // 空パスの場合
    const keys = path.split('.');
    let value = obj;
    
    for (const key of keys) {
        if (key === '' && keys.length > 1) {
            // 値用ノードの場合、最後の「.」を除いたパスで値を取得
            const realPath = path.substring(0, path.length - 1);
            return getNestedValue(obj, realPath);
        }
        if (value === null || value === undefined) {
            return '';
        }
        value = value[key];
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

// テストケース実行
console.log('階層化ヘッダのテスト（修正版）');

// テスト1: 基本的なネスト
runTest('Test 1: Basic nested structure', [
    {"a": {"a1": 1, "a2": 2}, "b": "x"}
]);

// テスト2: 型混在（シンプル）
runTest('Test 2: Simple mixed types', [
    {"a": 1, "b": {"c": 2}},
    {"a": {"x": 3}, "b": 5}
]);

console.log('\n=== テスト完了 ===');