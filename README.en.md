# JSON Lines Pretty Printer

English | [日本語](README.md)

A web tool for formatting and displaying JSON Lines (JSONL) data in an easy-to-read format.

## 🌟 Features

- **Runs entirely in your browser** - No data is sent to any server
- **Table view** - Display JSON data in an easy-to-read tabular format
- **Syntax highlighting** - Color-coded Pretty Print display
- **Advanced filtering** - Flexible column-based filtering
- **Search & Sort** - Data search and sorting capabilities
- **Multi-language support** - Switch between Japanese/English
- **File upload support** - Load .jsonl, .txt, .json format files

## 🚀 Demo

[Try it here](https://MikageSawatari.github.io/jsview/)

## 📝 How to Use

1. **Input Data**
   - Paste JSON Lines format data into the text area
   - Or click "Load from File" button to upload a file

2. **Format**
   - Click the "Format" button (or press Ctrl+Enter)
   - Lines with errors are automatically skipped, displaying only valid data

3. **Table Display**
   - Data is automatically displayed in table format
   - Hierarchical JSON is displayed clearly with multi-row headers

4. **Detailed View**
   - Click a table row to view detailed JSON data for that row
   - Long strings are truncated with click-to-expand functionality

## 🎯 Main Features

### Table Functions
- **Hide/Show columns** - Temporarily hide unnecessary columns
- **Sort** - Click headers for ascending/descending sort
- **Horizontal scroll** - Fixed scroll bar at bottom, click screen edges to scroll
- **Value existence rate** - Visual display of data presence ratio for each column

### Filter Functions
- **Checkbox filter** - For columns with 20 or fewer unique values
- **Numeric range filter** - Range specification for numeric data
- **Date/DateTime filter** - Filter by date range
- **Text filter** - Flexible text search

### Search Function
- Space-separated for AND search
- Semicolon (;) separated for OR search
- Real-time search (300ms debounce)
- Ctrl+F to focus search box

### Other Features
- **Collapse/Expand** - Control display of JSON objects
- **Array truncation** - Show first 3 elements for arrays with 4+ items
- **Value copying** - Click any value to copy
- **sessionStorage support** - Data persists through page reloads

## 🛠 Technical Specifications

- HTML5 + CSS3 + Vanilla JavaScript
- No external libraries
- Responsive design
- Modern browser support (Chrome, Firefox, Safari, Edge)

## 📄 Input Format

JSON Lines format (one JSON object per line):

```jsonl
{"id": 1, "name": "Alice", "age": 30}
{"id": 2, "name": "Bob", "age": 25}
{"id": 3, "name": "Charlie", "age": 35}
```

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📜 License

This project is licensed under the [MIT License](LICENSE).

## 🙏 Acknowledgments

This tool was developed using [Claude Code](https://claude.ai/code).