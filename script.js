const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;

// Lista de rótulos base
const labels = [
    "C1 (Lsta Base)", "C2 (Nível 1)", "C3 (Dado 1)", "C4 (Total 1)", 
    "C5 (Nível 2)", "C6 (Dado 2)", "C7 (Total 2)", "C8 (Total 3)",
    "C9 (Nível 3)", "C10 (Dado 3)", "C11 (Nível 4)", "C12 (Dado 4)",
    "C13 (Nível 5)", "C14 (Dado 5)", "C15 (Nível 6)", "C16 (Dado 6)",
    "C17 (Nível 7)", "C18 (Dado 7)", "C19 (Nível 8)", "C20 (Dado 8)",
    "C21 (Nível 9)", "C22 (Dado 9)", "C23 (Nível 10)", "C24 (Dado 10)",
    "C25 (Nível 11)", "C26 (Dado 11)", "C27 (Nível 12)", "C28 (Dado 12)",
    "C29 (Nível 13)", "C30 (Dado 13)", "C31 (Nível 14)", "C32 (Dado 14)",
    "C33 (Nível 15)", "C34 (Dado 15)", "C35 (Nível 16)", "C36 (Dado 16)",
    "C37 (Texto 1)", "C38 (Texto 2)", "C39 (Texto 3)", "C40 (Texto 4)",
    "C41 (Multi-linha 1)", "C42 (Multi-linha 2)", "C43 (Multi-linha 3)",
    "C44 (Texto 5)", 
    "C45 (Texto 6 Central)", "C46 (Texto 7 Central)", "C47 (Texto 8 Central)"
];

const TOTAL_FIELDS = labels.length;
let currentStep = 0;

// Transformando suas regras antigas em um Array Dinâmico de Configurações Editáveis
let fieldsConfig = labels.map((label, i) => {
    // Replica a sua lógica de nomes exata
    let name = (i === 3) ? 'res' : (i === 6) ? 'res2' : (i === 7) ? 'c8' : `c${i+1}`;
    let isDado = [2, 5, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35].includes(i);
    let isRes = [3, 6, 7].includes(i);
    let isMulti = (i >= 40 && i <= 42);
    let isEsquerda = [36, 37, 40, 41, 42, 43].includes(i);

    return {
        id: i,
        label: label,
        pdfName: name,
        type: (i === 0) ? 'dropdown' : 'text',
        options: (i === 0) ? ' ,Tank,Hibrido,Assassino,Destruidor,Arcano,Mentalista,Vitalista,Invocador,Elementalista' : '',
        value: isDado ? "1d4" : (i < 36 ? "0" : ""),
        multiline: isMulti,
        readonly: (isDado || isRes),
        align: isEsquerda ? 'left' : 'center',
        customScript: '' // Logica individual se quiser sobrescrever ou adicionar
    };
});

const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');

// Elementos do Painel
const panel = document.getElementById('properties-panel');
const propType = document.getElementById('prop-type');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Mostrar/esconder opções de dropdown
propType.addEventListener('change', (e) => {
    document.getElementById('group-options').style.display = e.target.value === 'dropdown' ? 'flex' : 'none';
});

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
        statusEl.innerText = "Clique para posicionar: " + fieldsConfig[0].label;
        btnDownload.disabled = true;
        panel.style.display = 'none';
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

// CRIAÇÃO DO MARCADOR
canvas.addEventListener('click', (e) => {
    if (currentStep >= TOTAL_FIELDS || !pdfOriginalBytes) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const conf = fieldsConfig[currentStep];

    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = `field-${currentStep}`;
    marker.dataset.index = currentStep;
    
    const defaultW = conf.multiline ? 120 : 60;
    const defaultH = conf.multiline ? 60 : 20;

    marker.style.width = defaultW + 'px';
    marker.style.height = defaultH + 'px';
    marker.style.left = (x - defaultW / 2) + 'px';
    marker.style.top = (y - defaultH / 2) + 'px';
    
    marker.innerHTML = `
        <span class="label-text">${conf.label}</span>
        <div class="settings-btn" title="Editar Propriedades">⚙️</div>
    `;
    wrapper.appendChild(marker);

    makeDraggable(marker);

    // Evento para abrir menu de edição
    marker.querySelector('.settings-btn').addEventListener('click', (ev) => {
        ev.stopPropagation(); // Evita criar outro marcador sem querer
        abrirPainel(parseInt(marker.dataset.index));
    });

    currentStep++;
    if (currentStep === TOTAL_FIELDS) {
        statusEl.innerText = "Todos os campos posicionados! Você pode editá-los clicando na engrenagem ⚙️.";
        btnDownload.disabled = false;
    } else {
        statusEl.innerText = "Posicione: " + fieldsConfig[currentStep].label;
    }
});

