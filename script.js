const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;
let fieldsData = []; // Armazena a config de cada campo
let fieldCounter = 0;
let activeFieldId = null;

const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');
const btnAddField = document.getElementById('btnAddField');
const fieldLimitInput = document.getElementById('fieldLimit');

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
        
        resetEditor();
        statusEl.innerText = "PDF Carregado. Use '+ NOVO CAMPO'";
        btnAddField.disabled = false;
        btnDownload.disabled = false;
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

function resetEditor() {
    document.querySelectorAll('.marker').forEach(m => m.remove());
    fieldsData = [];
    fieldCounter = 0;
}

// ADICIONAR NOVO CAMPO
btnAddField.addEventListener('click', () => {
    const limit = parseInt(fieldLimitInput.value);
    if (fieldsData.length >= limit) {
        alert("Limite de campos atingido!");
        return;
    }
    createMarker(50, 50); // Cria no topo esquerdo por padrão
});

function createMarker(x, y) {
    const id = `field-${fieldCounter++}`;
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = id;
    marker.style.left = x + 'px';
    marker.style.top = y + 'px';
    marker.style.width = '80px';
    marker.style.height = '25px';
    marker.innerHTML = `<span class="label-text">Campo ${fieldCounter}</span>`;
    
    // Config inicial do campo
    fieldsData.push({
        id: id,
        label: `Campo ${fieldCounter}`,
        type: 'text',
        pdfFieldName: `c${fieldCounter}`
    });

    marker.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        openMenu(id);
    });

    makeDraggable(marker);
    wrapper.appendChild(marker);
}

// DRAG AND DROP
function makeDraggable(el) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    el.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
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

// LÓGICA DO MENU DE EDIÇÃO
function openMenu(id) {
    activeFieldId = id;
    const data = fieldsData.find(f => f.id === id);
    const menu = document.getElementById('field-menu');
    
    document.getElementById('edit-label').value = data.label;
    document.getElementById('edit-type').value = data.type;
    
    menu.style.display = 'block';
    menu.style.left = '20px';
    menu.style.top = '100px';
}

function closeMenu() {
    const menu = document.getElementById('field-menu');
    const data = fieldsData.find(f => f.id === activeFieldId);
    const el = document.getElementById(activeFieldId);
    
    data.label = document.getElementById('edit-label').value;
    data.type = document.getElementById('edit-type').value;
    el.querySelector('.label-text').innerText = data.label;
    
    menu.style.display = 'none';
}

function deleteField() {
    fieldsData = fieldsData.filter(f => f.id !== activeFieldId);
    document.getElementById(activeFieldId).remove();
    document.getElementById('field-menu').style.display = 'none';
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

        // Mapeamento para o Script Automático
        let classField = "";
        let levelFields = [];

        fieldsData.forEach((field, index) => {
            const el = document.getElementById(field.id);
            const elLeft = parseFloat(el.style.left);
            const elTop = parseFloat(el.style.top);
            const elW = el.offsetWidth;
            const elH = el.offsetHeight;

            let f;
            const name = field.pdfFieldName;

            if (field.type === 'class-select') {
                f = form.createDropdown(name);
                f.addOptions([' ', 'Tank', 'Hibrido', 'Assassino', 'Destruidor', 'Arcano', 'Mentalista', 'Vitalista', 'Invocador', 'Elementalista']);
                classField = name;
            } else {
                f = form.createTextField(name);
                if (field.type === 'multiline') f.enableMultiline();
                if (field.type === 'dice' || field.type === 'total') f.enableReadOnly();
                if (field.type === 'level') levelFields.push(name);
            }

            f.setFontSize(10);
            f.addToPage(page, { 
                x: (elLeft * width) / cWidth, 
                y: height - ((elTop * height) / cHeight) - ((elH * height) / cHeight), 
                width: (elW * width) / cWidth, 
                height: (elH * height) / cHeight 
            });
        });

        // Montagem do Script Automático baseado nos tipos escolhidos
        const scriptMotor = `
            var escolha = this.getField("${classField || 'c1'}").value;
            var bases = { "Tank": [8,2,2], "Hibrido": [4,2,4], "Assassino": [2,2,8], "Destruidor": [2,4,2], "Arcano": [2,4,2], "Mentalista": [2,4,2], "Vitalista": [2,6,2], "Invocador": [2,6,2], "Elementalista": [2,5,2] };
            var b = bases[escolha] || [0,0,0];
            
            function getDado(n) { 
                n = Number(n)||0; 
                if(n>=51) return "1d100"; if(n>=36) return "1d50"; if(n>=26) return "1d20"; 
                if(n>=21) return "1d12"; if(n>=16) return "1d10"; if(n>=11) return "1d8"; 
                if(n>=6) return "1d6"; return "1d4"; 
            }
            function getD(n) { n = Number(n)||0; return (n>=51)?100:(n>=36)?50:(n>=26)?20:(n>=21)?12:(n>=16)?10:(n>=11)?8:(n>=6)?6:4; }

            ${fieldsData.map(f => {
                if(f.type === 'dice') return `this.getField("${f.pdfFieldName}").value = getDado(this.getField("${classField}").value);`;
                return "";
            }).join('\n')}
        `;

        const action = pdfDoc.context.obj({ Type: 'Action', S: 'JavaScript', JS: PDFString.of(scriptMotor) });
        form.acroForm.dict.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(true));

        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "ficha_configuravel.pdf";
        a.click();
    } catch (err) {
        alert("Erro ao gerar: " + err.message);
    }
});
