document.addEventListener('DOMContentLoaded', function() {
    const inputElement = document.getElementById('input');
    const outputElement = document.getElementById('output');
    const formatBtn = document.getElementById('formatBtn');
    const clearBtn = document.getElementById('clearBtn');

    function formatJsonLines() {
        const input = inputElement.value.trim();
        outputElement.innerHTML = '';

        if (!input) {
            outputElement.innerHTML = '<div class="empty-state">JSON Lines を入力してください</div>';
            return;
        }

        const lines = input.split('\n').filter(line => line.trim());
        let hasError = false;

        lines.forEach((line, index) => {
            try {
                const json = JSON.parse(line);
                const formatted = JSON.stringify(json, null, 2);
                
                const itemDiv = document.createElement('div');
                itemDiv.className = 'json-item';
                itemDiv.textContent = formatted;
                outputElement.appendChild(itemDiv);
            } catch (e) {
                hasError = true;
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error';
                errorDiv.textContent = `行 ${index + 1} でエラー: ${e.message}\n入力: ${line}`;
                outputElement.appendChild(errorDiv);
            }
        });

        if (lines.length === 0) {
            outputElement.innerHTML = '<div class="empty-state">有効なJSON Linesが見つかりませんでした</div>';
        }
    }

    function clearAll() {
        inputElement.value = '';
        outputElement.innerHTML = '<div class="empty-state">ここに整形結果が表示されます</div>';
    }

    formatBtn.addEventListener('click', formatJsonLines);
    clearBtn.addEventListener('click', clearAll);

    // Enter キーで整形実行
    inputElement.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            formatJsonLines();
        }
    });

    // 初期状態の設定
    outputElement.innerHTML = '<div class="empty-state">ここに整形結果が表示されます</div>';
});