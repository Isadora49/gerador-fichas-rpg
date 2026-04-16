const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;
let currentEditingId = null;

// Definição rica dos campos: agora cada um é um objeto com sua "lógica" embutida
const fieldsConfig = [
    { label: "C1 (Lsta Base)", name: "c1", type: "dropdown", align: "Center" },
    { label: "C2 (Nível 1)", name: "c2", align: "Center" },
    { label: "C3 (Dado 1)", name: "c3", align: "Center", readOnly: true, def: "1d4" },
    { label: "C4 (Total 1)", name: "res", align: "Center", readOnly: true },
    { label: "C5 (Nível 2)", name: "c5", align: "Center" },
    { label: "C6 (Dado 2)", name: "res2", align: "Center", readOnly: true, def: "1d4" },
    { label: "C7 (Total 2)", name: "c7", align: "Center", readOnly: true },
    { label: "C8 (Total 3)", name: "c8", align: "Center", readOnly: true },
    { label: "C9 (Nível 3)", name: "c9", align: "Center" },
    { label: "C10 (Dado 3)", name: "c10", align: "Center", readOnly: true, def: "1d4" },
    // ... seguindo a lógica para os demais até o 36
];

// Preenchimento automático para simplificar o código do exemplo (C11 até C36)
for(let i=11; i<=36; i++) {
    fieldsConfig.push({ 
        label: `C${i}`, 
        name: `c${i}`, 
        align: "Center", 
        def: (i % 2 === 0) ? "1d4" : "0", 
        readOnly: (i % 2 === 0) 
    });
}

// Campos de texto e multilinha
fieldsConfig.push({ label: "C37 (Texto 1)", name: "c37", align: "Left" });
fieldsConfig.push({ label: "C38 (Texto 2)", name: "c38", align: "Left" });
fieldsConfig.push({ label: "C39 (Texto 3)", name: "c39", align: "Left" });
fieldsConfig.push({ label: "C40 (Texto 4)", name: "c40", align: "Left" });
fieldsConfig.push({ label: "C41 (Multi 1)", name: "c41", align: "Left", multiline: true });
fieldsConfig.push({ label: "C42 (Multi 2)", name: "c42", align: "Left", multiline: true });
fieldsConfig.push({ label: "C43 (Multi 3)", name: "c43", align: "Left", multiline: true });
fieldsConfig.push({ label: "C44 (Texto 5)", name: "c44", align: "Left" });
fieldsConfig.push({ label: "C45 (Texto 6 Central)", name: "c45", align: "Center" });
fieldsConfig.push({ label: "C46 (Texto 7 Central)", name: "c46", align: "Center" });
fieldsConfig.push({ label: "C47 (Texto 8 Central)", name: "c47", align: "Center" });

const TOTAL_FIELDS = fieldsConfig.length;
let currentStep = 0;
const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');
const menu = document.getElementById('field-menu');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// UPLOAD
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    pdfOriginalBytes = arrayBuffer.slice(0);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    
    document.querySelectorAll('.marker').forEach(m => m.remove());
    currentStep = 0;
    statusEl.innerText = "Posicione: " + fieldsConfig[0].label;
});

// CLIQUE PARA ADICIONAR
canvas.addEventListener('click', (e) => {
    if (currentStep >= TOTAL_FIELDS || !pdfOriginalBytes) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const config = fieldsConfig[currentStep];

    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = `field-${currentStep}`;
    
    // Armazena a lógica no dataset do elemento HTML
    marker.dataset.name = config.name;
    marker.dataset.align = config.align || "Center";
    marker.dataset.multiline = config.multiline ? "true" : "false";
    marker.dataset.readonly = config.readOnly ? "true" : "false";
    marker.dataset.type = config.type || "text";

    const w = config.multiline ? 120 : 60;
    const h = config.multiline ? 60 : 20;
    marker.style.width = w + 'px';
    marker.style.height = h + 'px';
    marker.style.left = (x - w/2) + 'px';
    marker.style.top = (y - h/2) + 'px';
    
    marker.innerHTML = `<span class="label-text">${config.label}</span>`;
    
    // Evento para abrir o menu (Botão direito)
    marker.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        openMenu(marker, ev.clientX, ev.clientY);
    });

    wrapper.appendChild(marker);
    makeDraggable(marker);

    currentStep++;
    statusEl.innerText = (currentStep === TOTAL_FIELDS) ? "Pronto!" : "Posicione: " + fieldsConfig[currentStep].label;
    if(currentStep === TOTAL_FIELDS) btnDownload.disabled = false;
});

