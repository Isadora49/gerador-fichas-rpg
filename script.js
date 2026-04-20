const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;
const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');
const inputName = document.getElementById('fieldName');
const inputType = document.getElementById('fieldType');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// CARREGAMENTO DO PDF
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
        statusEl.innerText = "PDF Pronto! Digite o nome do campo e clique no local.";
        btnDownload.disabled = false;
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

// CRIAÇÃO DO MARCADOR (CLIQUE)
canvas.addEventListener('click', (e) => {
    if (!pdfOriginalBytes) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const name = inputName.value.trim() || `campo_${document.querySelectorAll('.marker').length + 1}`;
    const type = inputType.value;

    createMarker(x, y, name, type);
    inputName.value = ""; // Limpa para o próximo
});

function createMarker(x, y, name, type) {
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.dataset.type = type;
    marker.dataset.name = name;
    
    const isMulti = type === 'multiline';
    const defaultW = isMulti ? 120 : 60;
    const defaultH = isMulti ? 60 : 20;

    marker.style.width = defaultW + 'px';
    marker.style.height = defaultH + 'px';
    marker.style.left = (x - defaultW / 2) + 'px';
    marker.style.top = (y - defaultH / 2) + 'px';
    
    marker.innerHTML = `
        <div class="delete-btn" onclick="this.parentElement.remove()">×</div>
        <span class="label-text">${name}</span>
    `;

    wrapper.appendChild(marker);
    makeDraggable(marker);
}

function makeDraggable(el) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    el.addEventListener('mousedown', (e) => {
        if (e.target.className === 'delete-btn') return;
        if (e.offsetX > el.clientWidth - 15 && e.offsetY > el.clientHeight - 15) return; 
        isDragging = true;
        offset = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop };
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        el.style.left = (e.clientX - offset.x) + 'px';
        el.style.top = (e.clientY - offset.y) + 'px';
    });

    document.addEventListener('mouseup', () => { isDragging = false; });
}

// GERAÇÃO DO PDF FINAL (DINÂMICA)
btnDownload.addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        const cWidth = canvas.width;
        const cHeight = canvas.height;

        const markers = document.querySelectorAll('.marker');

        markers.forEach(el => {
            const name = el.dataset.name;
            const type = el.dataset.type;
            let f;

            if (type === 'dropdown') {
                f = form.createDropdown(name);
                f.addOptions([' ', 'Tank', 'Hibrido', 'Assassino', 'Destruidor', 'Arcano', 'Mentalista', 'Vitalista', 'Invocador', 'Elementalista']);
            } else {
                f = form.createTextField(name);
                if (type === 'multiline') f.enableMultiline();
            }

            f.setFontSize(12);
            f.setAlignment(TextAlignment.Center);

            const elLeft = parseFloat(el.style.left);
            const elTop = parseFloat(el.style.top);
            const elW = el.offsetWidth;
            const elH = el.offsetHeight;

            f.addToPage(page, { 
                x: (elLeft * width) / cWidth, 
                y: height - ((elTop * height) / cHeight) - ((elH * height) / cHeight), 
                width: (elW * width) / cWidth, 
                height: (elH * height) / cHeight,
                borderWidth: 0 
            });
        });

        // MANTÉM SEU MOTOR DE CÁLCULO ORIGINAL
        const scriptMotor = [
            'var escolha = this.getField("c1").value;',
            'var bases = { "Tank": [8,2,2], "Hibrido": [4,2,4], "Assassino": [2,2,8], "Destruidor": [2,4,2], "Arcano": [2,4,2], "Mentalista": [2,4,2], "Vitalista": [2,6,2], "Invocador": [2,6,2], "Elementalista": [2,5,2] };',
            'var b = bases[escolha] || [0,0,0];',
            'function getDado(nivel) { nivel = Number(nivel) || 0; if (nivel >= 51) return "1d100"; if (nivel >= 36) return "1d50"; if (nivel >= 26) return "1d20"; if (nivel >= 21) return "1d12"; if (nivel >= 16) return "1d10"; if (nivel >= 11) return "1d8"; if (nivel >= 6) return "1d6"; return "1d4"; }',
            'function getD(nivel) { return (nivel >= 51)?100:(nivel >= 36)?50:(nivel >= 26)?20:(nivel >= 21)?12:(nivel >= 16)?10:(nivel >= 11)?8:(nivel >= 6)?6:4; }',
            'var n1 = Number(this.getField("c2").value) || 0;',
            'if(this.getField("c3")) this.getField("c3").value = getDado(n1);',
            'if(this.getField("res")) this.getField("res").value = (valBase1 * n1) + getD(n1);',
            'for (var i = 9; i <= 35; i += 2) { var nf = this.getField("c" + i); var df = this.getField("c" + (i + 1)); if (nf && df) { df.value = getDado(nf.value); } }'
        ].join('\n');

        const action = pdfDoc.context.obj({ Type: 'Action', S: 'JavaScript', JS: PDFString.of(scriptMotor) });
        form.acroForm.dict.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(true));

        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "ficha_editavel.pdf";
        a.click();
    } catch (err) {
        console.error(err);
        alert("Erro técnico: " + err.message);
    }
});
