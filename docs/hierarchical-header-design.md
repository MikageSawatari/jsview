# 階層化ヘッダのロジック設計

## 1. 概要

現在のテーブルヘッダは、ネストされたキーを「.」で連結して1行で表示している（例：`a.a1`）。
これを複数行のヘッダに変更し、階層構造を視覚的に表現する。

## 2. 基本的な考え方

### 2.1 データ構造の分析

1. **キーパスの収集**: すべてのJSONオブジェクトから、リーフ（最終的な値）までのパスを収集
2. **階層ツリーの構築**: キーパスから階層ツリー構造を構築
3. **行数の計算**: ツリーの最大深さがヘッダの行数となる
4. **colspan/rowspanの計算**: 
   - 親ノード: 子ノードの数だけcolspan
   - リーフノード: 最大深さまでのrowspan

### 2.2 アルゴリズム

```javascript
// 1. キーパスツリーの構築
class KeyNode {
    constructor(key) {
        this.key = key;
        this.children = {};
        this.isLeaf = true;
        this.colspan = 1;
        this.rowspan = 1;
        this.depth = 0;
    }
}

// 2. ツリー構築関数
function buildKeyTree(allKeyPaths) {
    const root = new KeyNode('root');
    
    allKeyPaths.forEach(path => {
        let current = root;
        const parts = path.split('.');
        
        parts.forEach((part, index) => {
            if (!current.children[part]) {
                current.children[part] = new KeyNode(part);
                current.isLeaf = false;
            }
            current = current.children[part];
            current.depth = index + 1;
        });
    });
    
    return root;
}

// 3. colspan/rowspan計算
function calculateSpans(node, maxDepth) {
    if (node.isLeaf) {
        node.rowspan = maxDepth - node.depth + 1;
        return 1; // リーフのcolspanは1
    }
    
    let totalColspan = 0;
    Object.values(node.children).forEach(child => {
        totalColspan += calculateSpans(child, maxDepth);
    });
    
    node.colspan = totalColspan;
    return totalColspan;
}

// 4. ヘッダ行の生成
function generateHeaderRows(root, maxDepth) {
    const rows = Array(maxDepth).fill(null).map(() => []);
    
    function traverse(node, depth) {
        if (depth > 0) { // rootノードは除外
            rows[depth - 1].push({
                key: node.key,
                colspan: node.colspan,
                rowspan: node.rowspan,
                isLeaf: node.isLeaf
            });
        }
        
        if (!node.isLeaf) {
            Object.values(node.children).forEach(child => {
                traverse(child, depth + 1);
            });
        }
    }
    
    traverse(root, 0);
    return rows;
}
```

## 3. 具体例での検証

### 例1: `{"a": {"a1": 1, "a2": 2}, "b": "x"}`

**キーパス**: `a.a1`, `a.a2`, `b`

**ツリー構造**:
```
root
├── a (colspan=2)
│   ├── a1 (rowspan=1)
│   └── a2 (rowspan=1)
└── b (rowspan=2)
```

**ヘッダ行**:
- 行1: `a` (colspan=2), `b` (rowspan=2)
- 行2: `a1`, `a2`

### 例2: `{"a": {"a1": 1, "a2": 2, "a3": {"a3-1": 1}}, "b": "x", "c": {"c1": [1,2,3], "c2": [4,5,6]}}`

**キーパス**: `a.a1`, `a.a2`, `a.a3.a3-1`, `b`, `c.c1`, `c.c2`

**ツリー構造**:
```
root
├── a (colspan=3)
│   ├── a1 (rowspan=2)
│   ├── a2 (rowspan=2)
│   └── a3 (colspan=1)
│       └── a3-1 (rowspan=1)
├── b (rowspan=3)
└── c (colspan=2)
    ├── c1 (rowspan=2)
    └── c2 (rowspan=2)
```

**ヘッダ行**:
- 行1: `a` (colspan=3), `b` (rowspan=3), `c` (colspan=2)
- 行2: `a1` (rowspan=2), `a2` (rowspan=2), `a3` (colspan=1), `c1` (rowspan=2), `c2` (rowspan=2)
- 行3: `a3-1`

## 4. 考慮事項とエッジケース

### 4.1 配列の扱い
- 配列は値として扱い、さらなるネストとしては展開しない
- 例: `{"data": [{"x": 1}, {"y": 2}]}` の場合、`data` までをキーとする

