# DOM構造分析とネストオブジェクト表示問題

## 問題の概要

ネストしたオブジェクト `{"a":{"b":{"c":{"d":123}}}}` を表示する際の問題：
1. `a`と`c`には▼が表示されるが、`b`には表示されない
2. `a`の次の行と、`a`の閉じ括弧の上下の行に余白がある

## 現在のDOM構造生成ロジック分析

### jsonToHtml関数の処理フロー

```javascript
if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
        return `<span class="json-bracket">{}</span>`;
    }
    
    const objId = 'obj-' + Math.random().toString(36).substr(2, 9);
    
    // 配列内のオブジェクトの場合
    if (inArray && keys.length > 0) {
        // 配列内オブジェクト用の構造
    } else {
        // 通常のオブジェクト
        html += `<span class="json-bracket">{</span>\n`;
        keys.forEach((key, index) => {
            const value = obj[key];
            const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
            const comma = index < keys.length - 1 ? ',' : '';
            
            if (isObject && Object.keys(value).length > 0) {
                // 折りたたみ可能なオブジェクト
                const keyId = objId + '-' + index;
                html += `<span class="line">`;
                html += `${createIndentGuides(indent + 1)}`;
                html += `<span class="json-key">"${escapeHtml(key)}"</span>: `;
                html += `<span class="json-bracket">{</span> `;
                html += `<span class="collapsible-toggle" data-action="toggle-collapse" data-target="${keyId}">`;
                html += `<span class="collapse-icon">▼</span>`;
                html += `</span>`;
                html += `</span>\n`;
                
                html += `<span class="collapsible-group" id="${keyId}">`;
                // オブジェクトの中身を再帰的に生成
                const valueKeys = Object.keys(value);
                valueKeys.forEach((vKey, vIndex) => {
                    const vComma = vIndex < valueKeys.length - 1 ? ',' : '';
                    html += `<span class="line">${createIndentGuides(indent + 2)}<span class="json-key">"${escapeHtml(vKey)}"</span>: ${jsonToHtml(value[vKey], indent + 2)}${vComma}</span>\n`;
                });
                html += `</span>`;
                
                html += `<span class="collapsed-placeholder" id="${keyId}-placeholder" style="display: none;" data-action="toggle-collapse" data-target="${keyId}">`;
                html += `<span class="line">${createIndentGuides(indent + 2)}<span class="expand-trigger">...</span></span>\n`;
                html += `</span>`;
                
                html += `<span class="line">${createIndentGuides(indent + 1)}<span class="json-bracket">}</span>${comma}</span>\n`;
            } else {
                // 通常のキー
                html += `<span class="line">${createIndentGuides(indent + 1)}<span class="json-key">"${escapeHtml(key)}"</span>: ${jsonToHtml(value, indent + 1)}${comma}</span>\n`;
            }
        });
    }
    
    html += `<span class="line">${createIndentGuides(indent)}<span class="json-bracket">}</span></span>`;
    return html;
}
```

## 問題分析

### 1. ▼アイコンが表示されない問題

`{"a":{"b":{"c":{"d":123}}}}`の場合：

- **a**: `{"b":{"c":{"d":123}}}`は空でないオブジェクト → ▼表示される ✓
- **b**: `{"c":{"d":123}}`は空でないオブジェクト → ▼表示されるはず ✗
- **c**: `{"d":123}`は空でないオブジェクト → ▼表示される ✓
- **d**: `123`は数値（プリミティブ） → ▼表示されない ✓

**原因推測**: 
- `b`の値が再帰的に`jsonToHtml`で処理される際、`inArray`パラメータの影響
- または、ネストレベルでの`isObject`判定に問題がある可能性

### 2. 余白問題

