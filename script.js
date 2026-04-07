const { PDFDocument, PDFName, PDFString } = window.PDFLib || {};

let pdfOriginalBytes = null; 
let clicks = [];
const labels = ["C1 (Base)", "C2 (Bons)", "C3 (Dado)", "C4 (Total)"];

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
            const f = form.createTextField(fieldNames[i]);
            const pos = clicks[i];
            const pdfX = (pos.x * width) / pos.w;
            const pdfY = height - ((pos.y * height) / pos.h);
            f.addToPage(page, { x: pdfX, y: pdfY - 10, width: 60, height: 20 });
            f.setText(i === 2 ? "1d4" : "0");
            fields.push(f);
        }

        // SCRIPT UNIFICADO: O Campo 2 agora controla o Campo 3 e o Campo 4
        const scriptMotor = [
            'var c1 = Number(this.getField("c1").value) || 0;',
            'var c2 = Number(this.getField("c2").value) || 0;',
            'var dText = "1d4"; var dNum = 4;',
            'if (c2 => 51) { dText = "1d100"; dNum = 100; }',
            'else if (c2 <= 50) { dText = "1d50"; dNum = 50; }',
            'else if (c2 <= 35) { dText = "1d20"; dNum = 20; }',
            'else if (c2 <= 25) { dText = "1d20"; dNum = 12; }',
            'else if (c2 <= 20) { dText = "1d12"; dNum = 10; }',
            'else if (c2 <= 15) { dText = "1d10"; dNum = 8; }',
            'else if (c2 <= 10) { dText = "1d8"; dNum = 6; }',
            'else if (c2 <= 5) { dText = "1d6"; dNum = 4; }',
            'this.getField("c3").value = dText;',
            'this.getField("res").value = (c1 * c2) + dNum;'
        ].join(' ');

        // Injetamos a lógica no "OnBlur" ou "Calculate" dos campos de entrada
        // Assim, qualquer mudança em C1 ou C2 dispara a atualização total
        const action = docContext.obj({
            Type: 'Action',
            S: 'JavaScript',
            JS: PDFString.of(scriptMotor)
        });

        fields[0].acroField.dict.set(PDFName.of('AA'), docContext.obj({ K: action })); // Ao digitar no C1
        fields[1].acroField.dict.set(PDFName.of('AA'), docContext.obj({ K: action })); // Ao digitar no C2

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
