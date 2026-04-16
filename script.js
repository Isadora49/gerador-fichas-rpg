const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;
let currentFieldEditing = null;

// Configuração inicial dos campos (podem ser alterados no menu)
let fieldsData = [
    { label: "C1 (Lista Base)", name: "c1", type: "dropdown" },
    { label: "C2 (Nível 1)", name: "c2", type: "text" },
    { label: "C3 (Dado 1)", name: "c3", type: "text", readonly: true },
    { label: "C4 (Total 1)", name: "res", type: "text", readonly: true },
    { label: "C5 (Nível 2)", name: "c5", type: "text" },
    { label: "C6 (Dado 2)", name: "c6", type: "text", readonly: true },
    { label: "C7 (Total 2)", name: "res2", type: "text", readonly: true },
    { label: "C8 (Total 3)", name: "c8", type: "text", readonly: true }
    // Adicione mais conforme a necessidade ou eles serão criados dinamicamente
];

let currentStep = 0;
const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');
const editMenu = document.getElementById('edit-menu');

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
        
        document.querySelectorAll('.marker').forEach(m => m.remove());
        currentStep = 0;
        updateStatus();
        btnDownload.disabled = true;
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

function updateStatus() {
    if (currentStep < 47) {
        statusEl.innerText = `Posicione o campo: ${fieldsData[currentStep]?.label || 'C'+(currentStep+1)}`;
    } else {
        statusEl.innerText = "Configuração concluída!";
        btnDownload.disabled = false;
    }
}

// CLICK NO CANVAS PARA CRIAR CAMPO
canvas.addEventListener('click', (e) => {
    if (pdfOriginalBytes && currentStep < 47) {
        const rect = canvas.getBoundingClientRect();
        createMarker(e.clientX - rect.left, e.clientY - rect.top, currentStep);
        currentStep++;
        updateStatus();
    }
});

function createMarker(x, y, index) {
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = `marker-${index}`;
    
    // Dados padrão se não existirem no array fieldsData
    const data = fieldsData[index] || { label: `C${index+1}`, name: `c${index+1}`, align: 'Center' };
    if(!fieldsData[index]) fieldsData[index] = data;

    marker.style.width = '70px';
    marker.style.height = '25px';
    marker.style.left = (x - 35) + 'px';
    marker.style.top = (y - 12) + 'px';
    marker.innerHTML = `<span class="label-text">${data.label}</span>`;
    
    // Menu com botão direito
    marker.oncontextmenu = (e) => {
        e.preventDefault();
        openEditMenu(index, e.clientX, e.clientY);
    };

    wrapper.appendChild(marker);
    makeDraggable(marker);
}

function makeDraggable(el) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };
    el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; 
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

// LOGICA DO MENU DE EDIÇÃO
function openEditMenu(index, x, y) {
    currentFieldEditing = index;
    const data = fieldsData[index];
    document.getElementById('menu-label').value = data.label;
    document.getElementById('menu-id').value = data.name;
    document.getElementById('menu-align').value = data.align || 'Center';
    
    editMenu.style.display = 'flex';
    editMenu.style.left = x + 'px';
    editMenu.style.top = y + 'px';
}

function saveFieldChanges() {
    const data = fieldsData[currentFieldEditing];
    data.label = document.getElementById('menu-label').value;
    data.name = document.getElementById('menu-id').value;
    data.align = document.getElementById('menu-align').value;

    const marker = document.getElementById(`marker-${currentFieldEditing}`);
    marker.querySelector('.label-text').innerText = data.label;
    closeMenu();
}

function closeMenu() { editMenu.style.display = 'none'; }

// DOWNLOAD E GERAÇÃO
btnDownload.addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes);
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();

        fieldsData.forEach((field, i) => {
            const el = document.getElementById(`marker-${i}`);
            if (!el) return;

            let f;
            if (field.type === 'dropdown') {
                f = form.createDropdown(field.name);
                f.addOptions([' ', 'Tank', 'Hibrido', 'Assassino', 'Destruidor', 'Arcano', 'Mentalista', 'Vitalista', 'Invocador', 'Elementalista']);
            } else {
                f = form.createTextField(field.name);
                if (field.readonly) f.enableReadOnly();
            }

            // Estilização
            f.setFontSize(11);
            const alignmentMap = { 'Left': TextAlignment.Left, 'Center': TextAlignment.Center, 'Right': TextAlignment.Right };
            f.setAlignment(alignmentMap[field.align || 'Center']);

            // Coordenadas
            const rect = canvas.getBoundingClientRect();
            const elLeft = parseFloat(el.style.left);
            const elTop = parseFloat(el.style.top);
            
            f.addToPage(page, {
                x: (elLeft * width) / canvas.width,
                y: height - ((elTop * height) / canvas.height) - ((el.offsetHeight * height) / canvas.height),
                width: (el.offsetWidth * width) / canvas.width,
                height: (el.offsetHeight * height) / canvas.height,
                borderWidth: 0
            });
        });

        // Script de Cálculo (Motor fixo que lê os IDs definidos)
        const motorJS = `
            var escolha = this.getField("c1").value;
            var bases = {"Tank":[8,2,2],"Hibrido":[4,2,4],"Assassino":[2,2,8],"Destruidor":[2,4,2],"Arcano":[2,4,2],"Mentalista":[2,4,2],"Vitalista":[2,6,2],"Invocador":[2,6,2],"Elementalista":[2,5,2]};
            var b = bases[escolha] || [0,0,0];
            
            function gd(n){ 
                n = Number(n)||0;
                return (n>=51)?"1d100":(n>=36)?"1d50":(n>=26)?"1d20":(n>=21)?"1d12":(n>=16)?"1d10":(n>=11)?"1d8":(n>=6)?"1d6":"1d4";
            }
            function gv(n){
                n = Number(n)||0;
                return (n>=51)?100:(n>=36)?50:(n>=26)?20:(n>=21)?12:(n>=16)?10:(n>=11)?8:(n>=6)?6:4;
            }

            var n1 = Number(this.getField("c2").value);
            this.getField("c3").value = gd(n1);
            this.getField("res").value = (b[0]*n1) + gv(n1);
            
            var n2 = Number(this.getField("c5").value);
            this.getField("c6").value = gd(n2);
            this.getField("res2").value = (b[1]*n2) + gv(n2);
            
            this.getField("c8").value = (b[2]*n1) + gv(n1);
        `;

        const action = pdfDoc.context.obj({ Type: 'Action', S: 'JavaScript', JS: PDFString.of(motorJS) });
        form.acroForm.dict.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(true));
        
        // Aplica o trigger nos campos de entrada
        ['c1','c2','c5'].forEach(id => {
            try {
                const field = form.getField(id);
                field.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ K: action, V: action, Bl: action }));
            } catch(e){}
        });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "ficha_editavel_v3.pdf";
        link.click();
    } catch (err) {
        alert("Erro na geração: " + err.message);
    }
});
