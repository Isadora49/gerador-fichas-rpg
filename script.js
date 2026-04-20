const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;
let fields = []; // Array de objetos { id, label, type, x, y, w, h, align, options, readonly }
let selectedFieldId = null;

const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');
const editorUI = document.getElementById('editor-ui');
const noSelectionEl = document.getElementById('no-selection');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// CARREGAR PDF
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
        fields = [];
        statusEl.innerText = "PDF Carregado. Adicione campos!";
        btnDownload.disabled = false;
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

// ADICIONAR NOVO CAMPO
document.getElementById('btnAddField').addEventListener('click', () => {
    if (!pdfOriginalBytes) return alert("Carregue um PDF primeiro!");
    
    const id = "c" + (fields.length + 1);
    const newField = {
        id: id,
        label: "Novo Campo",
        type: "text",
        x: 50,
        y: 50,
        w: 80,
        h: 25,
        align: "Center",
        options: "Opção 1, Opção 2",
        readonly: false
    };
    
    fields.push(newField);
    createMarker(newField);
});

function createMarker(fieldData) {
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = `marker-${fieldData.id}`;
    marker.style.width = fieldData.w + 'px';
    marker.style.height = fieldData.h + 'px';
    marker.style.left = fieldData.x + 'px';
    marker.style.top = fieldData.y + 'px';
    marker.innerHTML = `<span class="label-text">${fieldData.label}</span>`;
    
    wrapper.appendChild(marker);
    
    // Tornar selecionável
    marker.addEventListener('mousedown', () => selectField(fieldData.id));
    
    makeDraggable(marker, fieldData);
    makeResizable(marker, fieldData);
}

function selectField(id) {
    selectedFieldId = id;
    document.querySelectorAll('.marker').forEach(m => m.classList.remove('selected'));
    document.getElementById(`marker-${id}`).classList.add('selected');
    
    const field = fields.find(f => f.id === id);
    
    // Preencher UI de edição
    noSelectionEl.style.display = 'none';
    editorUI.style.display = 'block';
    
    document.getElementById('prop-id').value = field.id;
    document.getElementById('prop-label').value = field.label;
    document.getElementById('prop-type').value = field.type;
    document.getElementById('prop-align').value = field.align;
    document.getElementById('prop-options').value = field.options;
    document.getElementById('prop-readonly').checked = field.readonly;
    
    document.getElementById('group-dropdown').style.display = (field.type === 'dropdown') ? 'block' : 'none';
}

// SINCRONIZAR UI -> OBJETO
editorUI.addEventListener('input', (e) => {
    const field = fields.find(f => f.id === selectedFieldId);
    if (!field) return;
    
    field.id = document.getElementById('prop-id').value;
    field.label = document.getElementById('prop-label').value;
    field.type = document.getElementById('prop-type').value;
    field.align = document.getElementById('prop-align').value;
    field.options = document.getElementById('prop-options').value;
    field.readonly = document.getElementById('prop-readonly').checked;
    
    // Atualizar visual do marcador
    const marker = document.getElementById(`marker-${selectedFieldId}`);
    marker.querySelector('.label-text').innerText = field.label;
    document.getElementById('group-dropdown').style.display = (field.type === 'dropdown') ? 'block' : 'none';
});

// EXCLUIR CAMPO
document.getElementById('btnDeleteField').addEventListener('click', () => {
    fields = fields.filter(f => f.id !== selectedFieldId);
    document.getElementById(`marker-${selectedFieldId}`).remove();
    editorUI.style.display = 'none';
    noSelectionEl.style.display = 'block';
});

function makeDraggable(el, data) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    el.addEventListener('mousedown', (e) => {
        if (e.target.className === 'btn-del') return;
        isDragging = true;
        offset = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop };
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const x = e.clientX - offset.x;
        const y = e.clientY - offset.y;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        data.x = x;
        data.y = y;
    });

    document.addEventListener('mouseup', () => isDragging = false);
}

function makeResizable(el, data) {
    const observer = new ResizeObserver(() => {
        data.w = el.offsetWidth;
        data.h = el.offsetHeight;
    });
    observer.observe(el);
}

// GERAÇÃO DO PDF
btnDownload.addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        
        const cWidth = canvas.width;
        const cHeight = canvas.height;

        fields.forEach(fData => {
            let f;
            if (fData.type === 'dropdown') {
                f = form.createDropdown(fData.id);
                const opts = fData.options.split(',').map(o => o.trim());
                f.addOptions(opts);
            } else {
                f = form.createTextField(fData.id);
                if (fData.type === 'multiline') f.enableMultiline();
            }

            if (fData.readonly) f.enableReadOnly();

            f.setFontSize(12);
            f.setAlignment(TextAlignment[fData.align]);

            f.addToPage(page, { 
                x: (fData.x * width) / cWidth, 
                y: height - ((fData.y * height) / cHeight) - ((fData.h * height) / cHeight), 
                width: (fData.w * width) / cWidth, 
                height: (fData.h * height) / cHeight,
                borderWidth: 0 
            });
        });

        // CONSTRUIR SCRIPT DINÂMICO BASEADO NO JSON DA UI
        const logicConfig = document.getElementById('logic-config').value;
        const scriptMotor = `
            var escolha = this.getField("c1").value;
            var bases = ${logicConfig};
            var b = bases[escolha] || [0,0,0];
            var valBase1 = b[0], valBase2 = b[1], valBase3 = b[2];

            function getDado(nivel) {
                nivel = Number(nivel) || 0;
                if (nivel >= 51) return "1d100"; if (nivel >= 36) return "1d50";
                if (nivel >= 26) return "1d20"; if (nivel >= 21) return "1d12";
                if (nivel >= 16) return "1d10"; if (nivel >= 11) return "1d8";
                if (nivel >= 6) return "1d6"; return "1d4";
            }
            function getD(nivel) {
                nivel = Number(nivel);
                return (nivel >= 51)?100:(nivel >= 36)?50:(nivel >= 26)?20:(nivel >= 21)?12:(nivel >= 16)?10:(nivel >= 11)?8:(nivel >= 6)?6:4;
            }

            // Exemplo de automação fixa mantida do seu código original
            try {
                var n1 = Number(this.getField("c2").value) || 0;
                if(this.getField("c3")) this.getField("c3").value = getDado(n1);
                if(this.getField("res")) this.getField("res").value = (valBase1 * n1) + getD(n1);
                
                var n2 = Number(this.getField("c5").value) || 0;
                if(this.getField("c6")) this.getField("c6").value = getDado(n2);
            } catch(e) {}
        `;

        const action = pdfDoc.context.obj({
            Type: 'Action', S: 'JavaScript', JS: PDFString.of(scriptMotor)
        });

        // Aplicar gatilhos em todos os campos que não são apenas leitura
        fields.filter(f => !f.readonly).forEach(fData => {
            try {
                const field = form.getField(fData.id);
                field.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ K: action, V: action, Bl: action }));
            } catch(e) {}
        });

        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "ficha_customizada.pdf";
        a.click();
    } catch (err) {
        console.error(err);
        alert("Erro ao gerar PDF: " + err.message);
    }
});
