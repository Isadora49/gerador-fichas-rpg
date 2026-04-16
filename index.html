const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;
let currentStep = 0;
let totalFieldsToCreate = 0;
let selectedMarker = null; // Marcador sendo editado no momento

// Armazena as configurações de cada campo
// Estrutura: { id: { name, label, type, align, logic, x, y, w, h } }
const fieldsData = {};

const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');
const fieldMenu = document.getElementById('field-menu');
const overlay = document.getElementById('overlay');

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
        
        // Reset
        document.querySelectorAll('.marker').forEach(m => m.remove());
        currentStep = 0;
        totalFieldsToCreate = parseInt(document.getElementById('totalFieldsInput').value) || 10;
        statusEl.innerText = `Clique no PDF para posicionar o campo 1 de ${totalFieldsToCreate}`;
        btnDownload.disabled = true;
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

// CLIQUE PARA ADICIONAR CAMPO
canvas.addEventListener('click', (e) => {
    if (!pdfOriginalBytes || currentStep >= totalFieldsToCreate) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const id = `field-${currentStep}`;
    createMarker(id, x, y);

    currentStep++;
    updateStatus();
});

function createMarker(id, x, y) {
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = id;
    
    // Configuração padrão inicial
    fieldsData[id] = {
        name: `campo_${id.split('-')[1]}`,
        label: `Campo ${parseInt(id.split('-')[1]) + 1}`,
        type: 'text',
        align: 'center',
        logic: '',
        initialValue: '0'
    };

    marker.style.width = '60px';
    marker.style.height = '20px';
    marker.style.left = (x - 30) + 'px';
    marker.style.top = (y - 10) + 'px';
    marker.innerHTML = `<span class="label-text">${fieldsData[id].label}</span>`;
    
    // Abrir menu com clique duplo
    marker.ondblclick = (e) => {
        e.stopPropagation();
        openMenu(id);
    };

    wrapper.appendChild(marker);
    makeDraggable(marker);
}

function updateStatus() {
    if (currentStep >= totalFieldsToCreate) {
        statusEl.innerText = "Todos posicionados! (Dê clique duplo num campo para editar lógica)";
        btnDownload.disabled = false;
    } else {
        statusEl.innerText = `Posicione o campo ${currentStep + 1} de ${totalFieldsToCreate}`;
    }
}

// LOGICA DO MENU (MODAL)
function openMenu(id) {
    selectedMarker = id;
    const data = fieldsData[id];
    document.getElementById('cfg-name').value = data.name;
    document.getElementById('cfg-label').value = data.label;
    document.getElementById('cfg-type').value = data.type;
    document.getElementById('cfg-align').value = data.align;
    document.getElementById('cfg-logic').value = data.logic;
    
    fieldMenu.style.display = 'flex';
    overlay.style.display = 'block';
}

function closeMenu() {
    fieldMenu.style.display = 'none';
    overlay.style.display = 'none';
}

function saveFieldConfig() {
    if (!selectedMarker) return;
    const data = fieldsData[selectedMarker];
    data.name = document.getElementById('cfg-name').value;
    data.label = document.getElementById('cfg-label').value;
    data.type = document.getElementById('cfg-type').value;
    data.align = document.getElementById('cfg-align').value;
    data.logic = document.getElementById('cfg-logic').value;

    // Atualiza o texto visual no marcador
    document.getElementById(selectedMarker).querySelector('.label-text').innerText = data.label;
    
    closeMenu();
}

// DRAG AND DROP
function makeDraggable(el) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    el.addEventListener('mousedown', (e) => {
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

        // Itera sobre todos os marcadores criados
        for (const id in fieldsData) {
            const config = fieldsData[id];
            const el = document.getElementById(id);
            if (!el) continue;

            let f;
            if (config.type === 'dropdown') {
                f = form.createDropdown(config.name);
                f.addOptions([' ', 'Opção 1', 'Opção 2']); // Exemplo, poderia ser dinâmico também
            } else {
                f = form.createTextField(config.name);
                if (config.type === 'multiline') f.enableMultiline();
                if (config.type === 'readonly') f.enableReadOnly();
            }

            // Alinhamento
            const alignMap = { 'left': TextAlignment.Left, 'center': TextAlignment.Center, 'right': TextAlignment.Right };
            f.setAlignment(alignMap[config.align] || TextAlignment.Center);
            f.setFontSize(12);

            // Coordenadas
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

            // Lógica de Script (Calculada)
            if (config.logic.trim() !== "") {
                const fieldAction = pdfDoc.context.obj({
                    Type: 'Action',
                    S: 'JavaScript',
                    JS: PDFString.of(config.logic)
                });
                // Aplica a lógica no evento de Cálculo e de Validação para garantir funcionamento
                f.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ 
                    C: fieldAction, // OnCalculate
                    K: fieldAction  // OnKeystroke
                }));
            }
        }

        form.acroForm.dict.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(true));

        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "ficha_editavel_dinamica.pdf";
        a.click();
    } catch (err) {
        console.error(err);
        alert("Erro técnico: " + err.message);
    }
});
