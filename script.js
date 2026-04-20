const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;
const baseLabels = [
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

let currentStep = 0;
const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');
const btnFinish = document.getElementById('btnFinish');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// FUNÇÕES DO MENU
document.getElementById('btnMenu').addEventListener('click', () => {
    const panel = document.getElementById('config-panel');
    panel.style.display = panel.style.display === 'none' || panel.style.display === '' ? 'block' : 'none';
});

function parseIndices(inputId) {
    const val = document.getElementById(inputId).value;
    if (!val) return [];
    return val.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
}

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
        statusEl.innerText = "Clique para posicionar: " + baseLabels[0];
        btnDownload.disabled = true;
        btnFinish.style.display = 'none';
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

// CRIAÇÃO DO MARCADOR NO CLIQUE
canvas.addEventListener('click', (e) => {
    if (!pdfOriginalBytes) return;
    
    let limit = parseInt(document.getElementById('confLimit').value) || 0;
    if (limit > 0 && currentStep >= limit) return; // Se tem limite e alcançou, bloqueia clique.

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = `field-${currentStep}`;
    
    const multiIndices = parseIndices('confMulti');
    const isMultiLine = multiIndices.includes(currentStep);
    const defaultW = isMultiLine ? 120 : 60;
    const defaultH = isMultiLine ? 60 : 20;

    marker.style.width = defaultW + 'px';
    marker.style.height = defaultH + 'px';
    marker.style.left = (x - defaultW / 2) + 'px';
    marker.style.top = (y - defaultH / 2) + 'px';
    
    // Define o nome da etiqueta (usa a base ou gera "Campo Extra")
    let labelName = currentStep < baseLabels.length ? baseLabels[currentStep] : `Campo Extra ${currentStep + 1}`;
    marker.innerHTML = `<span class="label-text">${labelName}</span>`;
    wrapper.appendChild(marker);

    makeDraggable(marker);
    currentStep++;

    // Lógica para liberar o botão de download
    if (limit > 0 && currentStep === limit) {
        statusEl.innerText = "Todos os campos posicionados!";
        btnDownload.disabled = false;
        btnFinish.style.display = 'none';
    } else {
        let nextLabel = currentStep < baseLabels.length ? baseLabels[currentStep] : `Campo Extra ${currentStep + 1}`;
        statusEl.innerText = "Posicione: " + nextLabel;
        
        // Se for infinito, mostra botão de finalizar
        if (limit === 0) {
            btnFinish.style.display = 'block';
        }
    }
});

// BOTÃO FINALIZAR PARA MODO INFINITO
btnFinish.addEventListener('click', () => {
    statusEl.innerText = "Marcações finalizadas!";
    btnDownload.disabled = false;
    btnFinish.style.display = 'none';
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

// GERAÇÃO DO PDF FINAL E INJEÇÃO DO CÓDIGO
btnDownload.addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        
        // Lendo as configurações do Menu de Lógica
        const indicesEsquerda = parseIndices('confLeft');
        const readOnlyIndices = parseIndices('confReadOnly');
        const multiIndices = parseIndices('confMulti');
        const dropdownIdx = parseIndices('confDropdown')[0] || 0;
        const triggerIndices = parseIndices('confTriggers');
        const multStep = parseInt(document.getElementById('confMultStep').value) || 999;
        
        // Parse de Nomes Especiais
        const nomesEspeciaisList = document.getElementById('confNames').value.split(',');
        const nomesEspeciaisObj = {};
        nomesEspeciaisList.forEach(item => {
            const parts = item.split(':');
            if (parts.length === 2) nomesEspeciaisObj[parseInt(parts[0].trim())] = parts[1].trim();
        });

        // Parse do JSON de Classes
        let classesObj;
        try {
            classesObj = JSON.parse(document.getElementById('confClasses').value);
        } catch(e) {
            alert("Erro no JSON de classes! Verifique se as aspas e chaves estão corretas.");
            return;
        }
        const opcoesClasses = [' ', ...Object.keys(classesObj)];

        const cWidth = canvas.width;
        const cHeight = canvas.height;

        // Loop para criar os campos de 0 até o total de cliques dados (currentStep)
        for (let i = 0; i < currentStep; i++) {
            const el = document.getElementById(`field-${i}`);
            if (!el) continue;

            // Determina o nome (se tem nome especial, usa ele; senão, usa c1, c2, c3...)
            let name = nomesEspeciaisObj[i] ? nomesEspeciaisObj[i] : `c${i+1}`;
            let f;

            if (i === dropdownIdx) {
                f = form.createDropdown(name);
                f.addOptions(opcoesClasses);
                f.select(' ');
            } else {
                f = form.createTextField(name);
                
                // Se for multilinhas
                if (multiIndices.includes(i)) f.enableMultiline();
                
                // Trava campos automáticos
                if (readOnlyIndices.includes(i)) f.enableReadOnly();

                f.acroField.dict.set(PDFName.of('DA'), PDFString.of('/Helvetica 12 Tf 0 g'));
                f.setFontSize(12);
                f.setAlignment(indicesEsquerda.includes(i) ? TextAlignment.Left : TextAlignment.Center);
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

        // --- CONSTRUÇÃO DO MOTOR MATEMÁTICO BASEADO NO MENU ---
        const nomeCampoBase = nomesEspeciaisObj[dropdownIdx] || `c${dropdownIdx + 1}`;
        
        const scriptMotor = [
            `var escolha = this.getField("${nomeCampoBase}").value;`,
            `var bases = ${JSON.stringify(classesObj)};`,
            'var b = bases[escolha] || [0,0,0];',
            `var multStep = ${multStep};`,
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
            '// Calculos (Protegidos com if para não quebrar se o campo não existir)',
            'if (this.getField("c2")) {',
            '  var n1 = Number(this.getField("c2").value) || 0;',
            '  var bonusMult1 = Math.floor(n1 / multStep);',
            '  if (this.getField("c3")) this.getField("c3").value = getDado(n1);',
            '  if (this.getField("res")) this.getField("res").value = ((b[0] + bonusMult1) * n1) + getD(n1);',
            '  if (this.getField("c8")) this.getField("c8").value = ((b[2] + bonusMult1) * n1) + getD(n1);',
            '}',
            '',
            'if (this.getField("c5")) {',
            '  var n2 = Number(this.getField("c5").value) || 0;',
            '  var bonusMult2 = Math.floor(n2 / multStep);',
            '  if (this.getField("c6")) this.getField("c6").value = getDado(n2);',
            '  if (this.getField("res2")) this.getField("res2").value = ((b[1] + bonusMult2) * n2) + getD(n2);',
            '}',
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

        // Adiciona a rotina de Cálculo nos campos marcados como Gatilhos no menu
        triggerIndices.forEach(idx => {
            let tName = nomesEspeciaisObj[idx] ? nomesEspeciaisObj[idx] : `c${idx+1}`;
            try {
                const field = form.getField(tName);
                if (field) {
                    field.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ K: action, V: action }));
                    const widgets = field.acroField.getWidgets();
                    if (widgets && widgets.length > 0) {
                        const widget = widgets[0];
                        let widgetAA = widget.dict.get(PDFName.of('AA'));
                        if (!widgetAA) {
                            widgetAA = pdfDoc.context.obj({});
                            widget.dict.set(PDFName.of('AA'), widgetAA);
                        }
                        widgetAA.set(PDFName.of('Bl'), action); // Aciona onBlur
                    }
                }
            } catch(e) { /* Ignora se o campo de gatilho não existir */ }
        });

        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "ficha_RPG_customizada.pdf";
        a.click();
    } catch (err) {
        console.error(err);
        alert("Erro técnico ao gerar o PDF: " + err.message);
    }
});
