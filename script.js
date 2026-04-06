const { PDFDocument, PDFName, PDFString } = window.PDFLib || {};

let pdfOriginalBytes = null; 
let clicks = [];
const labels = ["Campo 1 (X)", "Campo 2 (X)", "Campo 3 (+)", "Resultado (=)"];

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// 1. CARREGAMENTO (Mantido para estabilidade)
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
        alert("Erro ao carregar PDF: " + err.message);
    }
});

// 2. MARCAÇÃO (Mantido)
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

// 3. DOWNLOAD COM COMPATIBILIDADE PARA NAVEGADORES
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
            const pos = clicks[i];
            const f = form.createTextField(fieldNames[i]);
            const pdfX = (pos.x * width) / pos.w;
            const pdfY = height - ((pos.y * height) / pos.h);

            f.addToPage(page, { x: pdfX, y: pdfY - 10, width: 60, height: 20 });
            f.setText("0");
            fields.push(f);
        }

        // SCRIPT OTIMIZADO PARA CHROME/EDGE
        // Usamos uma lógica que verifica se o valor é nulo para evitar erros de NaN no navegador
        const calculationJS = `
            var f1 = this.getField("c1").value;
            var f2 = this.getField("c2").value;
            var f3 = this.getField("c3").value;
            var n1 = (f1 == "") ? 0 : Number(f1);
            var n2 = (f2 == "") ? 0 : Number(f2);
            var n3 = (f3 == "") ? 0 : Number(f3);
            event.value = (n1 * n2) + n3;
        `;

        const resField = fields[3];

        // 1. Define a ação de cálculo no campo de resultado
        resField.acroField.dict.set(
            PDFName.of('AA'),
            docContext.obj({
                C: docContext.obj({
                    Type: 'Action',
                    S: 'JavaScript',
                    JS: calculationJS
                })
            })
        );

        // 2. CONFIGURAÇÃO DO ACROFORM PARA NAVEGADORES
        const acroForm = pdfDoc.catalog.get(PDFName.of('AcroForm'));
        const acroFormDict = docContext.lookup(acroForm);

        // Define a Ordem de Cálculo (CO) explicitamente
        // Isso é o que faz o Chrome "acordar" para o cálculo
        acroFormDict.set(PDFName.of('CO'), docContext.obj([resField.ref]));

        // Ativa sinalizadores de visualização (ajuda no rendering do Chrome)
        acroFormDict.set(PDFName.of('NeedAppearances'), docContext.boolean(true));

        const finalPdfBytes = await pdfDoc.save();
        
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "ficha_RPG_FullCompat.pdf";
        a.click();
        
        setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch (err) {
        console.error(err);
        alert("Erro: " + err.message);
    }
});
