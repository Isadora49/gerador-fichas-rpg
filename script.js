const { PDFDocument, PDFName, PDFString } = window.PDFLib || {};

let pdfOriginalBytes = null;
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
    "C37 (Texto 1)", "C38 (Texto 2)", "C39 (Texto 3)", "C40 (Texto 4)",
    "C41 (Multi-linha 1)", "C42 (Multi-linha 2)", "C43 (Multi-linha 3)"
];

let currentStep = 0;
const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// CARREGAMENTO
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfOriginalBytes = arrayBuffer.slice(0); 
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        document.querySelectorAll('.marker').forEach(m => m.remove());
        currentStep = 0;
        document.getElementById('status').innerText = "Clique para posicionar: " + labels[0];
        document.getElementById('btnDownload').disabled = true;
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

// CRIAÇÃO DO MARCADOR ARRASTÁVEL
canvas.addEventListener('click', (e) => {
    if (currentStep >= 43 || !pdfOriginalBytes) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = `field-${currentStep}`;
    // Definindo tamanho padrão baseado no tipo
    const defaultW = (currentStep >= 40) ? 120 : 60;
    const defaultH = (currentStep >= 40) ? 60 : 20;

    marker.style.width = defaultW + 'px';
    marker.style.height = defaultH + 'px';
    marker.style.left = (x - defaultW / 2) + 'px';
    marker.style.top = (y - defaultH / 2) + 'px';
    
    marker.innerHTML = `<span class="label-text">${labels[currentStep]}</span>`;
    wrapper.appendChild(marker);

    makeDraggable(marker);

    currentStep++;
    if (currentStep === 43) {
        document.getElementById('status').innerText = "Todos os campos posicionados!";
        document.getElementById('btnDownload').disabled = false;
    } else {
        document.getElementById('status').innerText = "Posicione: " + labels[currentStep];
    }
});

// FUNÇÃO PARA ARRASTAR ELEMENTOS
function makeDraggable(el) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    el.addEventListener('mousedown', (e) => {
        if (e.offsetX > el.clientWidth - 15 && e.offsetY > el.clientHeight - 15) return; // Não arrasta se estiver redimensionando
        isDragging = true;
        offset = {
            x: e.clientX - el.offsetLeft,
            y: e.clientY - el.offsetTop
        };
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        el.style.left = (e.clientX - offset.x) + 'px';
        el.style.top = (e.clientY - offset.y) + 'px';
    });

    document.addEventListener('mouseup', () => { isDragging = false; });
}

// GERAÇÃO DO PDF FINAL
document.getElementById('btnDownload').addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();

        for (let i = 0; i < 43; i++) {
            const el = document.getElementById(`field-${i}`);
            if (!el) continue;

            // Nomes dos campos
            let name = (i === 3) ? 'res' : (i === 6) ? 'res2' : `c${i+1}`;
            
            let f;
            if (i === 0) {
                f = form.createDropdown(name);
                f.addOptions(['A', 'B', 'C']);
                f.select('A');
            } else {
                f = form.createTextField(name);
                if (i < 36) {
                    const dadosIndices = [2, 5, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35];
                    f.setText(dadosIndices.includes(i) ? "1d4" : "0");
                } else if (i >= 40) {
                    f.enableMultiline();
                }
            }

            // Converter coordenadas do HTML para o PDF
            const rect = canvas.getBoundingClientRect();
            const elLeft = parseFloat(el.style.left);
            const elTop = parseFloat(el.style.top);
            const elW = el.offsetWidth;
            const elH = el.offsetHeight;

            const pdfX = (elLeft * width) / canvas.width;
            // No PDF, o Y 0 é na BASE da página, no HTML é no TOPO.
            const pdfY = height - ((elTop * height) / canvas.height) - ((elH * height) / canvas.height);
            const pdfW = (elW * width) / canvas.width;
            const pdfH = (elH * height) / canvas.height;

            f.addToPage(page, { x: pdfX, y: pdfY, width: pdfW, height: pdfH });
        }

        // MOTOR DE CÁLCULO (O mesmo que você já usa)
        const scriptMotor = [
            'var escolha = this.getField("c1").value;',
            'var valBase1 = 0; var valBase2 = 0; var valBase3 = 0;',
            'if (escolha == "A") { valBase1 = 8; valBase2 = 2; valBase3 = 2; }',
            'else if (escolha == "B") { valBase1 = 2; valBase2 = 4; valBase3 = 2; }',
            'else if (escolha == "C") { valBase1 = 4; valBase2 = 4; valBase3 = 2; }',
            'function getDado(nivel) {',
            '  nivel = Number(nivel) || 0;',
            '  if (nivel >= 51) return "1d100"; if (nivel >= 27) return "1d50";',
            '  if (nivel >= 26) return "1d20"; if (nivel >= 21) return "1d12";',
            '  if (nivel >= 16) return "1d10"; if (nivel >= 11) return "1d8";',
            '  if (nivel >= 6) return "1d6"; return "1d4";',
            '}',
            'var n1 = Number(this.getField("c2").value) || 0;',
            'this.getField("c3").value = getDado(n1);',
            'var d1N = (n1 >= 51)?100:(n1 >= 27)?50:(n1 >= 26)?20:(n1 >= 21)?12:(n1 >= 16)?10:(n1 >= 11)?8:(n1 >= 6)?6:4;',
            'this.getField("res").value = (valBase1 * n1) + d1N;',
            'this.getField("c8").value = (valBase3 * n1) + d1N;',
            'var n2 = Number(this.getField("c5").value) || 0;',
            'this.getField("c6").value = getDado(n2);',
            'var d2N = (n2 >= 51)?100:(n2 >= 27)?50:(n2 >= 26)?20:(n2 >= 21)?12:(n2 >= 16)?10:(n2 >= 11)?8:(n2 >= 6)?6:4;',
            'this.getField("res2").value = (valBase2 * n2) + d2N;',
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

        const action = pdfDoc.context.obj({
            Type: 'Action',
            S: 'JavaScript',
            JS: PDFString.of(scriptMotor)
        });

        const triggerIndices = [0, 1, 4, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34]; 
        const allFields = form.getFields();
        triggerIndices.forEach(idx => {
            allFields[idx].acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ K: action, V: action }));
        });

        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "ficha_interativa.pdf";
        a.click();
    } catch (err) {
        console.error(err);
        alert("Erro técnico: " + err.message);
    }
});