function makeDraggable(el) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    el.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('settings-btn')) return; // Não arrasta se clicou na engrenagem
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

// LOGICA DO PAINEL DE EDIÇÃO
function abrirPainel(index) {
    const conf = fieldsConfig[index];
    document.getElementById('prop-id').value = index;
    document.getElementById('panel-title').innerText = `Editando: ${conf.label}`;
    
    document.getElementById('prop-label').value = conf.label;
    document.getElementById('prop-pdfName').value = conf.pdfName;
    document.getElementById('prop-type').value = conf.type;
    document.getElementById('prop-options').value = conf.options;
    document.getElementById('prop-value').value = conf.value;
    document.getElementById('prop-multiline').checked = conf.multiline;
    document.getElementById('prop-readonly').checked = conf.readonly;
    document.getElementById('prop-align').value = conf.align;
    document.getElementById('prop-script').value = conf.customScript;

    document.getElementById('group-options').style.display = conf.type === 'dropdown' ? 'flex' : 'none';
    panel.style.display = 'flex';
}

document.getElementById('btnClosePanel').addEventListener('click', () => { panel.style.display = 'none'; });

document.getElementById('btnSaveConfig').addEventListener('click', () => {
    const index = parseInt(document.getElementById('prop-id').value);
    fieldsConfig[index].label = document.getElementById('prop-label').value;
    fieldsConfig[index].pdfName = document.getElementById('prop-pdfName').value;
    fieldsConfig[index].type = document.getElementById('prop-type').value;
    fieldsConfig[index].options = document.getElementById('prop-options').value;
    fieldsConfig[index].value = document.getElementById('prop-value').value;
    fieldsConfig[index].multiline = document.getElementById('prop-multiline').checked;
    fieldsConfig[index].readonly = document.getElementById('prop-readonly').checked;
    fieldsConfig[index].align = document.getElementById('prop-align').value;
    fieldsConfig[index].customScript = document.getElementById('prop-script').value;

    // Atualiza rotulo visual
    const marker = document.getElementById(`field-${index}`);
    if (marker) marker.querySelector('.label-text').innerText = fieldsConfig[index].label;

    panel.style.display = 'none';
});

// GERAÇÃO DO PDF FINAL
btnDownload.addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        
        const cWidth = canvas.width;
        const cHeight = canvas.height;

        let calcOrderFields = []; // Para armazenar cálculos customizados

        for (let i = 0; i < TOTAL_FIELDS; i++) {
            const conf = fieldsConfig[i];
            const el = document.getElementById(`field-${i}`);
            if (!el) continue;

            let f;
            if (conf.type === 'dropdown') {
                f = form.createDropdown(conf.pdfName);
                const opts = conf.options.split(',').map(s => s.trim());
                f.addOptions(opts);
                if (conf.value && opts.includes(conf.value)) f.select(conf.value);
            } else {
                f = form.createTextField(conf.pdfName);
                if (conf.value) f.setText(conf.value);
                if (conf.multiline) f.enableMultiline();
            }

            if (conf.readonly) f.enableReadOnly();

            f.acroField.dict.set(PDFName.of('DA'), PDFString.of('/Helvetica 12 Tf 0 g'));
            f.setFontSize(12);
            
            if (conf.align === 'left') f.setAlignment(TextAlignment.Left);
            else if (conf.align === 'right') f.setAlignment(TextAlignment.Right);
            else f.setAlignment(TextAlignment.Center);

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

            // Se o usuário inseriu uma lógica pelo painel, aplica direto neste campo
            if (conf.customScript && conf.customScript.trim() !== "") {
                const actionField = pdfDoc.context.obj({ Type: 'Action', S: 'JavaScript', JS: PDFString.of(conf.customScript) });
                f.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ C: actionField }));
                calcOrderFields.push(f.ref);
            }
        }

        // MOTOR GLOBAL DE RPG (Preservado para não quebrar sua ficha existente)
        const scriptMotor = [
            'var escolha = this.getField("c1").value;',
            'var bases = {',
            '  "Tank": [8,2,2], "Hibrido": [4,2,4], "Assassino": [2,2,8],',
            '  "Destruidor": [2,4,2], "Arcano": [2,4,2], "Mentalista": [2,4,2],',
            '  "Vitalista": [2,6,2], "Invocador": [2,6,2], "Elementalista": [2,5,2]',
            '};',
            'var b = bases[escolha] || [0,0,0];',
            'var valBase1 = b[0], valBase2 = b[1], valBase3 = b[2];',
            '',
            'function getDado(nivel) {',
            '  nivel = Number(
