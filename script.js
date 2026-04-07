const { PDFDocument, PDFName, PDFString } = window.PDFLib || {};

let pdfOriginalBytes = null; 
let clicks = [];
const labels = [
    "C1 (Lista Base)", "C2 (Nível 1)", "C3 (Dado 1)", "C4 (Total 1)", 
    "C5 (Nível 2)", "C6 (Dado 2)", "C7 (Total 2)", "C8 (Extra)"
];

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// 1. CARREGAMENTO
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
    if (clicks.length >= 8 || !pdfOriginalBytes) return;
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
    if (clicks.length === 8) {
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

        const fieldNames = ['c1', 'c2', 'c3', 'res', 'c5', 'c6', 'res2', 'c8'];
        const fields = [];

        for (let i = 0; i < 8; i++) {
            let f;
            if (i === 0) {
                f = form.createDropdown(fieldNames[i]);
                f.addOptions(['A', 'B', 'C']);
                f.select('A');
            } else {
                f = form.createTextField(fieldNames[i]);
                // Inicializa C3 e C6 com "1d4"
                f.setText((i === 2 || i === 5) ? "1d4" : "0");
            }
            const pos = clicks[i];
            const pdfX = (pos.x * width) / pos.w;
            const pdfY = height - ((pos.y * height) / pos.h);
            f.addToPage(page, { x: pdfX, y: pdfY - 10, width: 60, height: 20 });
            fields.push(f);
        }

        // MOTOR DE CÁLCULO DUPLO
        const scriptMotor = [
            'var escolha = this.getField("c1").value;',
            'var valBase = (escolha == "A") ? 8 : 2;',
            
            // --- BLOCO 1 (C2 influencia C3 e gera C4/res) ---
            'var n1 = Number(this.getField("c2").value) || 0;',
            'var d1T = "1d4"; var d1N = 4;',
            'if (n1 >= 51) { d1T = "1d100"; d1N = 100; }',
            'else if (n1 >= 27) { d1T = "1d50"; d1N = 50; }',
            'else if (n1 >= 26) { d1T = "1d20"; d1N = 20; }',
            'else if (n1 >= 21) { d1T = "1d12"; d1N = 12; }',
            'else if (n1 >= 16) { d1T = "1d10"; d1N = 10; }',
            'else if (n1 >= 11) { d1T = "1d8"; d1N = 8; }',
            'else if (n1 >= 6) { d1T = "1d6"; d1N = 6; }',
            'this.getField("c3").value = d1T;',
            'this.getField("res").value = (valBase * n1) + d1N;',

            // --- BLOCO 2 (C5 influencia C6 e gera C7/res2) ---
            'var n2 = Number(this.getField("c5").value) || 0;',
            'var d2T = "1d4"; var d2N = 4;',
            'if (n2 >= 51) { d2T = "1d100"; d2N = 100; }',
            'else if (n2 >= 27) { d2T = "1d50"; d2N = 50; }',
            'else if (n2 >= 26) { d2T = "1d20"; d2N = 20; }',
            'else if (n2 >= 21) { d2T = "1d12"; d2N = 12; }',
            'else if (n2 >= 16) { d2T = "1d10"; d2N = 10; }',
            'else if (n2 >= 11) { d2T = "1d8"; d2N = 8; }',
            'else if (n2 >= 6) { d2T = "1d6"; d2N = 6; }',
            'this.getField("c6").value = d2T;',
            'this.getField("res2").value = (valBase * n2) + d2N;'
        ].join('\n');

        const action = docContext.obj({
            Type: 'Action',
            S: 'JavaScript',
            JS: PDFString.of(scriptMotor)
        });

        // Gatilhos: O cálculo roda se mudar C1 (lista), C2 (nível 1) ou C5 (nível 2)
        fields[0].acroField.dict.set(PDFName.of('AA'), docContext.obj({ K: action, V: action })); 
        fields[1].acroField.dict.set(PDFName.of('AA'), docContext.obj({ K: action })); 
        fields[4].acroField.dict.set(PDFName.of('AA'), docContext.obj({ K: action })); 

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
        a.download = "ficha_RPG_dupla_logica.pdf";
        a.click();
    } catch (err) {
        alert("Erro técnico: " + err.message);
    }
});
