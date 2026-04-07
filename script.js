const { PDFDocument, PDFName, PDFString } = window.PDFLib || {};

let pdfOriginalBytes = null; 
let clicks = [];

// 1. RÓTULOS EXPANDIDOS (Total 24)
const labels = [
    "C1 (Lista Base)", "C2 (Nível 1)", "C3 (Dado 1)", "C4 (Total 1)", 
    "C5 (Nível 2)", "C6 (Dado 2)", "C7 (Total 2)", "C8 (Total 3)",
    "C9 (Nível 3)", "C10 (Dado 3)", "C11 (Nível 4)", "C12 (Dado 4)",
    "C13 (Nível 5)", "C14 (Dado 5)", "C15 (Nível 6)", "C16 (Dado 6)",
    "C17 (Nível 7)", "C18 (Dado 7)", "C19 (Nível 8)", "C20 (Dado 8)",
    "C21 (Nível 9)", "C22 (Dado 9)", "C23 (Nível 10)", "C24 (Dado 10)"
];

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// CARREGAMENTO
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

// MARCAÇÃO (Limite atualizado para 24)
document.getElementById('pdf-canvas').addEventListener('click', (e) => {
    if (clicks.length >= 24 || !pdfOriginalBytes) return;
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
    
    if (clicks.length === 24) {
        document.getElementById('status').innerText = "Pronto!";
        document.getElementById('btnDownload').disabled = false;
    } else {
        document.getElementById('status').innerText = "Clique para: " + labels[clicks.length];
    }
});

// LOGICA E DOWNLOAD
document.getElementById('btnDownload').addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        const docContext = pdfDoc.context;

        const fieldNames = [
            'c1', 'c2', 'c3', 'res', 'c5', 'c6', 'res2', 'c8',
            'c9', 'c10', 'c11', 'c12', 'c13', 'c14', 'c15', 'c16',
            'c17', 'c18', 'c19', 'c20', 'c21', 'c22', 'c23', 'c24'
        ];
        const fields = [];

        for (let i = 0; i < 24; i++) {
            let f;
            if (i === 0) {
                f = form.createDropdown(fieldNames[i]);
                f.addOptions(['A', 'B', 'C']);
                f.select('A');
            } else {
                f = form.createTextField(fieldNames[i]);
                // Índices visuais que são campos de "Dado" (C3, C6, C10, C12, C14, C16, C18, C20, C22, C24)
                const dadosIndices = [2, 5, 9, 11, 13, 15, 17, 19, 21, 23];
                f.setText(dadosIndices.includes(i) ? "1d4" : "0");
            }
            const pos = clicks[i];
            const pdfX = (pos.x * width) / pos.w;
            const pdfY = height - ((pos.y * height) / pos.h);
            f.addToPage(page, { x: pdfX, y: pdfY - 10, width: 60, height: 20 });
            fields.push(f);
        }

        // MOTOR DE CÁLCULO ATUALIZADO
        const scriptMotor = [
            'var escolha = this.getField("c1").value;',
            'var valBase1 = 0; var valBase2 = 0; var valBase3 = 0;',
            'if (escolha == "A") { valBase1 = 8; valBase2 = 2; valBase3 = 2; }',
            'else if (escolha == "B") { valBase1 = 2; valBase2 = 4; valBase3 = 2; }',
            'else if (escolha == "C") { valBase1 = 4; valBase2 = 4; valBase3 = 2; }',
            
            'function getDado(nivel) {',
            '  nivel = Number(nivel) || 0;',
            '  if (nivel >= 51) return "1d100";',
            '  if (nivel >= 27) return "1d50";',
            '  if (nivel >= 26) return "1d20";',
            '  if (nivel >= 21) return "1d12";',
            '  if (nivel >= 16) return "1d10";',
            '  if (nivel >= 11) return "1d8";',
            '  if (nivel >= 6) return "1d6";',
            '  return "1d4";',
            '}',

            // Lógica Blocos Iniciais
            'var n1 = Number(this.getField("c2").value) || 0;',
            'this.getField("c3").value = getDado(n1);',
            'var d1N = (n1 >= 51)?100:(n1 >= 27)?50:(n1 >= 26)?20:(n1 >= 21)?12:(n1 >= 16)?10:(n1 >= 11)?8:(n1 >= 6)?6:4;',
            'this.getField("res").value = (valBase1 * n1) + d1N;',
            'this.getField("c8").value = (valBase3 * n1) + d1N;',

            'var n2 = Number(this.getField("c5").value) || 0;',
            'this.getField("c6").value = getDado(n2);',
            'var d2N = (n2 >= 51)?100:(n2 >= 27)?50:(n2 >= 26)?20:(n2 >= 21)?12:(n2 >= 16)?10:(n2 >= 11)?8:(n2 >= 6)?6:4;',
            'this.getField("res2").value = (valBase2 * n2) + d2N;',

            // Lógica Pares 9-16
            'this.getField("c10").value = getDado(this.getField("c9").value);',
            'this.getField("c12").value = getDado(this.getField("c11").value);',
            'this.getField("c14").value = getDado(this.getField("c13").value);',
            'this.getField("c16").value = getDado(this.getField("c15").value);',

            // NOVA Lógica Pares 17-24
            'this.getField("c18").value = getDado(this.getField("c17").value);',
            'this.getField("c20").value = getDado(this.getField("c19").value);',
            'this.getField("c22").value = getDado(this.getField("c21").value);',
            'this.getField("c24").value = getDado(this.getField("c23").value);'
        ].join('\n');

        const action = docContext.obj({
            Type: 'Action',
            S: 'JavaScript',
            JS: PDFString.of(scriptMotor)
        });

        // GATILHOS (Campos que disparam o script ao mudar: C1, C2, C5, C9, C11, C13, C15, C17, C19, C21, C23)
        const triggerIndices = [0, 1, 4, 8, 10, 12, 14, 16, 18, 20, 22]; 
        triggerIndices.forEach(idx => {
            fields[idx].acroField.dict.set(PDFName.of('AA'), docContext.obj({ K: action, V: action }));
        });

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
        a.download = "ficha_RPG_24_campos.pdf";
        a.click();
    } catch (err) {
        alert("Erro técnico: " + err.message);
    }
});