### 4.2 空オブジェクトの扱い
- 空オブジェクト `{}` はリーフとして扱う
- 子ノードを持たないため、rowspanを適切に設定

### 4.3 不規則な構造
- 異なる行で異なる深さのネストがある場合も正しく処理
- 例: 1行目は `{"a": {"b": {"c": 1}}}`, 2行目は `{"a": 1}`

### 4.4 キーの並び順
- 最初に出現した順序を保持
- 充填度による並び替えは別タスクで実装

## 5. 実装への影響

### 5.1 既存コードの変更箇所
1. `collectAllKeys` 関数: キーパスの階層情報を保持するよう変更
2. `createTableHeader` 関数: 複数行のヘッダを生成するよう全面的に書き換え
3. `createTableBody` 関数: 新しいキー構造に合わせてセルの生成を調整

### 5.2 新規追加関数
1. `buildKeyTree`: キーパスから階層ツリーを構築
2. `calculateSpans`: colspan/rowspanを計算
3. `generateHeaderRows`: ヘッダ行の配列を生成

## 6. テストケース

### 6.1 基本的なネスト
```json
{"a": {"a1": 1, "a2": 2}, "b": "x"}
```
期待されるヘッダ:
```
| a (colspan=2) | b (rowspan=2) |
| a1 | a2 |     |
```

### 6.2 深いネスト
```json
{"a": {"b": {"c": {"d": 1}}}}
```
期待されるヘッダ:
```
| a |
| b |
| c |
| d |
```

### 6.3 不規則なネスト（型混在）
```json
[
  {"a": 1, "b": {"c": 2}},
  {"a": {"x": 1}, "b": 3}
]
```
期待されるヘッダ:
```
| a (colspan=2) | b (colspan=2) |
|   | x         |   | c         |
```
期待されるデータ:
```
| 1 |   |   | 2 |
|   | 1 | 3 |   |
```
注: `a` と `b` は両方とも値とオブジェクトの両方を持つため、それぞれ値用の列が必要

### 6.4 複雑な構造
```json
{"a": {"a1": 1, "a2": 2, "a3": {"a3-1": 1}}, "b": "x", "c": {"c1": [1,2,3], "c2": [4,5,6]}}
```
期待されるヘッダ:
```
| a (colspan=3)     | b (rowspan=3) | c (colspan=2)  |
| a1 | a2 | a3      |               | c1 | c2        |
|    |    | a3-1    |               |    |           |
```

## 7. 実装の確認ポイント

1. ✅ すべてのキーパスが正しく収集される
2. ✅ ツリー構造が正しく構築される
3. ✅ colspan/rowspanが正しく計算される
4. ✅ ヘッダセルが正しい位置に配置される
5. ✅ データセルが正しいヘッダに対応する
6. ✅ 不規則な構造でもエラーにならない

この設計により、階層構造を視覚的に理解しやすく、かつ実装も明確になります。

## 8. ユーザー提示例の詳細検証

### 例1: `{"a": {"a1": 1, "a2": 2}, "b": "x"}`

**詳細分析**:
- キーパス: `a.a1`, `a.a2`, `b`
- 最大深さ: 2
- `a`: 子ノード2つ（a1, a2）→ colspan=2, rowspan=1
- `b`: リーフノード → colspan=1, rowspan=2

**HTMLテーブル構造**:
```html
<tr>
  <th colspan="2">a</th>
  <th rowspan="2">b</th>
</tr>
<tr>
  <th>a1</th>
  <th>a2</th>
</tr>
```

**表示イメージ**:
```
+-------+---+
|   a   | b |
+---+---+   |
| a1| a2|   |
+---+---+---+
```

### 例2: `{"a": {"a1": 1, "a2": 2, "a3": {"a3-1": 1}}, "b": "x", "c": {"c1": [1,2,3], "c2": [4,5,6]}}`

**詳細分析**:
- キーパス: `a.a1`, `a.a2`, `a.a3.a3-1`, `b`, `c.c1`, `c.c2`
- 最大深さ: 3
- `a`: 子ノード3つ → colspan=3, rowspan=1
  - `a1`: リーフ → colspan=1, rowspan=2
  - `a2`: リーフ → colspan=1, rowspan=2
  - `a3`: 子ノード1つ → colspan=1, rowspan=1
    - `a3-1`: リーフ → colspan=1, rowspan=1