生成されるHTML構造：
```html
<span class="json-bracket">{</span>
<span class="line">
  [インデントガイド]
  <span class="json-key">"a"</span>: 
  <span class="json-bracket">{</span> 
  <span class="collapsible-toggle">
    <span class="collapse-icon">▼</span>
  </span>
</span>
<span class="collapsible-group" id="obj-xxx-0">
  <span class="line">
    [インデントガイド]
    <span class="json-key">"b"</span>: 
    [再帰的にjsonToHtml呼び出し]
  </span>
</span>
<span class="line">
  [インデントガイド]
  <span class="json-bracket">}</span>
</span>
<span class="line">
  [インデントガイド]
  <span class="json-bracket">}</span>
</span>
```

**余白の原因**:
1. `.line`要素が`display: block`のため、各要素が改行される
2. `\n`文字とHTMLの改行が重複している可能性
3. CSS margin/paddingの影響

## 期待される正しいDOM構造

```html
<!-- ルートオブジェクト開始 -->
<span class="json-bracket">{</span>

<!-- キー"a"の行 -->
<span class="line">
  [インデント1]<span class="json-key">"a"</span>: <span class="json-bracket">{</span> 
  <span class="collapsible-toggle" data-action="toggle-collapse" data-target="obj-a">
    <span class="collapse-icon">▼</span>
  </span>
</span>

<!-- キー"a"の値（折りたたみ可能グループ） -->
<span class="collapsible-group" id="obj-a">
  <!-- キー"b"の行 -->
  <span class="line">
    [インデント2]<span class="json-key">"b"</span>: <span class="json-bracket">{</span> 
    <span class="collapsible-toggle" data-action="toggle-collapse" data-target="obj-b">
      <span class="collapse-icon">▼</span>
    </span>
  </span>
  
  <!-- キー"b"の値（折りたたみ可能グループ） -->
  <span class="collapsible-group" id="obj-b">
    <!-- キー"c"の行 -->
    <span class="line">
      [インデント3]<span class="json-key">"c"</span>: <span class="json-bracket">{</span> 
      <span class="collapsible-toggle" data-action="toggle-collapse" data-target="obj-c">
        <span class="collapse-icon">▼</span>
      </span>
    </span>
    
    <!-- キー"c"の値（折りたたみ可能グループ） -->
    <span class="collapsible-group" id="obj-c">
      <!-- キー"d"の行 -->
      <span class="line">
        [インデント4]<span class="json-key">"d"</span>: <span class="json-number">123</span>
      </span>
    </span>
    
    <!-- キー"c"の閉じ括弧 -->
    <span class="line">
      [インデント3]<span class="json-bracket">}</span>
    </span>
  </span>
  
  <!-- キー"b"の閉じ括弧 -->
  <span class="line">
    [インデント2]<span class="json-bracket">}</span>
  </span>
</span>

<!-- キー"a"の閉じ括弧 -->
<span class="line">
  [インデント1]<span class="json-bracket">}</span>
</span>

<!-- ルートオブジェクト終了 -->
<span class="line">
  [インデント0]<span class="json-bracket">}</span>
</span>
```

## 修正が必要な箇所

### 1. 再帰処理での`inArray`パラメータ

現在のコード：
```javascript
html += `<span class="line">${createIndentGuides(indent + 2)}<span class="json-key">"${escapeHtml(vKey)}"</span>: ${jsonToHtml(value[vKey], indent + 2)}${vComma}</span>\n`;
```

**問題**: `jsonToHtml(value[vKey], indent + 2)`で`inArray`パラメータが渡されていない
**修正**: `jsonToHtml(value[vKey], indent + 2, false)`とする

### 2. HTML構造の整理

- 不要な`\n`の削除
- `.line`要素の一貫した使用
- インデントレベルの正確な管理

### 3. CSS調整

```css
.line {
    display: block;
    white-space: nowrap;
    line-height: 1.5;
    margin: 0;
    padding: 0;
}

.collapsible-group {
    display: block;
}
```

## 次のアクション

1. `jsonToHtml`関数の再帰処理を修正
2. HTML生成ロジックの統一
3. 余白問題の解決
4. テストケースでの検証