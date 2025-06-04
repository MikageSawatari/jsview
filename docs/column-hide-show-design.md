# 列の非表示/再表示機能の設計

## 1. 概要

テーブルの列を動的に非表示/再表示する機能を実装する。階層化ヘッダに対応し、親要素を非表示にした場合は子要素もすべて非表示にする。

## 2. 機能要件

### 2.1 非表示機能
- 各ヘッダセルに×アイコンを表示
- ×アイコンクリックでその列（および子列）を非表示
- 親要素を非表示にしたら、子要素もすべて非表示

### 2.2 再表示機能
- テーブル右上に＋ボタンを配置
- ＋ボタンクリックでプルダウンメニューを表示
- 非表示列の一覧から選択して再表示
- 親要素を再表示しても、子要素は以前の状態を保持

## 3. 技術設計

### 3.1 データ構造

```javascript
// 非表示列の管理
const hiddenColumns = new Set(); // fullPathを格納
const hiddenByParent = new Map(); // 親によって非表示になった列を記録

// 列の階層関係
const columnHierarchy = {
  'a': ['a.a1', 'a.a2', 'a.a3'],
  'a.a3': ['a.a3.a3-1'],
  'b': [],
  'c': ['c.c1', 'c.c2']
};
```

### 3.2 UI設計

#### ×アイコンの配置
- 各ヘッダセルの右上に小さく配置
- ホバー時に表示を強調
- rowspan/colspanを持つセルでも適切に配置

#### ＋ボタンの配置
- テーブルコンテナの右上に固定
- スクロールしても常に見える位置
- クリックでドロップダウンメニューを表示

### 3.3 実装の流れ

1. **ヘッダ生成時の修正**
   - 各thタグに×アイコンを追加
   - data-column-path属性を付与

2. **非表示処理**
   - クリックされた列のfullPathを取得
   - 子列も含めて非表示リストに追加
   - CSSクラスで非表示化
   - colspanの再計算

3. **再表示処理**
   - 非表示列のリストを表示
   - 選択された列（と親によって非表示だった子列）を表示
   - colspanの再計算

## 4. 詳細な実装仕様

### 4.1 列の識別

各列は`fullPath`で一意に識別される：
- `a` - 親列
- `a.a1` - 子列
- `a.` - 値用列（型混在の場合）

### 4.2 非表示ロジック

```javascript
function hideColumn(fullPath) {
    // 1. 自身を非表示リストに追加
    hiddenColumns.add(fullPath);
    
    // 2. 子列を検索
    const children = findChildColumns(fullPath);
    
    // 3. 子列を非表示リストに追加（親による非表示として記録）
    children.forEach(child => {
        if (!hiddenColumns.has(child)) {
            hiddenByParent.set(child, fullPath);
        }
        hiddenColumns.add(child);
    });
    
    // 4. 表示を更新
    updateTableDisplay();
}
```

### 4.3 再表示ロジック

```javascript
function showColumn(fullPath) {
    // 1. 自身を表示
    hiddenColumns.delete(fullPath);
    
    // 2. 親によって非表示になっていた子列を確認
    const childrenToShow = [];
    hiddenByParent.forEach((parent, child) => {
        if (parent === fullPath && !isHiddenByUser(child)) {
            childrenToShow.push(child);
        }
    });
    
    // 3. 該当する子列を表示
    childrenToShow.forEach(child => {
        hiddenColumns.delete(child);
        hiddenByParent.delete(child);
    });
    
    // 4. 表示を更新
    updateTableDisplay();
}
```

### 4.4 表示更新

1. **ヘッダの更新**
   - 非表示列のth要素にhiddenクラスを追加
   - colspanを再計算（非表示の子列を除外）
   - rowspanは変更なし（構造は維持）

2. **データ行の更新**
   - 非表示列のtd要素にhiddenクラスを追加
   - 列のインデックスマッピングを更新

### 4.5 CSSクラス

```css
/* 非表示列 */
.column-hidden {
    display: none;
}

/* ×アイコン */
.column-hide-btn {
    position: absolute;
    right: 2px;
    top: 2px;
    cursor: pointer;
    opacity: 0.3;
    font-size: 12px;
}

.column-hide-btn:hover {
    opacity: 1;
}

th {
    position: relative; /* ×アイコンの配置用 */
}

/* ＋ボタン */
.show-columns-btn {
    position: absolute;
    right: 10px;
    top: 10px;
    z-index: 100;
}
```

## 5. 考慮事項

### 5.1 パフォーマンス
- 大量の列がある場合の処理速度
- DOM操作の最小化
- イベントデリゲーションの使用

### 5.2 ユーザビリティ
- 誤クリック防止（確認ダイアログは不要だが、元に戻しやすく）
- 非表示列の視覚的フィードバック
- キーボードショートカット（将来的に）

### 5.3 エッジケース
- すべての列を非表示にした場合
- 値用列（''）の扱い
- 横スクロールとの相互作用

## 6. 実装順序

1. ×アイコンの追加とクリックイベント
2. 列の非表示処理（単一列）
3. 子列の連動非表示
4. ＋ボタンとドロップダウンUI
5. 再表示処理
6. colspanの動的更新
7. テストとバグ修正

## 7. テストケース

1. **単純な列の非表示/表示**
   - 子を持たない列の非表示と再表示

2. **階層構造の非表示/表示**
   - 親列を非表示 → 子列も非表示
   - 親列を再表示 → 子列の状態は保持

3. **複雑なケース**
   - 子列を個別に非表示後、親列を非表示/再表示
   - 型混在列の非表示/表示
   - すべての列を非表示にした場合の動作