document.addEventListener('DOMContentLoaded', () => {

    // --- データベース(スタブ) ---
    // ※ 実際は、別途ファイルから読み込むかAPI通信を行う想定ですが、
    // 要件に基づき「管理キー(item_key)と完成済みURL(rakuten_url)」を分離して持つDBです。
    // 「shop_name と item_number を単純連結してURLを作ること」は禁止されているため、
    // ここにあるデータからのみ本物の完成済みURLを引ける仕様とします。
    const dummyDatabase = {
        "mottainaihonpo:10242457": {
            "sku": "RA-mottainaihonpo:10242457",
            "item_key": "mottainaihonpo:10242457",
            "prefix": "RA",
            "shop_name": "mottainaihonpo",
            "item_number": "10242457",
            "rakuten_url": "https://item.rakuten.co.jp/mottainaihonpo/xxxxx/"
        },
        "bookoffonline:12345678": {
            "sku": "RA-bookoffonline:12345678",
            "item_key": "bookoffonline:12345678",
            "prefix": "RA",
            "shop_name": "bookoffonline",
            "item_number": "12345678",
            "rakuten_url": "https://item.rakuten.co.jp/bookoffonline/12345678_some_slug/"
        }
    };


    // --- UI要素取得 ---
    const imageUpload = document.getElementById('image-upload');
    const previewSection = document.getElementById('preview-section');
    const imagePreview = document.getElementById('image-preview');
    
    const ocrBtn = document.getElementById('ocr-btn');
    const loadingEl = document.getElementById('loading');
    const errorMessageEl = document.getElementById('error-message');
    
    const resultSection = document.getElementById('result-section');
    const detectedSkuEl = document.getElementById('detected-sku');
    const parsedItemKeyEl = document.getElementById('parsed-item-key');
    const parsedShopEl = document.getElementById('parsed-shop');
    const parsedNumberEl = document.getElementById('parsed-number');
    
    const resolvedUrlEl = document.getElementById('resolved-url');
    const openRakutenBtn = document.getElementById('open-rakuten-btn');
    const ocrRawTextEl = document.getElementById('ocr-raw-text');


    let currentImageFile = null;

    // --- 画像アップロード処理 ---
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        resetUI();

        currentImageFile = file;
        const imageUrl = URL.createObjectURL(file);
        imagePreview.src = imageUrl;
        previewSection.style.display = 'block';
        
        ocrBtn.disabled = false;
    });

    // --- エラー表示・クリア ---
    function showError(message) {
        errorMessageEl.textContent = message;
        errorMessageEl.style.display = 'block';
        resultSection.style.display = 'none';
        loadingEl.style.display = 'none';
        ocrBtn.disabled = false;
    }

    function clearError() {
        errorMessageEl.textContent = '';
        errorMessageEl.style.display = 'none';
    }

    function resetUI() {
        clearError();
        resultSection.style.display = 'none';
        loadingEl.style.display = 'none';
    }

    // --- OCR実行 ---
    ocrBtn.addEventListener('click', async () => {
        if (!currentImageFile) return;

        resetUI();
        ocrBtn.disabled = true;
        loadingEl.style.display = 'block';

        try {
            // Tesseract.jsを用いて英語+数字で読み取る（SKUが英数字記号メインのため）
            // 言語は英数字が中心なので 'eng' を使用。日本語混じりなら 'eng+jpn' もありだが
            // SKU周辺の精度を高めるためここではengを使用する。
            const result = await Tesseract.recognize(
                currentImageFile,
                'eng',
                { logger: m => console.log(m) } // 進捗をコンソールに出力
            );

            const text = result.data.text;
            ocrRawTextEl.textContent = text;
            
            processOcrText(text);

        } catch (error) {
            console.error("OCR Error:", error);
            showError("OCRの処理中にエラーが発生しました。");
        }
    });

    // --- テキスト解析とURL解決 ---
    function processOcrText(text) {
        // 余分な空白や改行をそのままにしてまず正規表現で探す
        // SKUの基本形: RA-shop_name:10242457
        // ブレ対応: "RA - mottainaihonpo:10242457", "RA_mottainaihonpo:10242457",
        //           "RA-mottainaihonpo：10242457"
        // 許可する記号: ハイフン、アンダースコア、コロン(半角全角)
        // [A-Za-z0-9_-] で店名、数字で商品番号
        const skuRegex = /R\s*A\s*[-\_]\s*([A-Za-z0-9\-\_]+)\s*[:：]\s*(\d+)/i;
        const match = text.match(skuRegex);

        if (!match) {
            // 文字列が見つからない場合
            showError("SKUを検出できませんでした");
            return;
        }

        const rawMatch = match[0];
        const shopName = match[1].trim();
        const itemNumber = match[2].trim();

        // SKU形式の最低限のバリデーション（店名も番号も取れているか）
        if (!shopName || !itemNumber) {
            showError("SKU形式が正しくありません");
            return;
        }

        const prefix = "RA";
        // 仕様: item_key（管理キー）は shop_name:item_number の形式
        const itemKey = `${shopName}:${itemNumber}`;
        const cleanSku = `${prefix}-${itemKey}`;

        // 抽出した情報を画面に反映
        detectedSkuEl.textContent = rawMatch;
        parsedItemKeyEl.textContent = itemKey;
        parsedShopEl.textContent = shopName;
        parsedNumberEl.textContent = itemNumber;

        resolveUrl(itemKey);
    }

    // --- URL解決ロジック ---
    function resolveUrl(itemKey) {
        // item_key を使ってDB(ダミー)から「完成済みの楽天URL」を引く
        const dbRecord = dummyDatabase[itemKey];

        if (!dbRecord || !dbRecord.rakuten_url) {
            // 楽天検索等へのフォールバックは禁止されているためエラー表示のみ
            showError("対応する楽天商品ページが見つかりませんでした");
            return;
        }

        // 完成済みの楽天URLをセットして表示
        const finalUrl = dbRecord.rakuten_url;
        resolvedUrlEl.textContent = finalUrl;
        
        openRakutenBtn.href = finalUrl;

        // UI切り替え
        loadingEl.style.display = 'none';
        resultSection.style.display = 'block';
    }

});
