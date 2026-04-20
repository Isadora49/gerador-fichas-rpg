const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;
let campos = {}; // Objeto que armazenará todos os nossos campos dinamicamente
let fieldIdCounter = 0;
let campoSelecionado = null;

const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const btnAdicionar = document.getElementById('btnAdicionar');
const btnDownload = document.getElementById('btnDownload');

// Elementos do Painel de Propriedades
const painelEditor = document.getElementById('editor-form');
const msgVazio = document.getElementById('no-selection-msg');
const inputName = document.getElementById('propName');
const inputType = document.getElementById('propType');
const inputFormula = document.getElementById('propFormula');
const inputAlign = document.getElementById('propAlign');
const groupFormula = document.getElementById('groupFormula');
const btnDelete = document.getElementById('btnDelete');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// 1. CARREGAR PDF
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
        
        // Limpa tudo ao carregar novo PDF
        document.querySelectorAll('.marker').forEach(m => m.remove());
        campos = {};
        deselecionarCampo();
        
        btnAdicionar.disabled = false;
        btnDownload.disabled = false;
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

// 2. CRIAR NOVO CAMPO
btnAdicionar.addEventListener('click', () => {
    fieldIdCounter++;
    const id = `campo_${fieldIdCounter}`;
    const defaultName = `C${fieldIdCounter}`;
    
    // Salva na memória
    campos[id] = {
        id: id,
        name: defaultName,
        type: 'text', // text, multiline, calc
        formula: '',
        align: 'center'
    };

    // Cria visualmente
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.id = id;
    marker.style.width = '80px';
    marker.style.height = '30px';
    marker.style.left = '50px';
    marker.style.top = '50px';
    marker.innerHTML = `<span class="label-text">${defaultName}</span>`;
    
    // Interações
    marker.addEventListener('mousedown', (e) => {
        selecionarCampo(id);
        iniciarArraste(marker, e);
    });

    wrapper.appendChild(marker);
    selecionarCampo(id);
});

// 3. LÓGICA DE SELEÇÃO E CAIXA DE FERRAMENTAS
function selecionarCampo(id) {
    document.querySelectorAll('.marker').forEach(m => m.classList.remove('selected'));
    campoSelecionado = id;
    
    const marker = document.getElementById(id);
    if(marker) marker.classList.add('selected');

    const dados = campos[id];
    msgVazio.style.display = 'none';
    painelEditor.style.display = 'flex';

    // Preenche os inputs com os dados do campo atual
    inputName.value = dados.name;
    inputType.value = dados.type;
    inputFormula.value = dados.formula;
    inputAlign.value = dados.align;
    
    groupFormula.style.display = dados.type === 'calc' ? 'flex' : 'none';
}

function deselecionarCampo() {
    document.querySelectorAll('.marker').forEach(m => m.classList.remove('selected'));
    campoSelecionado = null;
    msgVazio.style.display = 'block';
    painelEditor.style.display = 'none';
}

// 4. ATUALIZAR DADOS (Quando o usuário digita na barra lateral)
inputName.addEventListener('input', (e) => {
    if(!campoSelecionado) return;
    campos[campoSelecionado].name = e.target.value;
    document.getElementById(campoSelecionado).querySelector('.label-text').innerText = e.target.value || "Sem Nome";
});

inputType.addEventListener('change', (e) => {
    if(!campoSelecionado) return;
    campos[campoSelecionado].type = e.target.value;
    groupFormula.style.display = e.target.value === 'calc' ? 'flex' : 'none';
});

inputFormula.addEventListener('input', (e) => {
    if(!campoSelecionado) return;
    campos[campoSelecionado].formula = e.target.value;
});

inputAlign.addEventListener('change', (e) => {
    if(!campoSelecionado) return;
    campos[campoSelecionado].align = e.target.value;
});

// 5. EXCLUIR CAMPO
btnDelete.addEventListener('click', () => {
    if(!campoSelecionado) return;
    document.getElementById(campoSelecionado).remove();
    delete campos[campoSelecionado];
    deselecionarCampo();
});

// 6. ARRASTAR E SOLTAR
function iniciarArraste(el, e) {
    // Evita arrastar se estiver redimensionando (canto inferior direito)
    if (e.offsetX > el.clientWidth - 15 && e.offsetY > el.clientHeight - 15) return; 
    
    let isDragging = true;
    let startX = e.clientX - el.offsetLeft;
    let startY = e.clientY - el.offsetTop;

    function move(ev) {
        if (!isDragging) return;
        el.style.left = (ev.clientX - startX) + 'px';
        el.style.top = (ev.clientY - startY) + 'px';
    }
    function up() {
        isDragging = false;
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
}

// ==========================================
// 7. GERAÇÃO INTELIGENTE DO PDF E FÓRMULAS
// ==========================================
btnDownload.addEventListener('click', async () => {
    if(Object.keys(campos).length === 0) {
        alert("Adicione pelo menos um campo!");
        return;
    }

    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        
        const cWidth = canvas.width;
        const cHeight = canvas.height;

        let scriptMotor = ""; // Vai guardar todos os cálculos

        // Processar cada campo criado
        for (const key in campos) {
            const prop = campos[key];
            const el = document.getElementById(prop.id);
            if (!el) continue;

            const f = form.createTextField(prop.name);

            // Configurações base
            f.acroField.dict.set(PDFName.of('DA'), PDFString.of('/Helvetica 12 Tf 0 g'));
            f.setFontSize(12);
            f.setAlignment(prop.align === 'left' ? TextAlignment.Left : TextAlignment.Center);

            // Aplica tipos
            if (prop.type === 'multiline') {
                f.enableMultiline();
            } else if (prop.type === 'calc') {
                f.enableReadOnly(); // O usuário não edita cálculo na mão
                
                // Converte a fórmula visual "[CampoA] + [CampoB]" para o formato Adobe Javascript
                // Substitui [NomeDoCampo] por Number(this.getField("NomeDoCampo").value)
                let formulaJS = prop.formula.replace(/\[(.*?)\]/g, 'Number(this.getField("$1").value)');
                
                // Adiciona a fórmula no motor principal do PDF
                scriptMotor += `try { this.getField("${prop.name}").value = ${formulaJS}; } catch(e) {}\n`;
            }

            // Posiciona no PDF
            const elLeft = parseFloat(el.style.left) || 0;
            const elTop = parseFloat(el.style.top) || 0;
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

        // Se houver fórmulas, injetamos no PDF para calcular automaticamente
        if (scriptMotor !== "") {
            const action = pdfDoc.context.obj({
                Type: 'Action',
                S: 'JavaScript',
                JS: PDFString.of(scriptMotor)
            });

            form.acroForm.dict.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(true));

            // Aplicar o evento de cálculo (Blur/Perda de foco) a todos os campos de texto
            for (const key in campos) {
                if (campos[key].type !== 'calc') {
                    try {
                        const field = form.getField(campos[key].name);
                        field.acroField.dict.set(PDFName.of('AA'), pdfDoc.context.obj({ Bl: action }));
                    } catch(e) {}
                }
            }
        }

        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "ficha_interativa.pdf";
        a.click();
        
    } catch (err) {
        console.error(err);
        alert("Erro ao gerar PDF: Certifique-se de que não existem dois campos com o mesmo Nome exato e que as fórmulas estão corretas.");
    }
});
