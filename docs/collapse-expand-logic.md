# 折りたたみ/展開機能の実装ロジック

## 1. オブジェクトの折りたたみ/展開

### 現在の問題点
- 折りたたんだ後、{...}をクリックしても展開できない
- ▼/▶アイコンのみがクリック可能

### 提案する実装方法

#### HTML構造
```html
<span class="json-bracket">{</span>
<span class="collapsible-toggle" data-target-id="obj-123">
  <span class="collapse-icon">▼</span>
</span>
<span class="collapsible-content" id="obj-123">
  <!-- オブジェクトの中身 -->
</span>
<span class="collapsed-placeholder" id="obj-123-placeholder" style="display: none;">
  <span class="expand-trigger">...</span>
</span>
<span class="json-bracket">}</span>
```

#### 動作ロジック
1. **折りたたみ時**
   - ▼アイコンをクリック
   - `collapsible-content`を非表示（display: none）
   - `collapsed-placeholder`を表示（display: inline）
   - アイコンを▶に変更

2. **展開時**
   - ▶アイコンまたは`...`をクリック
   - `collapsible-content`を表示（display: inline）
   - `collapsed-placeholder`を非表示（display: none）
   - アイコンを▼に変更

#### イベントハンドリング
```javascript
// 折りたたみトグルのクリック
toggleButton.addEventListener('click', () => {
  const targetId = toggleButton.dataset.targetId;
  const content = document.getElementById(targetId);
  const placeholder = document.getElementById(targetId + '-placeholder');
  const icon = toggleButton.querySelector('.collapse-icon');
  
  if (content.style.display === 'none') {
    // 展開
    content.style.display = 'inline';
    placeholder.style.display = 'none';
    icon.textContent = '▼';
  } else {
    // 折りたたみ
    content.style.display = 'none';
    placeholder.style.display = 'inline';
    icon.textContent = '▶';
  }
});

// ...クリックでも展開可能
placeholder.addEventListener('click', () => {
  toggleButton.click(); // トグルボタンのクリックをトリガー
});
```

## 2. 配列の省略表示と展開

### 現在の問題点
- 展開時にカンマだけの行が残る
- HTML構造が複雑になっている

### 提案する実装方法

#### HTML構造（シンプルで統一的な構造）
```html
<span class="json-bracket">[</span>
<span class="array-content" id="arr-123">
  <!-- 最初の3要素（すべてカンマ付き） -->
  <span class="array-item">要素1,</span>
  <span class="array-item">要素2,</span>
  <span class="array-item">要素3,</span>
  <!-- 省略表示 -->
  <span class="array-expand-trigger" data-array-id="arr-123">
    <span class="array-ellipsis">... (他N要素)</span>
  </span>
  <!-- 残りの要素（初期は非表示） -->
  <span class="array-hidden" id="arr-123-hidden" style="display: none;">
    <span class="array-item">要素4,</span>
    <span class="array-item">要素5,</span>
    <span class="array-item">要素6</span>  <!-- 最後の要素のみカンマなし -->
  </span>
</span>
<span class="json-bracket">]</span>
```

#### 動作ロジック
1. **初期表示**
   - 最初の3要素を表示（すべてカンマ付き）
   - `... (他N要素)`を表示
   - 残りの要素は非表示

2. **展開時**
   - `array-expand-trigger`を非表示
   - `array-hidden`を表示
   - DOM操作は最小限（表示/非表示の切り替えのみ）

#### 実装のポイント
```javascript
expandTrigger.addEventListener('click', () => {
  const arrayId = expandTrigger.dataset.arrayId;
  const hiddenContent = document.getElementById(arrayId + '-hidden');
  
  // シンプルに表示/非表示を切り替えるだけ
  expandTrigger.style.display = 'none';
  hiddenContent.style.display = 'inline';
});
```

#### 生成時のロジック
```javascript
function generateArrayHtml(array, indent) {
  let html = '<span class="json-bracket">[</span>\n';
  const arrayId = 'arr-' + generateId();
  
  html += `<span class="array-content" id="${arrayId}">`;
  
  // 最初の3要素（すべて同じ構造）
  for (let i = 0; i < Math.min(3, array.length); i++) {
    html += `<span class="array-item">${generateIndent(indent + 1)}${jsonToHtml(array[i])},</span>\n`;
  }
  
  if (array.length > 3) {
    // 省略表示
    html += `<span class="array-expand-trigger" data-array-id="${arrayId}">`;
    html += `${generateIndent(indent + 1)}... (他${array.length - 3}要素)</span>\n`;
    
    // 残りの要素（同じ構造）
    html += `<span class="array-hidden" id="${arrayId}-hidden" style="display: none;">`;
    for (let i = 3; i < array.length; i++) {
      const comma = i < array.length - 1 ? ',' : '';
      html += `<span class="array-item">${generateIndent(indent + 1)}${jsonToHtml(array[i])}${comma}</span>\n`;
    }
    html += '</span>';
  } else {
    // 3要素以下の場合、最後の要素のカンマを削除
    // （最後の要素を特定して処理）
  }
  
  html += '</span>';
  html += `${generateIndent(indent)}<span class="json-bracket">]</span>`;
  
  return html;
}
```

## 3. 統一的な設計原則

### データ構造の管理
1. **元のデータを保持**
   - DOMに直接HTMLを書き込むのではなく、元のJSONデータを保持
   - 展開/折りたたみ状態を別途管理

2. **状態管理**
   ```javascript
   const expandedStates = {
     'obj-123': true,  // 展開中
     'arr-456': false  // 省略表示中
   };
   ```

3. **再レンダリング方式**
   - 状態が変更されたら、該当部分のみ再レンダリング
   - innerHTML の使用を最小限に抑える

### パフォーマンスの考慮
1. **イベントデリゲーション**
   - 個別の要素にイベントリスナーを付けるのではなく、親要素で管理
   
2. **遅延レンダリング**
   - 大きな配列やオブジェクトは、展開されるまでレンダリングしない

### ユーザビリティ
1. **視覚的フィードバック**
   - ホバー時にカーソルを変更
   - クリック可能な要素を明確に

2. **アクセシビリティ**
   - キーボード操作のサポート
   - スクリーンリーダー対応

## 4. 実装の優先順位

1. **Phase 1: 基本機能の修正**
   - オブジェクトの{...}クリックで展開可能に
   - 配列展開時のカンマ問題を解決

2. **Phase 2: コードの整理**
   - イベントハンドラーの統合
   - HTML生成ロジックの簡潔化

3. **Phase 3: 機能拡張**
   - すべて展開/すべて折りたたむボタン
   - 展開状態の記憶（LocalStorage）