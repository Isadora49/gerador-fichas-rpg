const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;
let isAddingMode = false;
let fieldCounter = 1;

const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');
const btnAddField = document.getElementById('btnAddField');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// --- CARREGAMENTO DO PDF ---
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
        statusEl.innerText = "PDF Pronto. Clique em '+ NOVO CAMPO' para começar.";
        btnDownload.disabled = false;
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

// --- LÓGICA DE INTERAÇÃO (CAIXA DE FERRAMENTAS) ---

btnAddField.addEventListener('click', () => {
    isAddingMode = true;
    statusEl.innerText = "Clique em qualquer lugar do PDF para colocar o campo.";
    canvas.style.cursor = "copy";
});

canvas.addEventListener('click', (e) => {
    if (!isAddingMode || !pdfOriginalBytes) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    createMarker(x, y, `c${fieldCounter}`);
    
    fieldCounter++;
    isAddingMode = false;
    canvas.style.cursor = "crosshair";
    statusEl.innerText = "Campo adicionado! Use clique duplo para renomear.";
});

function createMarker(x, y, label) {
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.dataset.label = label;
    
    // Configuração inicial
    marker.style.width = '60px';
    marker.style.height = '20px';
    marker.style.left = (x - 30) + 'px';
    marker.style.top = (y - 10) + 'px';
    
    marker.innerHTML = `
        <span class="label-text">${label}</span>
        <div class="btn-del" title="Excluir">×</div>
    `;

    // Botão de Deletar
    marker.querySelector('.btn-del').addEventListener('click', (e) => {
        e.stopPropagation();
        marker.remove();
    });

    // Clique Duplo para Editar Nome
    marker.addEventListener('dblclick', () => {
        const novoNome = prompt("Digite o nome/ID deste campo:", marker.dataset.label);
        if (novoNome) {
            marker.dataset.label = novoNome;
            marker.querySelector('.label-text').innerText = novoNome;
        }
    });

    wrapper.appendChild(marker);
    makeDraggable(marker);
}

function makeDraggable(el) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    el.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('btn-del')) return;
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

// --- GERAÇÃO DO PDF FINAL (DINÂMICA) ---
btnDownload.addEventListener('click', async () => {
    const markers = document.querySelectorAll('.marker');
    if (markers.length === 0) return alert("Adicione ao menos um campo!");

    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        const cWidth = canvas.width;
        const cHeight = canvas.height;

        markers.forEach(el => {
            const label = el.dataset.label;
            const elLeft = parseFloat(el.style.left);
            const elTop = parseFloat(el.style.top);
            const elW = el.offsetWidth;
            const elH = el.offsetHeight;

            let f;
            // Se o nome for 'c1', cria dropdown (para manter sua lógica original)
            if (label.toLowerCase() === 'c1') {
                f = form.createDropdown(label);
                f.addOptions([' ', 'Tank', 'Hibrido', 'Assassino', 'Destruidor', 'Arcano', 'Mentalista', 'Vitalista', 'Invocador', 'Elementalista']);
            } else {
                f = form.createTextField(label);
                // Se for alto, assume multilinhas
                if (elH > 40) f.enableMultiline();
            }

            f.setFontSize(12);
            f.setAlignment(TextAlignment.Center);

            f.addToPage(page, { 
                x: (elLeft * width) / cWidth, 
                y: height - ((elTop * height) / cHeight) - ((elH * height) / cHeight), 
                width: (elW * width) / cWidth, 
                height: (elH * height) / cHeight,
                borderWidth: 0 
            });
        });

        // --- MOTOR DE CÁLCULO RPG (Script fixo injetado) ---
        const scriptMotor = [
            'var escolha = this.getField("c1") ? this.getField("c1").value : "";',
            'var bases = {"Tank":[8,2,2],"Hibrido":[4,2,4],"Assassino":[2,2,8],"Destruidor":[2,4,2],"Arcano":[2,4,2],"Mentalista":[2,4,2],"Vitalista":[2,6,2],"Invocador":[2,6,2],"Elementalista":[2,5,2]};',
            'var b = bases[escolha] || [0,0,0];',
            'function getDado(n){ n=Number(n)||0; return (n>=51)?"1d100":(n>=36)?"1d50":(n>=26)?"1d20":(n>=21)?"1d12":(n>=16)?"1d10":(n>=11)?"1d8":(n>=6)?"1d6":"1d4"; }',
            'function getD(n){ n=Number(n)||0; return (n>=51)?100:(n>=36)?50:(n>=26)?20:(n>=21)?12:(n>=16)?10:(n>=11)?8:(n>=6)?6:4; }',
            'try {',
            ' var n1 = Number(this.getField("c2").value) || 0;',
            ' if(this.getField("c3")) this.getField("c3").value = getDado(n1);',
            ' if(this.getField("res")) this.getField("res").value = (b[0]*n1)+getD(n1);',
            ' if(this.getField("c8")) this.getField("c8").value = (b[2]*n1)+getD(n1);',
            ' var n2 = Number(this.getField("c5").value) || 0;',
            ' if(this.getField("c6")) this.getField("c6").value = getDado(n2);',
            ' if(this.getField("res2")) this.getField("res2").value = (b[1]*n2)+getD(n2);',
            ' for(var i=9; i<=35; i+=2){ var nf=this.getField("c"+i); var df=this.getField("c"+(i+1)); if(nf && df) df.value=getDado(nf.value); }',
            '} catch(e){}'
        ].join('\n');

        const action = pdfDoc.context.obj({ Type: 'Action', S: 'JavaScript', JS: PDFString.of(scriptMotor) });
        form.acroForm.dict.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(true));

        // Aplica o trigger nos campos que disparam cálculos (se existirem)
        ['c1','c2','c5','c9','c11','c13','c15','c17','c19','c21','c23','c25','c27','c29','c31','c33','c35'].forEach(name => {
            try {
                const field = form.getField(name);
                field.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ K: action, V: action, Bl: action }));
            } catch(e) {}
        });

        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "ficha_editavel_custom.pdf";
        a.click();
    } catch (err) {
        alert("Erro técnico: " + err.message);
    }
});
