# 折りたたみ/展開機能の問題分析

## 現在の問題点

### 1. インデントガイドの扱い
**問題**: 折りたたみ/展開時にインデントガイドが適切に処理されていない

- 配列展開時：省略表示行のインデントガイドが残る
- オブジェクト折りたたみ時：内容のインデントガイドが残る

**原因**: インデントガイドがコンテンツの外側に生成されているため、コンテンツの表示/非表示と連動しない

### 2. イベントハンドラーの重複登録
**問題**: 展開/折りたたみのたびにハンドラーを再登録している

- 同じ要素に複数回ハンドラーが登録される可能性
- パフォーマンスの低下
- 予期しない動作の原因

### 3. HTML構造の問題
現在の構造では、インデントガイドとコンテンツが分離している：
```html
<!-- 現在の構造 -->
${createIndentGuides(indent + 1)}<span class="expand-array">...</span>
```

## 解決案

### 案1: インデントガイドを含むラッパー要素
```html
<!-- 改善案 -->
<span class="line-wrapper">
  ${createIndentGuides(indent + 1)}
  <span class="expand-array">… (他N要素)</span>
</span>
```

**メリット**:
- line-wrapper全体を表示/非表示にできる
- インデントガイドとコンテンツが一体化

**デメリット**:
- HTML構造が複雑になる
- 既存のコードへの影響が大きい

### 案2: イベントデリゲーション
```javascript
// ダイアログ全体に1つのハンドラーを設定
document.getElementById('json-display').addEventListener('click', (e) => {
    if (e.target.closest('.expand-array')) {
        // 配列展開処理
    } else if (e.target.closest('.collapsible-toggle')) {
        // オブジェクト折りたたみ処理
    } else if (e.target.closest('.collapsed-placeholder')) {
        // プレースホルダークリック処理
    }
});
```

**メリット**:
- ハンドラーの重複登録を回避
- 動的に追加される要素にも対応
- パフォーマンス向上

**デメリット**:
- イベントの伝播を考慮する必要がある

### 案3: 初期化時に全要素にハンドラー設定
現在の実装の問題：
- 非表示要素内のハンドラーが設定されない
- 展開のたびに再設定が必要

改善案：
1. HTMLを生成後、すべての要素（非表示含む）を走査
2. data属性でアクションを定義
3. 一度だけハンドラーを設定

## 推奨する実装方針

### 1. HTML構造の改善
```html
<!-- 配列の省略表示 -->
<span class="line" data-line-id="arr-123-expand">
  <span class="indent-guides">...</span>
  <span class="expand-array" data-array-id="arr-123">… (他N要素)</span>
</span>

<!-- 折りたたみ可能なコンテンツ -->
<span class="collapsible-lines" data-content-id="obj-456">
  <span class="line">
    <span class="indent-guides">...</span>
    <span class="content">...</span>
  </span>
</span>
```

### 2. イベントデリゲーションの採用
- パフォーマンスと保守性の向上
- 動的コンテンツへの対応

### 3. 状態管理の導入
```javascript
const expandStates = new Map();
// 展開状態を記録し、再レンダリング時に復元
```

## 実装の複雑さについて

インデントガイドを考慮した完全な実装は、以下の理由で複雑になります：

1. **構造的な制約**: インデントガイドが行の概念と密接に結びついている
2. **既存コードへの影響**: 大幅な書き換えが必要
3. **パフォーマンス**: DOM操作が増加する可能性

## 現実的な解決策

### 短期的対応
1. インデントガイドを含む行全体をラップする最小限の変更
2. イベントデリゲーションで重複登録を防ぐ

### 長期的対応
1. Virtual DOMライクな差分更新の実装
2. 状態管理とレンダリングの分離