# フィルタ機能の詳細設計

## 概要
テーブルの各列（リーフノード）にフィルタ機能を追加し、Excelのようなデータフィルタリングを実現する。

## UI設計

### 1. フィルタアイコン
- **位置**: 各リーフノードのヘッダセル内（ソートアイコンの左側）
- **デザイン**: 漏斗（ファンネル）アイコン 🔽 または ⧩
- **表示条件**: データ列（リーフノード）のみに表示
- **状態**:
  - 通常: グレー（#666）
  - フィルタ適用中: 青色（#2196F3）
  - ホバー時: 少し濃く表示

### 2. フィルタドロップダウン
- **表示位置**: フィルタアイコンの下に表示
- **幅**: 最小200px、最大400px
- **最大高さ**: 400px（スクロール可能）
- **影**: box-shadow付きで浮いているように見せる
- **背景**: 白色
- **境界線**: 1px solid #ddd

## フィルタタイプの判定ロジック

### 1. 値の収集と分析
```javascript
function analyzeColumnValues(columnPath) {
    const values = new Map(); // 値 => 出現回数
    const numericValues = [];
    let hasNumeric = true;
    
    filteredData.forEach(row => {
        const value = getValueByPath(row, columnPath);
        if (value !== null && value !== undefined && value !== '') {
            values.set(value, (values.get(value) || 0) + 1);
            
            if (typeof value === 'number') {
                numericValues.push(value);
            } else {
                hasNumeric = false;
            }
        }
    });
    
    return {
        uniqueCount: values.size,
        values: values,
        isNumeric: hasNumeric && numericValues.length > 0,
        numericValues: numericValues
    };
}
```

### 2. フィルタタイプの決定
```javascript
function determineFilterType(analysis) {
    if (analysis.uniqueCount === 0) {
        return 'empty';
    } else if (analysis.uniqueCount <= 20) {
        return 'checkbox';
    } else if (analysis.isNumeric) {
        return 'range';
    } else {
        return 'text';
    }
}
```

## フィルタUI実装

### 1. チェックボックスフィルタ（値が20種類以下）
```html
<div class="filter-dropdown">
    <div class="filter-header">
        <button class="select-all-btn">すべて選択</button>
        <button class="clear-all-btn">すべて解除</button>
    </div>
    <div class="filter-search">
        <input type="text" placeholder="フィルタ内を検索..." />
    </div>
    <div class="filter-list">
        <label class="filter-item">
            <input type="checkbox" value="value1" />
            <span class="filter-value" title="完全な値">表示値...</span>
            <span class="filter-count">(10)</span>
        </label>
        <!-- 他の値... -->
    </div>
    <div class="filter-footer">
        <button class="apply-filter-btn">適用</button>
        <button class="cancel-filter-btn">キャンセル</button>
    </div>
</div>
```

### 2. 範囲フィルタ（数値が20種類超）
```html
<div class="filter-dropdown">
    <div class="filter-header">
        <span>数値範囲フィルタ</span>
    </div>
    <div class="filter-range-inputs">
        <input type="number" class="min-input" placeholder="最小値" />
        <span>～</span>
        <input type="number" class="max-input" placeholder="最大値" />
    </div>
    <div class="filter-range-list">
        <label class="filter-item">
            <input type="checkbox" data-min="0" data-max="100" />
            <span>0 - 100</span>
            <span class="filter-count">(25)</span>
        </label>
        <!-- 他の範囲... -->
    </div>
    <div class="filter-footer">
        <button class="apply-filter-btn">適用</button>
        <button class="cancel-filter-btn">キャンセル</button>
    </div>
</div>
```

### 3. テキストフィルタ（その他の場合）
```html
<div class="filter-dropdown">
    <div class="filter-header">
        <span>テキストフィルタ</span>
    </div>
    <div class="filter-text-input">
        <textarea placeholder="検索条件を入力（スペース:AND、;:OR）"></textarea>
    </div>
    <div class="filter-footer">
        <button class="apply-filter-btn">適用</button>
        <button class="cancel-filter-btn">キャンセル</button>
    </div>
</div>
```

## データ構造

### フィルタ状態の管理
```javascript
// 列ごとのフィルタ状態
const columnFilters = new Map();

// フィルタ状態の構造
{
    columnPath: "score.game",
    type: "checkbox", // "checkbox" | "range" | "text"
    active: true,
    
    // チェックボックスフィルタの場合
    selectedValues: new Set([100, 80]),
    
    // 範囲フィルタの場合
    ranges: [
        { min: 0, max: 50, selected: true },
        { min: 50, max: 100, selected: false }
    ],
    customMin: null,
    customMax: null,
    
    // テキストフィルタの場合
    query: "search text",
    mode: "AND" // "AND" | "OR"
}
```

## フィルタ適用ロジック

### 1. 複数フィルタの組み合わせ
- 異なる列のフィルタ: AND条件
- 同一列内の複数選択: OR条件

### 2. フィルタと既存機能の統合
```javascript
function getFilteredData() {
    let data = parsedData;
    
    // 検索フィルタを適用
    if (searchState.query) {
        data = applySearchFilter(data);
    }
    
    // 列フィルタを適用
    columnFilters.forEach((filter, columnPath) => {
        if (filter.active) {
            data = applyColumnFilter(data, columnPath, filter);
        }
    });
    
    return data;
}
```

### 3. パフォーマンス考慮
- フィルタ変更時のみ再計算
- 大量データ時の仮想スクロール検討（将来的な拡張）

## イベント処理

### 1. フィルタアイコンクリック
- 現在のフィルタドロップダウンを閉じる
- クリックされた列のデータを分析
- 適切なフィルタUIを生成・表示

### 2. ドロップダウン外クリック
- フィルタドロップダウンを閉じる
- 変更を破棄

### 3. 適用ボタンクリック
- フィルタ状態を保存
- テーブルを再描画
- ドロップダウンを閉じる

## CSS設計

### 1. フィルタアイコン
```css
.filter-icon {
    position: absolute;
    right: 50px; /* ソートアイコンの左 */
    top: 10px;
    cursor: pointer;
    font-size: 14px;
    color: #666;
    transition: color 0.2s;
}

.filter-icon.active {
    color: #2196F3;
}

.filter-icon:hover {
    color: #333;
}
```

### 2. フィルタドロップダウン
```css
.filter-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    min-width: 200px;
    max-width: 400px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    z-index: 1000;
}
```

## 実装の優先順位

1. **フェーズ1**: 基本実装
   - フィルタアイコンの追加
   - チェックボックスフィルタの実装
   - フィルタ状態管理

2. **フェーズ2**: 高度な機能
   - 範囲フィルタの実装
   - テキストフィルタの実装
   - フィルタの永続化（sessionStorage）

3. **フェーズ3**: UX改善
   - アニメーション追加
   - キーボードショートカット
   - フィルタのクリア機能

## テスト項目

1. **機能テスト**
   - 各フィルタタイプが正しく動作すること
   - 複数列のフィルタが同時に動作すること
   - フィルタとソート・検索が共存すること

2. **パフォーマンステスト**
   - 大量データでのフィルタ速度
   - メモリ使用量の確認

3. **UIテスト**
   - ドロップダウンの位置調整
   - レスポンシブ対応
   - アクセシビリティ