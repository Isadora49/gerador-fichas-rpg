const { PDFDocument, PDFName, PDFString } = window.PDFLib || {};

let pdfOriginalBytes = null; 
let clicks = [];

// 1. RÓTULOS EXPANDIDOS (Total 40 - 36 lógicos + 4 textos livres)
const labels = [
    "C1 (Lista Base)", "C2 (Nível 1)", "C3 (Dado 1)", "C4 (Total 1)", 
    "C5 (Nível 2)", "C6 (Dado 2)", "C7 (Total 2)", "C8 (Total 3)",
    "C9 (Nível 3)", "C10 (Dado 3)", "C11 (Nível 4)", "C12 (Dado 4)",
    "C13 (Nível 5)", "C14 (Dado 5)", "C15 (Nível 6)", "C16 (Dado 6)",
    "C17 (Nível 7)", "C18 (Dado 7)", "C19 (Nível 8)", "C20 (Dado 8)",
    "C21 (Nível 9)", "C22 (Dado 9)", "C23 (Nível 10)", "C24 (Dado 10)",
    "C25 (Nível 11)", "C26 (Dado 11)", "C27 (Nível 12)", "C28 (Dado 12)",
    "C29 (Nível 13)", "C30 (Dado 13)", "C31 (Nível 14)", "C32 (Dado 14)",
    "C33 (Nível 15)", "C34 (Dado 15)", "C35 (Nível 16)", "C36 (Dado 16)",
    "C37 (Texto Livre 1)", "C38 (Texto Livre 2)", "C39 (Texto Livre 3)", "C40 (Texto Livre 4)"
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

// MARCAÇÃO (Limite atualizado para 40)
document.getElementById('pdf-canvas').addEventListener('click', (e) => {
    if (clicks.length >= 40 || !pdfOriginalBytes) return;
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
    
    if (clicks.length === 40) {
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

        // Gerar nomes de c1 até c40
        const fieldNames = Array.from({length: 40}, (_, i) => {
            if (i === 3) return 'res';
            if (i === 6) return 'res2';
            return `c${i+1}`;
        });
        
        const fields = [];

        for (let i = 0; i < 40; i++) {
            let f;
            if (i === 0) {
                f = form.createDropdown(fieldNames[i]);
                f.addOptions(['A', 'B', 'C']);
                f.select('A');
            } else {
                f = form.createTextField(fieldNames[i]);
                
                // Índices lógicos (até C36)
                if (i < 36) {
                    const dadosIndices = [2, 5, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35];
                    f.setText(dadosIndices.includes(i) ? "1d4" : "0");
                } else {
                    // Campos 37, 38, 39 e 40 (Texto Livre) ficam vazios por padrão
                    f.setText(""); 
                }
            }
            const pos = clicks[i];
            const pdfX = (pos.x * width) / pos.w;
            const pdfY = height - ((pos.y * height) / pos.h);
            f.addToPage(page, { x: pdfX, y: pdfY - 10, width: 60, height: 20 });
            fields.push(f);
        }

        // MOTOR DE CÁLCULO MANTIDO INTACTO (Lógica até C36 apenas)
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

            // Lógica Blocos Iniciais e Campo 8
            'var n1 = Number(this.getField("c2").value) || 0;',
            'this.getField("c3").value = getDado(n1);',
            'var d1N = (n1 >= 51)?100:(n1 >= 27)?50:(n1 >= 26)?20:(n1 >= 21)?12:(n1 >= 16)?10:(n1 >= 11)?8:(n1 >= 6)?6:4;',
            'this.getField("res").value = (valBase1 * n1) + d1N;',
            'this.getField("c8").value = (valBase3 * n1) + d1N;',

            'var n2 = Number(this.getField("c5").value) || 0;',
            'this.getField("c6").value = getDado(n2);',
            'var d2N = (n2 >= 51)?100:(n2 >= 27)?50:(n2 >= 26)?20:(n2 >= 21)?12:(n2 >= 16)?10:(n2 >= 11)?8:(n2 >= 6)?6:4;',
            'this.getField("res2").value = (valBase2 * n2) + d2N;',

            // Automação de Dados (9 ao 36)
            'this.getField("c10").value = getDado(this.getField("c9").value);',
            'this.getField("c12").value = getDado(this.getField("c11").value);',
            'this.getField("c14").value = getDado(this.getField("c13").value);',
            'this.getField("c16").value = getDado(this.getField("c15").value);',
            'this.getField("c18").value = getDado(this.getField("c17").value);',
            'this.getField("c20").value = getDado(this.getField("c19").value);',
            'this.getField("c22").value = getDado(this.getField("c21").value);',
            'this.getField("c24").value = getDado(this.getField("c23").value);',
            'this.getField("c26").value = getDado(this.getField("c25").value);',
            'this.getField("c28").value = getDado(this.getField("c27").value);',
            'this.getField("c30").value = getDado(this.getField("c29").value);',
            'this.getField("c32").value = getDado(this.getField("c31").value);',
            'this.getField("c34").value = getDado(this.getField("c33").value);',
            'this.getField("c36").value = getDado(this.getField("c35").value);'
        ].join('\n');

        const action = docContext.obj({
            Type: 'Action',
            S: 'JavaScript',
            JS: PDFString.of(scriptMotor)
        });

        // GATILHOS (Índices apenas dos campos lógicos)
        const triggerIndices = [0, 1, 4, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34]; 
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
        a.download = "ficha_RPG_40_campos.pdf";
        a.click();
    } catch (err) {
        alert("Erro técnico: " + err.message);
    }
});