- `b`: リーフ → colspan=1, rowspan=3
- `c`: 子ノード2つ → colspan=2, rowspan=1
  - `c1`: リーフ（配列） → colspan=1, rowspan=2
  - `c2`: リーフ（配列） → colspan=1, rowspan=2

**HTMLテーブル構造**:
```html
<tr>
  <th colspan="3">a</th>
  <th rowspan="3">b</th>
  <th colspan="2">c</th>
</tr>
<tr>
  <th rowspan="2">a1</th>
  <th rowspan="2">a2</th>
  <th>a3</th>
  <th rowspan="2">c1</th>
  <th rowspan="2">c2</th>
</tr>
<tr>
  <th>a3-1</th>
</tr>
```

**表示イメージ**:
```
+-----------+---+-------+
|     a     | b |   c   |
+---+---+---+   +---+---+
| a1| a2| a3|   | c1| c2|
|   |   +---+   |   |   |
|   |   |a3-1   |   |   |
+---+---+---+---+---+---+
```

## 9. 実装上の注意点

### 9.1 キーの型混在への対処

現在の実装では、同じキーに異なる型が混在することを許容している。階層化ヘッダでは、以下のように対処する：

```json
[
  {"a": 1},
  {"a": {"x": 2}}
]
```

**現在の表示**（フラットなヘッダ）:
```
| a | a.x |
|---|-----|
| 1 |     |
|   | 2   |
```

**新しい表示**（階層化ヘッダ）:
```
ヘッダ1行目: | a (colspan=2) |
ヘッダ2行目: |   | x |
データ1行目: | 1 |   |
データ2行目: |   | 2 |
```

**実装方針**：
- `a` は値とオブジェクトの両方として使用される
- キーパスとしては `a`（値用）と `a.x` の両方を収集
- ヘッダツリー構築時、`a` ノードに特別なフラグを設定（`hasDirectValue: true`）
- `hasDirectValue` が true の場合、最初の子として「値用の列」を追加
- この列のヘッダ2行目は空欄として表示

**KeyNodeの拡張**:
```javascript
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
```

**具体的な処理**:
1. キーパス収集時に、`a` と `a.x` の両方を検出
2. `a` ノードに `hasDirectValue = true` を設定
3. ヘッダ生成時、`hasDirectValue` が true なら最初の列を値用に確保
4. データ表示時も同様のロジックで適切な列に値を配置

**より複雑な例**:
```json
[
  {"a": 1, "b": {"c": 2}},
  {"a": {"x": 3, "y": 4}, "b": 5}
]
```

**階層化ヘッダの表示**:
```
ヘッダ1行目: | a (colspan=3) | b (colspan=2) |
ヘッダ2行目: |   | x | y     |   | c         |
データ1行目: | 1 |   |       |   | 2         |
データ2行目: |   | 3 | 4     | 5 |           |
```

この例では：
- `a` は値とオブジェクトの両方を持つ → 値用列 + x列 + y列 = colspan=3
- `b` も値とオブジェクトの両方を持つ → 値用列 + c列 = colspan=2
- 各データ行で適切な列に値を配置

### 9.2 配列内オブジェクトの扱い

現在の仕様では、配列内のオブジェクトは展開しない：
- `{"items": [{"id": 1}, {"id": 2}]}` → `items` のみ（`items.id` は作らない）
- 配列は値として扱い、テーブルセルには `[Array]` などと表示

### 9.3 パフォーマンス考慮

- キーツリーの構築は一度だけ実行
- ヘッダの再レンダリングは最小限に
- 大量のネストがある場合も効率的に処理

## 10. 結論

提示された例を含む様々なパターンで検証した結果、この設計で以下が実現可能です：

1. ✅ シンプルなネスト構造の正しい表示
2. ✅ 深いネスト構造の階層的表示
3. ✅ 不規則な深さのネストへの対応
4. ✅ 配列を含む構造の適切な処理
5. ✅ 型混在（値とオブジェクトの両方を持つキー）の適切な処理
6. ✅ 既存機能（ソート、フィルタ等）との互換性維持

**型混在時の表示例**:
- `{"a": 1}` と `{"a": {"x": 2}}` が混在する場合
  - ヘッダは `a` (colspan=2) の下に空欄と `x` を表示
  - データは適切な列に配置（値は左列、オブジェクトの子要素は右列）

この設計に基づいて実装を進めてよろしいでしょうか？