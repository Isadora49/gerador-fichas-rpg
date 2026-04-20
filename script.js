const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};
let pdfOriginalBytes = null;
let fieldConfigs = []; // Armazena a lógica de todos os campos
let selectedFieldId = null;

const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// --- GERENCIAMENTO DE CAMPOS ---

document.getElementById('btnAddField').addEventListener('click', () => {
    if (!pdfOriginalBytes) return alert("Carregue um PDF primeiro!");
    
    const id = `campo_${fieldConfigs.length + 1}`;
    const newField = {
        id: id,
        type: 'text',
        formula: '',
        align: 'Center',
        x: 50, y: 50, w: 80, h: 25
    };
    
    fieldConfigs.push(newField);
    renderMarker(newField);
});

function renderMarker(config) {
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = `marker-${config.id}`;
    marker.style.width = config.w + 'px';
    marker.style.height = config.h + 'px';
    marker.style.left = config.x + 'px';
    marker.style.top = config.y + 'px';
    marker.innerHTML = `<span style="pointer-events:none">${config.id}</span>`;
    
    marker.onclick = (e) => {
        e.stopPropagation();
        selectField(config.id);
    };

    makeDraggable(marker, config);
    wrapper.appendChild(marker);
    selectField(config.id);
}

function selectField(id) {
    selectedFieldId = id;
    document.querySelectorAll('.marker').forEach(m => m.classList.remove('selected'));
    document.getElementById(`marker-${id}`).classList.add('selected');
    
    const config = fieldConfigs.find(f => f.id === id);
    
    // Preencher painel lateral
    document.getElementById('properties-panel').style.display = 'block';
    document.getElementById('no-selection').style.display = 'none';
    document.getElementById('prop-id').value = config.id;
    document.getElementById('prop-type').value = config.type;
    document.getElementById('prop-formula').value = config.formula;
    document.getElementById('prop-align').value = config.align;
}

// Atualizar dados ao digitar no painel lateral
['prop-id', 'prop-type', 'prop-formula', 'prop-align'].forEach(prop => {
    document.getElementById(prop).addEventListener('input', (e) => {
        if (!selectedFieldId) return;
        const config = fieldConfigs.find(f => f.id === selectedFieldId);
        const val = e.target.value;
        
        if (prop === 'prop-id') {
            const oldId = config.id;
            config.id = val;
            document.getElementById(`marker-${oldId}`).id = `marker-${val}`;
            document.getElementById(`marker-${val}`).innerText = val;
        } else {
            config[prop.replace('prop-', '')] = val;
        }
    });
});

document.getElementById('btnDeleteField').addEventListener('click', () => {
    if (!selectedFieldId) return;
    fieldConfigs = fieldConfigs.filter(f => f.id !== selectedFieldId);
    document.getElementById(`marker-${selectedFieldId}`).remove();
    document.getElementById('properties-panel').style.display = 'none';
    document.getElementById('no-selection').style.display = 'block';
    selectedFieldId = null;
});

// --- LÓGICA DE PDF (PDF.JS & PDF-LIB) ---

document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    pdfOriginalBytes = arrayBuffer.slice(0);
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    
    statusEl.innerText = "PDF Carregado. Adicione campos.";
    btnDownload.disabled = false;
});

function makeDraggable(el, config) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    el.addEventListener('mousedown', (e) => {
        if (e.offsetX > el.clientWidth - 15 && e.offsetY > el.clientHeight - 15) return;
        isDragging = true;
        offset = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop };
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const nx = e.clientX - offset.x;
        const ny = e.clientY - offset.y;
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
        config.x = nx;
        config.y = ny;
        config.w = el.offsetWidth;
        config.h = el.offsetHeight;
    });

    document.addEventListener('mouseup', () => isDragging = false);
}

btnDownload.addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();

        fieldConfigs.forEach(conf => {
            let f;
            if (conf.type === 'dropdown') {
                f = form.createDropdown(conf.id);
                f.addOptions(['Opção 1', 'Opção 2']); // Editável futuramente
            } else {
                f = form.createTextField(conf.id);
                if (conf.type === 'multiline') f.enableMultiline();
            }

            f.setAlignment(TextAlignment[conf.align]);
            
            // Posicionamento
            f.addToPage(page, {
                x: (conf.x * width) / canvas.width,
                y: height - ((conf.y * height) / canvas.height) - ((conf.h * height) / canvas.height),
                width: (conf.w * width) / canvas.width,
                height: (conf.h * height) / canvas.height,
                borderWidth: 0
            });

            // Aplica a fórmula se existir
            if (conf.formula) {
                const js = `var v = ${conf.formula}; event.value = v;`;
                f.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({
                    C: { Type: 'Action', S: 'JavaScript', JS: PDFString.of(conf.formula) }
                }));
            }
        });

        const finalBytes = await pdfDoc.save();
        const blob = new Blob([finalBytes], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "ficha_customizada_2026.pdf";
        a.click();
    } catch (err) {
        alert("Erro ao gerar PDF: " + err.message);
    }
});
