const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;

// RÓTULOS ORIGINAIS
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
    "C41 (Multi-linha 1)", "C42 (Multi-linha 2)", "C43 (Multi-linha 3)",
    "C44 (Texto 5)", "C45 (Texto 6 Central)", "C46 (Texto 7 Central)", "C47 (Texto 8 Central)"
];

// --- NOVO: GERANDO AS CONFIGURAÇÕES INICIAIS BASEADO NAS SUAS REGRAS ORIGINAIS ---
let fieldsConfig = labels.map((label, index) => {
    const isDropdown = (index === 0);
    const isMultiLine = (index >= 40 && index <= 42);
    const indicesEsquerda = [36, 37, 40, 41, 42, 43];
    const dadosIndices = [2, 5, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35];
    const resultadosIndices = [3, 6, 7];

    let defaultName = (index === 3) ? 'res' : (index === 6) ? 'res2' : `c${index+1}`;
    let defaultVal = dadosIndices.includes(index) ? "1d4" : (index < 36 && !dadosIndices.includes(index) && !resultadosIndices.includes(index) && index !== 0 ? "0" : "");

    return {
        id: index,
        label: label,
        pdfName: defaultName,
        type: isDropdown ? 'dropdown' : 'text',
        readOnly: dadosIndices.includes(index) || resultadosIndices.includes(index),
        multiline: isMultiLine,
        alignment: indicesEsquerda.includes(index) ? 'left' : 'center',
        defaultValue: defaultVal
    };
});

const TOTAL_FIELDS = fieldsConfig.length;
let currentStep = 0;
const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');

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
        statusEl.innerText = `Clique para posicionar: ${fieldsConfig[0].label} (Duplo clique no marcador para editar)`;
        btnDownload.disabled = true;
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

    const config = fieldsConfig[currentStep];
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = `field-${currentStep}`;
    
    const defaultW = config.multiline ? 120 : 60;
    const defaultH = config.multiline ? 60 : 20;

    marker.style.width = defaultW + 'px';
    marker.style.height = defaultH + 'px';
    marker.style.left = (x - defaultW / 2) + 'px';
    marker.style.top = (y - defaultH / 2) + 'px';
    
    marker.innerHTML = `<span class="label-text">${config.label}</span>`;
    wrapper.appendChild(marker);

    makeDraggable(marker);

    // NOVO: Adiciona o evento de duplo clique para abrir a edição
    let fieldIndex = currentStep;
    marker.addEventListener('dblclick', () => openModal(fieldIndex));

    currentStep++;
    if (currentStep === TOTAL_FIELDS) {
        statusEl.innerText = "Todos os campos posicionados! (Duplo clique nos campos para editar funções)";
        btnDownload.disabled = false;
    } else {
        statusEl.innerText = `Posicione: ${fieldsConfig[currentStep].label}`;
    }
});

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

// --- NOVO: LÓGICA DO MODAL DE EDIÇÃO ---
let currentEditingIndex = null;

function openModal(index) {
    currentEditingIndex = index;
    const conf = fieldsConfig[index];
    document.getElementById('m-label').value = conf.label;
    document.getElementById('m-name').value = conf.pdfName;
    document.getElementById('m-type').value = conf.type;
    document.getElementById('m-default').value = conf.defaultValue;
    document.getElementById('m-align').value = conf.alignment;
    document.getElementById('m-multi').checked = conf.multiline;
    document.getElementById('m-readonly').checked = conf.readOnly;
    
    document.getElementById('modal-overlay').style.display = 'flex';
}

document.getElementById('m-cancel').addEventListener('click', () => {
    document.getElementById('modal-overlay').style.display = 'none';
});

document.getElementById('m-save').addEventListener('click', () => {
    if (currentEditingIndex === null) return;
    const conf = fieldsConfig[currentEditingIndex];
    
    // Atualiza as configurações
    conf.label = document.getElementById('m-label').value;
    conf.pdfName = document.getElementById('m-name').value;
    conf.type = document.getElementById('m-type').value;
    conf.defaultValue = document.getElementById('m-default').value;
    conf.alignment = document.getElementById('m-align').value;
    conf.multiline = document.getElementById('m-multi').checked;
    conf.readOnly = document.getElementById('m-readonly').checked;

    // Atualiza o texto na interface
    const marker = document.getElementById(`field-${currentEditingIndex}`);
    if (marker) {
        marker.querySelector('.label-text').innerText = conf.label;
    }

    document.getElementById('modal-overlay').style.display = 'none';
});

