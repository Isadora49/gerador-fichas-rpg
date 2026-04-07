const { PDFDocument, PDFName, PDFString } = window.PDFLib || {};

let pdfOriginalBytes = null; 
let clicks = [];
// Mudei o rótulo para você saber que é uma lista
const labels = ["C1 (Lista A/B/C)", "C2 (Nível)", "C3 (Dado)", "C4 (Total)"];

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// 1. CARREGAMENTO (Clone de ArrayBuffer para evitar erro de download)
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfOriginalBytes = arrayBuffer.slice(0); 
        const previewBytes = arrayBuffer.slice(0);
        const loadingTask = pdfjsLib.getDocument({ data: previewBytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.getElementById('pdf-canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        document.querySelectorAll('.marker').forEach(m => m.remove());
        clicks = [];
        document.getElementById('status').innerText = "Clique para: " + labels[0];
        document.getElementById('btnDownload').disabled = true;
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

// 2. MARCAÇÃO
document.getElementById('pdf-canvas').addEventListener('click', (e) => {
    if (clicks.length >= 4 || !pdfOriginalBytes) return;
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    clicks.push({ x, y, w: rect.width, h: rect.height });
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.left = e.pageX + 'px';
    marker.style.top = e.pageY + 'px';
    marker.style.position = 'absolute';
    marker.style.background = '#e74c3c';
    marker.style.color = 'white';
    marker.style.padding = '4px';
    marker.style.borderRadius = '4px';
    marker.style.zIndex = "100";
    marker.innerText = labels[clicks.length - 1];
    document.body.appendChild(marker);
    if (clicks.length === 4) {
        document.getElementById('status').innerText = "Pronto!";
        document.getElementById('btnDownload').disabled = false;
    } else {
        document.getElementById('status').innerText = "Clique para: " + labels[clicks.length];
    }
});

// 3. LOGICA E DOWNLOAD
document.getElementById('btnDownload').addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        const docContext = pdfDoc.context;

        const fieldNames = ['c1', 'c2', 'c3', 'res'];
        const fields = [];

        for (let i = 0; i < 4; i++) {
            let f;
            // SE FOR O CAMPO 1 (i === 0), CRIA UMA CAIXA DE LISTA
            if (i === 0) {
                f = form.createDropdown(fieldNames[i]);
                f.addOptions(['A', 'B', 'C']); // Adiciona as opções
                f.select('A'); // Define 'A' como padrão
            } else {
                // SE FOREM OS OUTROS CAMPOS, CRIA CAMPO DE TEXTO NORMAL
                f = form.createTextField(fieldNames[i]);
                f.setText(i === 2 ? "1d4" : "0");
            }

            const pos = clicks[i];
            const pdfX = (pos.x * width) / pos.w;
            const pdfY = height - ((pos.y * height) / pos.h);
            f.addToPage(page, { x: pdfX, y: pdfY - 10, width: 60, height: 20 });
            fields.push(f);
        }

        // SCRIPT UNIFICADO: Lógica da Letra -> Número inclusa
        const scriptMotor = [
            'var escolha = this.getField("c1").value;',
            'var c1 = 0;',
            'if (escolha == "A") { c1 = 8; }',
            'else if (escolha == "B") { c1 = 2; }',
            'else if (escolha == "C") { c1 = 2; }',
            
            'var c2 = Number(this.getField("c2").value) || 0;',
            'var dText = "";',
            'var dNum = 0;',

            // ORDEM IMPORTA (do maior para o menor) - Mantive a sua lógica exata
            'if (c2 >= 51) { dText = "1d100"; dNum = 100; }',
            'else if (c2 >= 27 && c2 <= 50) { dText = "1d50"; dNum = 50; }',
            'else if (c2 >= 26 && c2 <= 35) { dText = "1d20"; dNum = 20; }', // Nota: Tem uma sobreposição de números aqui no 26/27 da sua lógica, mas mantive como você pediu!
            'else if (c2 >= 21 && c2 <= 25) { dText = "1d12"; dNum = 12; }',
            'else if (c2 >= 16 && c2 <= 20) { dText = "1d10"; dNum = 10; }',
            'else if (c2 >= 11 && c2 <= 15) { dText = "1d8"; dNum = 8; }',
            'else if (c2 >= 6 && c2 <= 10) { dText = "1d6"; dNum = 6; }',
            'else { dText = "1d4"; dNum = 4; }',

            // Atualiza campo 3
            'this.getField("c3").value = dText;',

            // Calcula resultado
            'this.getField("res").value = (c1 * c2) + dNum;'
        ].join('\n');

        const action = docContext.obj({
            Type: 'Action',
            S: 'JavaScript',
            JS: PDFString.of(scriptMotor)
        });

        // Adicionando 'V' (Validate) junto com 'K' para garantir que a mudança na caixa de lista ative a conta
        fields[0].acroField.dict.set(PDFName.of('AA'), docContext.obj({ K: action, V: action })); 
        fields[1].acroField.dict.set(PDFName.of('AA'), docContext.obj({ K: action })); 

        // Configuração final do PDF
        const acroForm = pdfDoc.catalog.get(PDFName.of('AcroForm'));
        if (acroForm) {
            const acroFormDict = docContext.lookup(acroForm);
            acroFormDict.set(PDFName.of('NeedAppearances'), docContext.obj(true));
        }

        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "ficha_RPG_calculavel.pdf";
        a.click();
        setTimeout(() => window.URL.revokeObjectURL(url), 1500);

    } catch (err) {
        alert("Erro técnico: " + err.message);
    }
});
