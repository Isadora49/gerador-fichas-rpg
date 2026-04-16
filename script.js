const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;
let placedFields = []; // Array de objetos { x, y, w, h, type, name }
let currentClickPos = { x: 0, y: 0 };

const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');
const configMenu = document.getElementById('field-config-menu');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// UPLOAD
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
        
        // Resetar tudo
        document.querySelectorAll('.marker').forEach(m => m.remove());
        placedFields = [];
        statusEl.innerText = "Clique no PDF para adicionar campos";
        btnDownload.disabled = false;
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

// CLIQUE NO CANVAS PARA ABRIR MENU
canvas.addEventListener('click', (e) => {
    const limit = parseInt(document.getElementById('limitFields').value);
    if (limit && placedFields.length >= limit) {
        alert("Limite de campos atingido!");
        return;
    }

    const rect = canvas.getBoundingClientRect();
    currentClickPos.x = e.clientX - rect.left;
    currentClickPos.y = e.clientY - rect.top;

    // Posiciona o menu onde o usuário clicou
    configMenu.style.display = 'block';
    configMenu.style.left = e.clientX + 'px';
    configMenu.style.top = e.clientY + 'px';
    document.getElementById('fieldName').value = `c${placedFields.length + 1}`;
});

// BOTOES DO MENU
document.getElementById('btnCancelField').onclick = () => configMenu.style.display = 'none';

document.getElementById('btnConfirmField').onclick = () => {
    const type = document.getElementById('fieldType').value;
    const name = document.getElementById('fieldName').value.trim();

    if (!name) { alert("Dê um nome ao campo!"); return; }

    createMarker(currentClickPos.x, currentClickPos.y, type, name);
    configMenu.style.display = 'none';
};

function createMarker(x, y, type, name) {
    const marker = document.createElement('div');
    marker.className = 'marker';
    const isMultiLine = (type === 'multiline');
    
    const w = isMultiLine ? 120 : 60;
    const h = isMultiLine ? 60 : 20;

    marker.style.width = w + 'px';
    marker.style.height = h + 'px';
    marker.style.left = (x - w / 2) + 'px';
    marker.style.top = (y - h / 2) + 'px';
    
    marker.dataset.type = type;
    marker.dataset.name = name;
    marker.innerHTML = `<span class="label-text">${name}<br>(${type})</span><button class="remove-btn">X</button>`;
    
    marker.querySelector('.remove-btn').onclick = (e) => {
        e.stopPropagation();
        marker.remove();
        placedFields = placedFields.filter(f => f.el !== marker);
    };

    wrapper.appendChild(marker);
    makeDraggable(marker);
    
    placedFields.push({ el: marker, type, name });
}

function makeDraggable(el) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };
    el.addEventListener('mousedown', (e) => {
        if (e.target.className === 'remove-btn' || (e.offsetX > el.clientWidth - 15 && e.offsetY > el.clientHeight - 15)) return;
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
    if (placedFields.length === 0) return alert("Adicione pelo menos um campo!");

    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        const cWidth = canvas.width;
        const cHeight = canvas.height;

        const triggerNames = []; // Lista de campos que disparam o script

        placedFields.forEach(fieldObj => {
            const el = fieldObj.el;
            const type = fieldObj.type;
            const name = fieldObj.name;

            let f;
            if (type === 'class_dropdown') {
                f = form.createDropdown(name);
                f.addOptions([' ', 'Tank', 'Hibrido', 'Assassino', 'Destruidor', 'Arcano', 'Mentalista', 'Vitalista', 'Invocador', 'Elementalista']);
                f.select(' ');
                triggerNames.push(name);
            } else {
                f = form.createTextField(name);
                if (type === 'multiline') f.enableMultiline();
                if (type === 'dado_auto' || type === 'resultado') f.enableReadOnly();
                if (type === 'nivel' || type === 'class_dropdown') triggerNames.push(name);
                
                f.setFontSize(12);
                f.setAlignment(type === 'multiline' ? TextAlignment.Left : TextAlignment.Center);
            }

            const elLeft = parseFloat(el.style.left);
            const elTop = parseFloat(el.style.top);
            f.addToPage(page, { 
                x: (elLeft * width) / cWidth, 
                y: height - ((elTop * height) / cHeight) - ((el.offsetHeight * height) / cHeight), 
                width: (el.offsetWidth * width) / cWidth, 
                height: (el.offsetHeight * height) / cHeight,
                borderWidth: 0 
            });
        });

        // SCRIPT MOTOR (Adaptado para ser dinâmico)
        // Nota: Para o cálculo funcionar, o usuário deve nomear os campos nível/dado/resultado seguindo uma lógica ou o script deve tentar mapear.
        // Aqui mantive a lógica que busca "c1", "c2" etc, mas agora ela é injetada.
        const scriptMotor = `
            var escolha = this.getField("c1") ? this.getField("c1").value : "";
            var bases = { "Tank": [8,2,2], "Hibrido": [4,2,4], "Assassino": [2,2,8], "Destruidor": [2,4,2], "Arcano": [2,4,2], "Mentalista": [2,4,2], "Vitalista": [2,6,2], "Invocador": [2,6,2], "Elementalista": [2,5,2] };
            var b = bases[escolha] || [0,0,0];
            function getDado(n) { n=Number(n)||0; if(n>=51) return "1d100"; if(n>=36) return "1d50"; if(n>=26) return "1d20"; if(n>=21) return "1d12"; if(n>=16) return "1d10"; if(n>=11) return "1d8"; if(n>=6) return "1d6"; return "1d4"; }
            function getD(n) { n=Number(n)||0; return (n>=51)?100:(n>=36)?50:(n>=26)?20:(n>=21)?12:(n>=16)?10:(n>=11)?8:(n>=6)?6:4; }

            // Lógica para C2 -> C3 e Resultado (res)
            if(this.getField("c2")){
                var n1 = Number(this.getField("c2").value);
                if(this.getField("c3")) this.getField("c3").value = getDado(n1);
                if(this.getField("res")) this.getField("res").value = (b[0] * n1) + getD(n1);
            }
            // Lógica para C5 -> C6 e Resultado (res2)
            if(this.getField("c5")){
                var n2 = Number(this.getField("c5").value);
                if(this.getField("c6")) this.getField("c6").value = getDado(n2);
                if(this.getField("res2")) this.getField("res2").value = (b[1] * n2) + getD(n2);
            }
        `;

        const action = pdfDoc.context.obj({ Type: 'Action', S: 'JavaScript', JS: PDFString.of(scriptMotor) });
        form.acroForm.dict.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(true));

        // Aplicar o gatilho nos campos marcados como trigger
        triggerNames.forEach(name => {
            try {
                const field = form.getField(name);
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
        alert("Erro técnico: " + err.message);
    }
});