// GERAÇÃO DO PDF FINAL
btnDownload.addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        
        const opcoesClasses = [' ', 'Tank', 'Hibrido', 'Assassino', 'Destruidor', 'Arcano', 'Mentalista', 'Vitalista', 'Invocador', 'Elementalista'];
        const cWidth = canvas.width;
        const cHeight = canvas.height;

        for (let i = 0; i < TOTAL_FIELDS; i++) {
            const el = document.getElementById(`field-${i}`);
            if (!el) continue;

            const config = fieldsConfig[i];
            let f;

            // NOVO: Lê diretamente da configuração editável em vez de hardcoded!
            if (config.type === 'dropdown') {
                f = form.createDropdown(config.pdfName);
                f.addOptions(opcoesClasses);
                f.select(' ');
            } else {
                f = form.createTextField(config.pdfName);
                if (config.defaultValue) f.setText(config.defaultValue);
                if (config.multiline) f.enableMultiline();
                if (config.readOnly) f.enableReadOnly();

                f.acroField.dict.set(PDFName.of('DA'), PDFString.of('/Helvetica 12 Tf 0 g'));
                f.setFontSize(12);
                f.setAlignment(config.alignment === 'left' ? TextAlignment.Left : TextAlignment.Center);
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

        // MOTOR DE SCRIPT RPG MANTIDO INTACTO
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
            '  nivel = Number(nivel) || 0;',
            '  if (nivel >= 51) return "1d100"; if (nivel >= 36) return "1d50";',
            '  if (nivel >= 26) return "1d20"; if (nivel >= 21) return "1d12";',
            '  if (nivel >= 16) return "1d10"; if (nivel >= 11) return "1d8";',
            '  if (nivel >= 6) return "1d6"; return "1d4";',
            '}',
            '',
            'function getD(nivel) {',
            '  return (nivel >= 51)?100:(nivel >= 36)?50:(nivel >= 26)?20:(nivel >= 21)?12:(nivel >= 16)?10:(nivel >= 11)?8:(nivel >= 6)?6:4;',
            '}',
            '',
            'var n1 = Number(this.getField("c2").value) || 0;',
            'this.getField("c3").value = getDado(n1);',
            'this.getField("res").value = (valBase1 * n1) + getD(n1);',
            'this.getField("c8").value = (valBase3 * n1) + getD(n1);',
            '',
            'var n2 = Number(this.getField("c5").value) || 0;',
            'this.getField("c6").value = getDado(n2);',
            'this.getField("res2").value = (valBase2 * n2) + getD(n2);',
            '',
            'for (var i = 9; i <= 35; i += 2) {',
            '  var nivelField = this.getField("c" + i);',
            '  var dadoField = this.getField("c" + (i + 1));',
            '  if (nivelField && dadoField) { dadoField.value = getDado(nivelField.value); }',
            '}'
        ].join('\n');

        const action = pdfDoc.context.obj({
            Type: 'Action',
            S: 'JavaScript',
            JS: PDFString.of(scriptMotor)
        });

        form.acroForm.dict.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(true));

        try {
            const resField = form.getField('res');
            resField.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ C: action }));
            form.acroForm.dict.set(PDFName.of('CO'), pdfDoc.context.obj([ resField.ref ]));
        } catch (e) { console.warn(e); }

        const triggerNames = ['c1', 'c2', 'c5', 'c9', 'c11', 'c13', 'c15', 'c17', 'c19', 'c21', 'c23', 'c25', 'c27', 'c29', 'c31', 'c33', 'c35'];
        triggerNames.forEach(name => {
            try {
                const field = form.getField(name);
                field.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ K: action, V: action }));
                const widgets = field.acroField.getWidgets();
                if (widgets && widgets.length > 0) {
                    const widget = widgets[0];
                    let widgetAA = widget.dict.get(PDFName.of('AA'));
                    if (!widgetAA) {
                        widgetAA = pdfDoc.context.obj({});
                        widget.dict.set(PDFName.of('AA'), widgetAA);
                    }
                    widgetAA.set(PDFName.of('Bl'), action);
                }
            } catch(e) { console.warn(name); }
        });

        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "ficha_protegida.pdf";
        a.click();
    } catch (err) {
        console.error(err);
        alert("Erro técnico: " + err.message);
    }
});
