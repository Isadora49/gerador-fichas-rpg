const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;
let currentStep = 0;

// Lista de nomes base (Se criar campos infinitos, passará a se chamar "Campo Extra X")
const defaultLabels = [
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

const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');
const btnFinish = document.getElementById('btnFinish');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// TOGGLE DO MENU DE CONFIGURAÇÃO
document.getElementById('btnConfig').addEventListener('click', () => {
    const panel = document.getElementById('config-panel');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
});

// FUNÇÕES DE APOIO PARA LER DADOS DO MENU
const parseIndices = (id) => document.getElementById(id).value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
const getLimit = () => parseInt(document.getElementById('confLimit').value) || 0;
const getLabel = (index) => defaultLabels[index] || `Campo Extra ${index + 1}`;

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
        
        const limite = getLimit();
        if (limite === 0) {
            btnFinish.style.display = 'inline-block'; // Mostra botão de finalizar se for infinito
        } else {
            btnFinish.style.display = 'none';
        }

        statusEl.innerText = "Clique para posicionar: " + getLabel(0);
        btnDownload.disabled = true;
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

// FINALIZAR MARCAÇÕES MANUAIS (Para campos infinitos ou terminar cedo)
btnFinish.addEventListener('click', () => {
    if (currentStep > 0) {
        statusEl.innerText = `Finalizado com ${currentStep} campos marcados!`;
        btnDownload.disabled = false;
        btnFinish.style.display = 'none';
    } else {
        alert("Marque pelo menos um campo!");
    }
});

// CRIAÇÃO DO MARCADOR
canvas.addEventListener('click', (e) => {
    if (!pdfOriginalBytes) return;
    
    const limit = getLimit();
    if (limit > 0 && currentStep >= limit) return; // Trava se atingiu o limite escolhido no menu

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = `field-${currentStep}`;
    
    // Leitura dinâmica para visual do marcador baseando-se no menu
    const multiIndices = parseIndices('confMulti');
    const isMultiLine = multiIndices.includes(currentStep);
    
    const defaultW = isMultiLine ? 120 : 60;
    const defaultH = isMultiLine ? 60 : 20;

    marker.style.width = defaultW + 'px';
    marker.style.height = defaultH + 'px';
    marker.style.left = (x - defaultW / 2) + 'px';
    marker.style.top = (y - defaultH / 2) + 'px';
    
    marker.innerHTML = `<span class="label-text">${getLabel(currentStep)}</span>`;
    wrapper.appendChild(marker);

    makeDraggable(marker);

    currentStep++;
    
    if (limit > 0 && currentStep === limit) {
        statusEl.innerText = "Todos os campos definidos pelo limite foram posicionados!";
        btnDownload.disabled = false;
    } else {
        statusEl.innerText = "Posicione: " + getLabel(currentStep);
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

// GERAÇÃO DO PDF FINAL USANDO OS DADOS DO MENU
btnDownload.addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        
        // --- 1. Lendo as regras definidas no Menu HTML ---
        const indicesEsquerda = parseIndices('confLeft');
        const readOnlyIndices = parseIndices('confReadOnly');
        const multiIndices = parseIndices('confMulti');
        const dropdownIdx = parseIndices('confDropdown')[0] || 0;
        
        // Mapeando nomes especiais customizados (ex: 3:res)
        const nomesEspeciaisList = document.getElementById('confNames').value.split(',');
        const nomesEspeciaisObj = {};
        nomesEspeciaisList.forEach(item => {
            const parts = item.split(':');
            if (parts.length === 2) nomesEspeciaisObj[parseInt(parts[0].trim())] = parts[1].trim();
        });

        // Pegando o JSON de Classes
        let classesString = document.getElementById('confClasses').value;
        let classesObj = {};
        try {
            classesObj = JSON.parse(classesString);
        } catch(e) {
            alert("Erro no formato JSON das Classes! O PDF usará bases em branco. Corrija o menu e tente de novo.");
        }
        const opcoesClasses = [' ', ...Object.keys(classesObj)]; // Adiciona array dinâmico baseado no seu JSON

        const cWidth = canvas.width;
        const cHeight = canvas.height;

        // O loop roda até o "currentStep", permitindo lidar com N campos (2 ou 999 infinitos)
        for (let i = 0; i < currentStep; i++) {
            const el = document.getElementById(`field-${i}`);
            if (!el) continue;

            // Se for um nome especial configurado, usa ele. Senão usa c1, c2, c3...
            let name = nomesEspeciaisObj[i] || `c${i+1}`;
            let f;

            if (i === dropdownIdx) {
                f = form.createDropdown(name);
                f.addOptions(opcoesClasses);
                f.select(' ');
            } else {
                f = form.createTextField(name);
                
                // Se o campo de texto tiver "Dado" na descrição original, eu ponho o texto 1d4, senão "0"
                // Para não quebrar, olhamos se o nome do default label tem "Dado"
                if (getLabel(i).includes('Dado')) {
                    f.setText("1d4");
                } else if (i < 36 && !getLabel(i).includes('Texto') && !getLabel(i).includes('Multi')) {
                    f.setText("0");
                }
                
                if (multiIndices.includes(i)) f.enableMultiline();
                if (readOnlyIndices.includes(i)) f.enableReadOnly(); // Trava os dados definidos no menu

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

        // MOTOR DE CÁLCULO
        // O motor original é preservado, mas agora injetamos o JSON de classes que o usuário editou no menu diretamente dentro da engine do PDF!
        const scriptMotor = [
            'var escolha = this.getField("c1").value;',
            'var bases = ' + JSON.stringify(classesObj) + ';', // INJEÇÃO DINÂMICA DA LÓGICA DO MENU
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
            'if (this.getField("res")) this.getField("res").value = (valBase1 * n1) + getD(n1);',
            'if (this.getField("c8")) this.getField("c8").value = (valBase3 * n1) + getD(n1);',
            '',
            'var n2 = Number(this.getField("c5").value) || 0;',
            'if (this.getField("c6")) this.getField("c6").value = getDado(n2);',
            'if (this.getField("res2")) this.getField("res2").value = (valBase2 * n2) + getD(n2);',
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
            if(resField) {
                resField.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ C: action }));
                form.acroForm.dict.set(PDFName.of('CO'), pdfDoc.context.obj([ resField.ref ]));
            }
        } catch (e) { console.warn('Campo de calculo total ausente, ignorando action link.'); }

        const triggerNames = ['c1', 'c2', 'c5', 'c9', 'c11', 'c13', 'c15', 'c17', 'c19', 'c21', 'c23', 'c25', 'c27', 'c29', 'c31', 'c33', 'c35'];
        triggerNames.forEach(name => {
            try {
                const field = form.getField(name);
                if (!field) return;
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
            } catch(e) { /* Ignorar avisos silenciosamente para campos não gerados */ }
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
