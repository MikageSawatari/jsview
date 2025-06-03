# JSON表示機能の新設計

## 現在の問題点

1. **ネストレベルによる不整合**
   - `{"a":{"b":{"c":{"d":123}}}}` で `b` に折りたたみボタンが表示されない
   - 折りたたみ機能がトップレベルとその直下の子要素にのみ適用される
   - 再帰的な処理で一貫性が保たれていない

2. **複雑な条件分岐**
   - オブジェクトの処理が複数の場所に分散
   - 配列内オブジェクト、通常のオブジェクト、折りたたみ可能なオブジェクトで異なる処理

## 新設計の方針

### 1. 統一的なオブジェクト処理

すべてのオブジェクト（空でないもの）は、ネストレベルに関わらず折りたたみ可能とする。

### 2. シンプルな再帰構造

`jsonToHtml` 関数を以下の原則で再設計：

```javascript
function jsonToHtml(obj, indent = 0, inArray = false, arrayComma = '') {
    // プリミティブ型の処理（現状維持）
    
    // 配列の処理（現状維持）
    
    // オブジェクトの処理（統一化）
    if (typeof obj === 'object') {
        // 空オブジェクトは特別処理
        if (Object.keys(obj).length === 0) {
            return `<span class="json-bracket">{}</span>`;
        }
        
        // すべての非空オブジェクトは折りたたみ可能
        return renderCollapsibleObject(obj, indent, arrayComma);
    }
}
```

### 3. 新しいオブジェクトレンダリング関数

```javascript
function renderCollapsibleObject(obj, indent, trailingComma = '') {
    const objId = 'obj-' + Math.random().toString(36).substr(2, 9);
    const keys = Object.keys(obj);
    let html = '';
    
    // 開き括弧と折りたたみボタン
    html += `<span class="json-bracket">{</span> `;
    html += `<span class="collapsible-toggle" data-action="toggle-collapse" data-target="${objId}">`;
    html += `<span class="collapse-icon">▼</span>`;
    html += `</span>`;
    
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
    
    // 折りたたみ時のプレースホルダー
    html += `<span class="collapsed-placeholder" id="${objId}-placeholder" style="display: none;" data-action="toggle-collapse" data-target="${objId}">`;
    html += `<span class="line">${createIndentGuides(indent + 1)}<span class="expand-trigger">...</span></span>`;
    html += `</span>`;
    
    // 閉じ括弧（末尾カンマ付き）
    html += `<span class="line">${createIndentGuides(indent)}<span class="json-bracket">}</span>${trailingComma}</span>`;
    
    return html;
}
```

### 4. 行ラッパーの一貫した使用

- オブジェクトの開き括弧は前の要素と同じ行に配置
- 各キー・値のペアは独立した `<span class="line">` でラップ
- 閉じ括弧も独立した `<span class="line">` でラップ
- 配列要素の末尾カンマは `arrayComma` パラメータで制御

### 5. 利点

1. **一貫性**: すべてのオブジェクトが同じロジックで処理される
2. **シンプル**: 条件分岐が減り、コードが理解しやすくなる
3. **拡張性**: 新しい機能を追加しやすい
4. **保守性**: バグの原因となる複雑な状態管理が不要

## 実装の影響

### 変更が必要な箇所

1. `jsonToHtml` 関数の大幅な簡素化
2. オブジェクト処理の統一化
3. 配列内オブジェクトの特別処理を削除

### 既存機能への影響

- 文字列の省略表示：影響なし
- 配列の省略表示：影響なし
- イベントデリゲーション：影響なし
- インデントガイド：影響なし

## 実装手順

1. 新しい `renderCollapsibleObject` 関数を作成
2. `jsonToHtml` 関数のオブジェクト処理部分を簡素化
3. 配列内オブジェクトの特別処理を削除
4. テストケースで動作確認

## 確認事項

この設計で以下が実現されます：

1. ✅ `{"a":{"b":{"c":{"d":123}}}}` のすべてのレベル（a, b, c）で折りたたみボタンが表示される
2. ✅ 配列内オブジェクトも同様に折りたたみ可能
3. ✅ カンマの位置が正しく表示される
4. ✅ 既存の機能（文字列省略、配列省略など）は維持される

この設計でよろしいでしょうか？