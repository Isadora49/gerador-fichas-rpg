const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;
let fieldConfigs = []; // Armazena a configuração de cada campo
let currentStep = 0;
let totalToCreate = 0;
let editingFieldId = null;

const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');
const modal = document.getElementById('config-modal');
const overlay = document.getElementById('overlay');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// INICIALIZAÇÃO
document.getElementById('btnStart').addEventListener('click', () => {
    totalToCreate = parseInt(document.getElementById('qtyFields').value) || 0;
    if (!pdfOriginalBytes) return alert("Carregue um PDF primeiro!");
    
    // Reset
    document.querySelectorAll('.marker').forEach(m => m.remove());
    fieldConfigs = [];
    currentStep = 0;
    btnDownload.disabled = true;
    statusEl.innerText = `Clique para posicionar Campo 1 de ${totalToCreate}`;
});

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
        statusEl.innerText = "PDF Carregado. Defina a quantidade e clique em Iniciar.";
    } catch (err) { alert("Erro no PDF: " + err.message); }
});

// CLIQUE NO CANVAS PARA CRIAR MARCADOR
canvas.addEventListener('click', (e) => {
    if (currentStep >= totalToCreate || !pdfOriginalBytes) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const id = currentStep;
    const config = {
        id: id,
        label: `Campo ${id + 1}`,
        type: 'text',
        align: 'center',
        options: '',
        logic: '',
        width: 60,
        height: 20
    };
    fieldConfigs.push(config);

    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = `marker-${id}`;
    marker.style.left = (x - 30) + 'px';
    marker.style.top = (y - 10) + 'px';
    marker.style.width = config.width + 'px';
    marker.style.height = config.height + 'px';
    marker.innerHTML = `<span id="label-text-${id}">${config.label}</span>`;
    
    // Abrir menu com botão direito
    marker.oncontextmenu = (ev) => {
        ev.preventDefault();
        openConfig(id);
    };

    wrapper.appendChild(marker);
    makeDraggable(marker);

    currentStep++;
    if (currentStep === totalToCreate) {
        statusEl.innerText = "Todos posicionados! Botão direito p/ editar.";
        btnDownload.disabled = false;
    } else {
        statusEl.innerText = `Posicione: Campo ${currentStep + 1}`;
    }
});

// FUNÇÕES DO MODAL
function openConfig(id) {
    editingFieldId = id;
    const cfg = fieldConfigs[id];
    document.getElementById('editLabel').value = cfg.label;
    document.getElementById('editType').value = cfg.type;
    document.getElementById('editAlign').value = cfg.align;
    document.getElementById('editOptions').value = cfg.options;
    document.getElementById('editLogic').value = cfg.logic;
    
    document.getElementById('dropdown-options').style.display = (cfg.type === 'dropdown') ? 'block' : 'none';
    modal.style.display = 'block';
    overlay.style.display = 'block';
}

document.getElementById('editType').onchange = (e) => {
    document.getElementById('dropdown-options').style.display = (e.target.value === 'dropdown') ? 'block' : 'none';
};

function saveConfig() {
    const cfg = fieldConfigs[editingFieldId];
    cfg.label = document.getElementById('editLabel').value;
    cfg.type = document.getElementById('editType').value;
    cfg.align = document.getElementById('editAlign').value;
    cfg.options = document.getElementById('editOptions').value;
    cfg.logic = document.getElementById('editLogic').value;
    
    document.getElementById(`label-text-${editingFieldId}`).innerText = cfg.label;
    closeConfig();
}

function closeConfig() {
    modal.style.display = 'none';
    overlay.style.display = 'none';
}

function makeDraggable(el) {
    let isDragging = false; let offset = { x: 0, y: 0 };
    el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Só arrasta com botão esquerdo
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

// GERAÇÃO DO PDF
btnDownload.addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        const cWidth = canvas.width;
        const cHeight = canvas.height;

        for (let cfg of fieldConfigs) {
            const el = document.getElementById(`marker-${cfg.id}`);
            const name = cfg.label.replace(/\s+/g, '_'); // Nome sem espaços
            let f;

            if (cfg.type === 'dropdown') {
                f = form.createDropdown(name);
                const opts = cfg.options.split(',').map(o => o.trim()).filter(o => o !== "");
                f.addOptions(opts.length > 0 ? opts : [' ']);
            } else {
                f = form.createTextField(name);
                if (cfg.type === 'multiline') f.enableMultiline();
            }

            // Alinhamento e Estilo
            f.setAlignment(cfg.align === 'left' ? TextAlignment.Left : TextAlignment.Center);
            f.setFontSize(11);

            // Se houver lógica, aplicamos ao cálculo do campo
            if (cfg.logic.trim() !== "") {
                const action = pdfDoc.context.obj({
                    Type: 'Action',
                    S: 'JavaScript',
                    JS: PDFString.of(cfg.logic)
                });
                // Aplica no evento de Cálculo (C) e no formato (F) para garantir atualização
                f.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ 
                    C: action
                }));
            }

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
        }

        form.acroForm.dict.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(true));
        
        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "ficha_customizada.pdf";
        a.click();
    } catch (err) { alert("Erro ao gerar PDF: " + err.message); }
});