// FUNÇÕES DO MENU
function openMenu(el, x, y) {
    currentEditingId = el.id;
    document.querySelectorAll('.marker').forEach(m => m.classList.remove('selected'));
    el.classList.add('selected');

    document.getElementById('edit-name').value = el.dataset.name;
    document.getElementById('edit-align').value = el.dataset.align;
    document.getElementById('edit-multiline').checked = el.dataset.multiline === "true";
    document.getElementById('edit-readonly').checked = el.dataset.readonly === "true";

    menu.style.display = 'flex';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

function saveMenu() {
    const el = document.getElementById(currentEditingId);
    el.dataset.name = document.getElementById('edit-name').value;
    el.dataset.align = document.getElementById('edit-align').value;
    el.dataset.multiline = document.getElementById('edit-multiline').checked;
    el.dataset.readonly = document.getElementById('edit-readonly').checked;
    closeMenu();
}

function closeMenu() {
    menu.style.display = 'none';
    currentEditingId = null;
}

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
    document.addEventListener('mouseup', () => isDragging = false);
}

// GERAR PDF (Lógica lida dos Marcadores)
btnDownload.addEventListener('click', async () => {
    const pdfDoc = await PDFDocument.load(pdfOriginalBytes);
    const form = pdfDoc.getForm();
    const page = pdfDoc.getPage(0);
    const { width, height } = page.getSize();

    for (let i = 0; i < TOTAL_FIELDS; i++) {
        const el = document.getElementById(`field-${i}`);
        if (!el) continue;

        const fieldName = el.dataset.name;
        let f;

        if (el.dataset.type === "dropdown") {
            f = form.createDropdown(fieldName);
            f.addOptions([' ', 'Tank', 'Hibrido', 'Assassino', 'Destruidor', 'Arcano', 'Mentalista', 'Vitalista', 'Invocador', 'Elementalista']);
        } else {
            f = form.createTextField(fieldName);
            if (el.dataset.multiline === "true") f.enableMultiline();
            if (el.dataset.readonly === "true") f.enableReadOnly();
            
            // Define valor padrão baseado na config original se não for editado
            const originalConfig = fieldsConfig[i];
            if(originalConfig.def) f.setText(originalConfig.def);
        }

        f.setAlignment(TextAlignment[el.dataset.align]);
        f.setFontSize(12);

        const elLeft = parseFloat(el.style.left);
        const elTop = parseFloat(el.style.top);
        
        f.addToPage(page, { 
            x: (elLeft * width) / canvas.width, 
            y: height - ((elTop * height) / canvas.height) - ((el.offsetHeight * height) / canvas.height), 
            width: (el.offsetWidth * width) / canvas.width, 
            height: (el.offsetHeight * height) / canvas.height,
            borderWidth: 0 
        });
    }

    // O SCRIPT MOTOR PERMANECE IGUAL (Lógica interna do Acrobat)
    const scriptMotor = `
        var escolha = this.getField("c1").value;
        var bases = {"Tank": [8,2,2], "Hibrido": [4,2,4], "Assassino": [2,2,8], "Destruidor": [2,4,2], "Arcano": [2,4,2], "Mentalista": [2,4,2], "Vitalista": [2,6,2], "Invocador": [2,6,2], "Elementalista": [2,5,2]};
        var b = bases[escolha] || [0,0,0];
        function getDado(n){ n=Number(n)||0; if(n>=51) return "1d100"; if(n>=36) return "1d50"; if(n>=26) return "1d20"; if(n>=21) return "1d12"; if(n>=16) return "1d10"; if(n>=11) return "1d8"; if(n>=6) return "1d6"; return "1d4"; }
        function getD(n){ n=Number(n)||0; return (n>=51)?100:(n>=36)?50:(n>=26)?20:(n>=21)?12:(n>=16)?10:(n>=11)?8:(n>=6)?6:4; }
        var n1 = Number(this.getField("c2").value)||0;
        this.getField("c3").value = getDado(n1);
        this.getField("res").value = (b[0]*n1)+getD(n1);
        this.getField("c8").value = (b[2]*n1)+getD(n1);
        var n2 = Number(this.getField("c5").value)||0;
        this.getField("res2").value = (b[1]*n2)+getD(n2);
    `;

    const action = pdfDoc.context.obj({ Type: 'Action', S: 'JavaScript', JS: PDFString.of(scriptMotor) });
    form.acroForm.dict.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(true));
    
    // Gatilhos simplificados
    const triggers = ['c1', 'c2', 'c5'];
    triggers.forEach(t => {
        try {
            const field = form.getField(t);
            field.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ K: action, V: action, Bl: action }));
        } catch(e) {}
    });

    const finalPdfBytes = await pdfDoc.save();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([finalPdfBytes], { type: 'application/pdf' }));
    a.download = "ficha_editavel.pdf";
    a.click();
});
