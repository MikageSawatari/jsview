# JSON Lines Pretty Printer

## プロジェクト概要
JSON Lines（JSONL）形式のデータを整形して見やすく表示するWebツールです。
複数行のJSONデータを個別にパースし、インデント付きで表示します。

## 技術スタック
- HTML5
- CSS3
- Vanilla JavaScript

## ファイル構成
```
jsview/
├── index.html    # メインHTMLファイル
├── style.css     # スタイルシート
├── script.js     # JavaScript（整形ロジック）
└── CLAUDE.md     # プロジェクト情報
```

## 主な機能
1. **JSON Lines の整形**
   - 複数行のJSON形式データを個別に整形
   - 各JSONオブジェクトを見やすくインデント表示

2. **エラーハンドリング**
   - 無効なJSON形式の場合、エラーメッセージを表示
   - 行番号とエラー内容を明示

3. **ユーザーインターフェース**
   - テキストエリアにJSON Linesを入力
   - 「整形」ボタンで処理実行
   - 「クリア」ボタンで入力・出力をリセット
   - Ctrl+Enterショートカットで整形実行

## 使用方法
1. 入力エリアにJSON Lines形式のデータを貼り付け
2. 「整形」ボタンをクリック（またはCtrl+Enter）
3. 下部の出力エリアに整形結果が表示される

## 入力例
```
{"name": "John", "age": 30, "city": "Tokyo"}
{"name": "Jane", "age": 25, "city": "Osaka"}
{"name": "Bob", "age": 35, "city": "Kyoto"}
```

## 今後の拡張案
- ファイルアップロード機能
- 整形結果のダウンロード機能
- JSON Schema検証
- 複数の整形オプション（コンパクト表示など）
- ダークモード対応
- コピーボタンの追加

## 開発環境での実行
単純なHTMLファイルなので、`index.html`をブラウザで開くだけで動作します。
ローカルサーバーは不要です。

## ブラウザサポート
モダンブラウザ（Chrome、Firefox、Safari、Edge）で動作確認済み。