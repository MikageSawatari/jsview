# イベントデリゲーション実装設計（案B）

## 概要
イベントデリゲーション + 行ラッパーを組み合わせた実装案

## 1. HTML構造の改善（行ラッパーの追加）

### 現在の構造
```html
${createIndentGuides(indent + 1)}<span class="expand-array">… (他N要素)</span>\n
```

### 改善後の構造
```html
<!-- すべての行を.lineでラップ -->
<span class="line">
  ${createIndentGuides(indent + 1)}
  <span class="expand-array" data-action="expand-array" data-target="arr-123">… (他N要素)</span>
</span>

<!-- 折りたたみ可能なオブジェクト -->
<span class="line">
  ${createIndentGuides(indent + 1)}
  <span class="json-key">"name"</span>: 
  <span class="json-bracket">{</span>
  <span class="collapsible-toggle" data-action="toggle-collapse" data-target="obj-456">
    <span class="collapse-icon">▼</span>
  </span>
</span>
<span class="collapsible-group" id="obj-456">
  <span class="line">
    ${createIndentGuides(indent + 2)}
    <span class="json-key">"value"</span>: <span class="json-string">"test"</span>
  </span>
</span>
<span class="collapsed-placeholder" id="obj-456-placeholder" style="display: none;" data-action="toggle-collapse" data-target="obj-456">
  <span class="line">
    ${createIndentGuides(indent + 2)}
    <span class="expand-trigger">...</span>
  </span>
</span>
```

## 2. イベントデリゲーションの実装

### 単一のイベントハンドラー
```javascript
function initializeJsonDialog() {
    const jsonDisplay = document.getElementById('json-display');
    
    // 1つのイベントハンドラーですべてのクリックを処理
    jsonDisplay.addEventListener('click', handleJsonClick);
}

function handleJsonClick(e) {
    // data-action属性を持つ要素を探す
    const actionElement = e.target.closest('[data-action]');
    if (!actionElement) return;
    
    e.stopPropagation();
    const action = actionElement.dataset.action;
    const target = actionElement.dataset.target;
    
    switch (action) {
        case 'expand-array':
            expandArray(target);
            break;
        case 'toggle-collapse':
            toggleObjectCollapse(target);
            break;
        case 'show-string':
            showStringDialog(actionElement.dataset.stringId);
            break;
    }
}
```

### 個別の処理関数
```javascript
function expandArray(arrayId) {
    // 省略表示の行を非表示
    const expandLine = document.querySelector(`[data-action="expand-array"][data-target="${arrayId}"]`).closest('.line');
    expandLine.style.display = 'none';
    
    // 隠れていた要素を表示
    const hiddenContent = document.getElementById(arrayId + '-hidden');
    hiddenContent.style.display = 'inline';
}

function toggleObjectCollapse(objId) {
    const contentGroup = document.getElementById(objId);
    const placeholder = document.getElementById(objId + '-placeholder');
    const icon = document.querySelector(`[data-target="${objId}"] .collapse-icon`);
    
    if (contentGroup.style.display === 'none') {
        // 展開
        contentGroup.style.display = 'inline';
        placeholder.style.display = 'none';
        icon.textContent = '▼';
    } else {
        // 折りたたみ
        contentGroup.style.display = 'none';
        placeholder.style.display = 'inline';
        icon.textContent = '▶';
    }
}
```

## 3. メリット

### パフォーマンス
- イベントハンドラーは1つだけ
- 動的に追加される要素にも自動対応
- メモリ使用量の削減

### 保守性
- すべてのアクションが1か所で管理される
- 新しいアクションの追加が容易
- デバッグが簡単

### 構造の明確化
- 行ラッパーによりインデントガイドとコンテンツが一体化
- 表示/非表示の単位が明確
- CSSでの行単位のスタイリングが可能

## 4. 実装例

### 配列の省略表示
```javascript
// HTML生成
if (array.length > 3) {
    // 最初の3要素
    for (let i = 0; i < 3; i++) {
        html += `<span class="line">${createIndentGuides(indent + 1)}${jsonToHtml(array[i])},</span>\n`;
    }
    
    // 省略表示（行全体が消える）
    html += `<span class="line">`;
    html += `${createIndentGuides(indent + 1)}`;
    html += `<span class="expand-array" data-action="expand-array" data-target="${arrayId}">… (他${array.length - 3}要素)</span>`;
    html += `</span>\n`;
    
    // 残りの要素
    html += `<span id="${arrayId}-hidden" style="display: none;">`;
    for (let i = 3; i < array.length; i++) {
        html += `<span class="line">${createIndentGuides(indent + 1)}${jsonToHtml(array[i])}${comma}</span>\n`;
    }
    html += `</span>`;
}
```

## 5. 移行戦略

1. **段階1**: 行ラッパーの追加
   - すべての行を`.line`でラップ
   - 既存の機能は維持

2. **段階2**: data属性の追加
   - アクション可能な要素にdata-action属性を追加
   - data-target属性で対象を指定

3. **段階3**: イベントデリゲーションへの移行
   - 個別のイベントハンドラーを削除
   - 単一のデリゲーションハンドラーに統合

## 6. 考慮事項

### CSSの調整
```css
.line {
    display: block;
    white-space: nowrap;
}

.collapsible-group {
    display: inline-block;
}
```

### 互換性
- 既存の構造を段階的に移行可能
- 一度に全体を変更する必要なし