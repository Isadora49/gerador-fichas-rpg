const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};
let pdfOriginalBytes = null;
let fields = []; // Array de objetos: { id, x, y, w, h, type, formula, options, align }
let selectedFieldId = null;

const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');
const propsPanel = document.getElementById('props-panel');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// --- CARREGAMENTO DO PDF ---
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    pdfOriginalBytes = arrayBuffer;
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    
    statusEl.innerText = "Clique no mapa para criar campos.";
    btnDownload.disabled = false;
});

// --- CRIAÇÃO DINÂMICA ---
canvas.addEventListener('click', (e) => {
    if (!pdfOriginalBytes) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const id = "campo_" + Date.now();
    const newField = {
        id: id,
        x: x - 30,
        y: y - 10,
        w: 60,
        h: 20,
        type: 'text',
        formula: '',
        options: '',
        align: 'center'
    };

    fields.push(newField);
    renderField(newField);
    selectField(id);
});

function renderField(fieldData) {
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = fieldData.id;
    marker.style.width = fieldData.w + 'px';
    marker.style.height = fieldData.h + 'px';
    marker.style.left = fieldData.x + 'px';
    marker.style.top = fieldData.y + 'px';
    marker.innerText = fieldData.id;

    marker.onclick = (e) => {
        e.stopPropagation();
        selectField(fieldData.id);
    };

    makeDraggableAndResizable(marker, fieldData);
    wrapper.appendChild(marker);
}

function selectField(id) {
    selectedFieldId = id;
    const data = fields.find(f => f.id === id);
    
    document.querySelectorAll('.marker').forEach(m => m.classList.remove('selected'));
    document.getElementById(id).classList.add('selected');

    // Preencher painel
    propsPanel.style.display = 'flex';
    document.getElementById('propId').value = data.id;
    document.getElementById('propType').value = data.type;
    document.getElementById('propFormula').value = data.formula;
    document.getElementById('propOptions').value = data.options;
    document.getElementById('propAlign').value = data.align;

    toggleInputs(data.type);
}

// Interatividade do Painel
document.getElementById('propType').onchange = (e) => toggleInputs(e.target.value);

function toggleInputs(type) {
    document.getElementById('calcGroup').style.display = type === 'calc' ? 'block' : 'none';
    document.getElementById('listGroup').style.display = type === 'list' ? 'block' : 'none';
}

document.getElementById('btnSaveProp').onclick = () => {
    const field = fields.find(f => f.id === selectedFieldId);
    const newId = document.getElementById('propId').value;

    field.id = newId;
    field.type = document.getElementById('propType').value;
    field.formula = document.getElementById('propFormula').value;
    field.options = document.getElementById('propOptions').value;
    field.align = document.getElementById('propAlign').value;

    const el = document.getElementById(selectedFieldId);
    el.id = newId;
    el.innerText = newId;
    selectedFieldId = newId;
    alert("Salvo!");
};

document.getElementById('btnDeleteField').onclick = () => {
    fields = fields.filter(f => f.id !== selectedFieldId);
    document.getElementById(selectedFieldId).remove();
    propsPanel.style.display = 'none';
};

// Funções de Arrastar e Redimensionar atualizando o Objeto
function makeDraggableAndResizable(el, data) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    el.onmousedown = (e) => {
        if (e.offsetX > el.clientWidth - 10 && e.offsetY > el.clientHeight - 10) return;
        isDragging = true;
        offset = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop };
    };

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            data.x = e.clientX - offset.x;
            data.y = e.clientY - offset.y;
            el.style.left = data.x + 'px';
            el.style.top = data.y + 'px';
        }
    });

    el.onmouseup = () => {
        isDragging = false;
        data.w = el.offsetWidth;
        data.h = el.offsetHeight;
    };
}

// --- GERAÇÃO DO PDF ---
btnDownload.onclick = async () => {
    const pdfDoc = await PDFDocument.load(pdfOriginalBytes);
    const form = pdfDoc.getForm();
    const page = pdfDoc.getPage(0);
    const { width, height } = page.getSize();

    fields.forEach(f => {
        let pdfField;
        if (f.type === 'list') {
            pdfField = form.createDropdown(f.id);
            const opts = f.options.split(',').map(o => o.trim());
            pdfField.addOptions(opts.length > 0 ? opts : [' ']);
        } else {
            pdfField = form.createTextField(f.id);
            if (f.type === 'calc') {
                pdfField.enableReadOnly();
                // Gerar script de cálculo para o PDF (Formato Acrobat)
                const jsFormula = f.formula.replace(/([a-zA-Z0-9_]+)/g, (match) => {
                    // Se for um número, não mexe, se for texto, assume que é ID de campo
                    return isNaN(match) ? `Number(this.getField("${match}").value)` : match;
                });
                
                const calcAction = pdfDoc.context.obj({
                    Type: 'Action',
                    S: 'JavaScript',
                    JS: PDFString.of(`event.value = ${jsFormula};`)
                });
                pdfField.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ C: calcAction }));
            }
        }

        // Alinhamento
        const alignMap = { 'left': TextAlignment.Left, 'center': TextAlignment.Center, 'right': TextAlignment.Right };
        pdfField.setAlignment(alignMap[f.align]);

        // Posição (Conversão Canvas -> PDF)
        pdfField.addToPage(page, {
            x: (f.x * width) / canvas.width,
            y: height - ((f.y * height) / canvas.height) - ((f.h * height) / canvas.height),
            width: (f.w * width) / canvas.width,
            height: (f.h * height) / canvas.height,
            borderWidth: 0
        });
    });

    form.acroForm.dict.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(true));
    
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "ficha_customizada.pdf";
    link.click();
};
