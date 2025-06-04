// テーブル生成のテストコード
// Node.jsで実行: node test_table_generation.js

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
    
    if (node.hasDirectValue) {
        totalColspan = 1;
        if (!node.children['']) {
            const valueNode = new KeyNode('');
            valueNode.depth = node.depth + 1;
            valueNode.rowspan = maxDepth - node.depth;
            
            const existingChildren = { ...node.children };
            node.children = { '': valueNode };
            Object.assign(node.children, existingChildren);
        }
    }
    
    Object.values(node.children).forEach(child => {
        if (child.key !== '') {
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
        if (depth > 0) {
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
            
            const childrenArray = Object.values(node.children);
            const sortedChildren = childrenArray.sort((a, b) => {
                if (a.key === '') return -1;
                if (b.key === '') return 1;
                return 0;
            });
            
            sortedChildren.forEach(child => {
                traverse(child, depth + 1, currentPath);
            });
        }
    }
    
    traverse(root, 0);
    return rows;
}

// キー収集関数
function collectAllKeys(data) {
    const keyPaths = [];
    const keySet = new Set();
    const keyTypes = {};
    
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
    
    data.forEach(item => analyzeKeyTypes(item));
    
    function extractKeys(obj, prefix = '') {
        for (const key in obj) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const value = obj[key];
            
            if (keyTypes[fullKey].hasDirectValue && keyTypes[fullKey].hasObject) {
                if (!keySet.has(fullKey)) {
                    keyPaths.push({ path: fullKey, hasDirectValue: true });
                    keySet.add(fullKey);
                }
            }
            
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                extractKeys(value, fullKey);
            } else {
                if (!keySet.has(fullKey)) {
                    keyPaths.push({ path: fullKey, hasDirectValue: false });
                    keySet.add(fullKey);
                }
            }
        }
    }
    
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

// フラットキー収集
function collectFlatKeys(rows) {
    const flatKeys = [];
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
    return flatKeys;
}

// ネストされたオブジェクトから値を取得
function getNestedValue(obj, path) {
    // 値用ノードの場合（パスが"." で終わる場合）
    if (path.endsWith('.')) {
        const realPath = path.slice(0, -1);
        if (realPath === '') {
            return '';
        }
        const keys = realPath.split('.');
        let value = obj;
        
        for (const key of keys) {
            if (value === null || value === undefined) {
                return '';
            }
            value = value[key];
        }
        
        // このキーがオブジェクトの場合は値ではない
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            return '';
        }
        
        return value;
    } else {
        // 通常のパスの場合
        const keys = path.split('.');
        let value = obj;
        
        for (const key of keys) {
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
        
        return value;
    }
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
    
    // フラットキーリスト
    const flatKeys = collectFlatKeys(headerRows);
    console.log('\nFlat keys (for data display):', flatKeys);
    
    // ヘッダ表示
    console.log('\nHeader visualization:');
    headerRows.forEach((row, index) => {
        const cells = row.map(cell => cell.key || '(value)').join(' | ');
        console.log(`Row ${index + 1}: ${cells}`);
    });
    
    // データ表示
    console.log('\nData rows:');
    testData.forEach((item, index) => {
        const values = flatKeys.map(key => {
            const value = getNestedValue(item, key);
            return value === '' ? '(empty)' : value;
        });
        console.log(`Data ${index + 1}: ${values.join(' | ')}`);
    });
    
    // 期待値との比較
    console.log('\nExpected vs Actual:');
    console.log('Headers:', flatKeys.join(' | '));
    testData.forEach((item, index) => {
        console.log(`Row ${index + 1}:`);
        flatKeys.forEach(key => {
            const value = getNestedValue(item, key);
            console.log(`  ${key} = ${value === '' ? '(empty)' : value}`);
        });
    });
}

// テストケース実行
console.log('テーブル生成のテスト');

// 問題のあるケース
runTest('Problem case', [
    {"a": {"a1": 1, "a2": 2}, "b": 1000}
]);

// 他のテストケース
runTest('Simple nested', [
    {"a": {"a1": 1, "a2": 2}, "b": "x"},
    {"a": {"a1": 10, "a2": 20}, "b": "y"}
]);

runTest('Mixed types', [
    {"a": 1, "b": {"c": 2}},
    {"a": {"x": 3}, "b": 5}
]);

console.log('\n=== テスト完了 ===');