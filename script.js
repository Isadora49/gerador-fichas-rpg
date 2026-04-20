const { PDFDocument, PDFName, PDFString, TextAlignment } = window.PDFLib || {};

let pdfOriginalBytes = null;
let fieldCounter = 1;
let selectedMarker = null;

const canvas = document.getElementById('pdf-canvas');
const wrapper = document.getElementById('canvas-wrapper');
const statusEl = document.getElementById('status');
const btnDownload = document.getElementById('btnDownload');

// Elementos da UI de Propriedades
const propForm = document.getElementById('properties-form');
const noSelMsg = document.getElementById('no-selection-msg');
const propIdInput = document.getElementById('propId');
const propTypeSelect = document.getElementById('propType');
const propAlignSelect = document.getElementById('propAlign');
const btnDeleteField = document.getElementById('btnDeleteField');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// -----------------------------------------------------
// 1. CARREGAMENTO DO PDF
// -----------------------------------------------------
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
        
        // Limpa campos antigos ao carregar novo PDF
        document.querySelectorAll('.marker').forEach(m => m.remove());
        deselectMarker();
        statusEl.innerText = "PDF Carregado. Use a caixa de ferramentas para adicionar campos.";
        btnDownload.disabled = false;
    } catch (err) {
        alert("Erro no PDF: " + err.message);
    }
});

// -----------------------------------------------------
// 2. CAIXA DE FERRAMENTAS (Adicionar Campos)
// -----------------------------------------------------
function createMarker(type) {
    if (!pdfOriginalBytes) {
        alert("Faça o upload de um PDF primeiro!");
        return;
    }

    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.dataset.id = `campo_${fieldCounter++}`;
    marker.dataset.type = type;
    marker.dataset.align = 'Center';

    const defaultW = type === 'multiline' ? 120 : 80;
    const defaultH = type === 'multiline' ? 60 : 25;

    // Posiciona no centro do wrapper inicialmente
    marker.style.width = defaultW + 'px';
    marker.style.height = defaultH + 'px';
    marker.style.left = (wrapper.clientWidth / 2 - defaultW / 2) + 'px';
    marker.style.top = (wrapper.clientHeight / 2 - defaultH / 2) + 'px';
    
    marker.innerHTML = `<span class="label-text">${marker.dataset.id}</span>`;
    wrapper.appendChild(marker);

    makeDraggable(marker);
    
    // Seleciona automaticamente o novo campo
    selectMarker(marker);
}

document.getElementById('btnAddTextField').addEventListener('click', () => createMarker('text'));
document.getElementById('btnAddDropdown').addEventListener('click', () => createMarker('dropdown'));
document.getElementById('btnAddMultiline').addEventListener('click', () => createMarker('multiline'));

// -----------------------------------------------------
// 3. INTERAÇÃO (Selecionar, Arrastar, Deletar)
// -----------------------------------------------------
function selectMarker(marker) {
    if (selectedMarker) selectedMarker.classList.remove('selected');
    selectedMarker = marker;
    selectedMarker.classList.add('selected');
    
    // Atualiza Painel de Propriedades
    noSelMsg.style.display = 'none';
    propForm.style.display = 'block';
    
    propIdInput.value = marker.dataset.id;
    propTypeSelect.value = marker.dataset.type;
    propAlignSelect.value = marker.dataset.align;
}

function deselectMarker() {
    if (selectedMarker) selectedMarker.classList.remove('selected');
    selectedMarker = null;
    noSelMsg.style.display = 'block';
    propForm.style.display = 'none';
}

// Clicar fora deseleciona
wrapper.addEventListener('mousedown', (e) => {
    if (e.target === canvas) deselectMarker();
});

// Atualizar Propriedades via Painel
propIdInput.addEventListener('input', (e) => {
    if (!selectedMarker) return;
    selectedMarker.dataset.id = e.target.value;
    selectedMarker.querySelector('.label-text').innerText = e.target.value;
});
propTypeSelect.addEventListener('change', (e) => { if (selectedMarker) selectedMarker.dataset.type = e.target.value; });
propAlignSelect.addEventListener('change', (e) => { if (selectedMarker) selectedMarker.dataset.align = e.target.value; });

btnDeleteField.addEventListener('click', () => {
    if (selectedMarker) {
        selectedMarker.remove();
        deselectMarker();
    }
});

function makeDraggable(el) {
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    el.addEventListener('mousedown', (e) => {
        selectMarker(el);
        // Previne arrastar se estiver clicando no canto de redimensionamento (resize grip)
        if (e.offsetX > el.clientWidth - 15 && e.offsetY > el.clientHeight - 15) return; 
        isDragging = true;
        offset = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop };
        e.stopPropagation(); // Evita que o click vaze para o wrapper
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        el.style.left = (e.clientX - offset.x) + 'px';
        el.style.top = (e.clientY - offset.y) + 'px';
    });

    document.addEventListener('mouseup', () => { isDragging = false; });
}

// -----------------------------------------------------
// 4. GERAÇÃO DO PDF FINAL
// -----------------------------------------------------
btnDownload.addEventListener('click', async () => {
    try {
        statusEl.innerText = "Gerando PDF...";
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        
        const cWidth = canvas.width;
        const cHeight = canvas.height;

        // Pegar todas as classes digitadas na UI
        const classesTexto = document.getElementById('configClasses').value;
        const opcoesClasses = classesTexto.split(',').map(s => s.trim()).filter(s => s);
        opcoesClasses.unshift(' '); // Opção vazia padrão

        const markers = document.querySelectorAll('.marker');

        // Loop por todos os campos criados livremente
        markers.forEach(el => {
            const id = el.dataset.id;
            const type = el.dataset.type;
            const align = el.dataset.align;
            
            let f;
            try {
                if (type === 'dropdown') {
                    f = form.createDropdown(id);
                    f.addOptions(opcoesClasses);
                    f.select(' ');
                } else {
                    f = form.createTextField(id);
                    if (type === 'multiline') f.enableMultiline();
                    if (type === 'readonly') f.enableReadOnly();
                    
                    f.acroField.dict.set(PDFName.of('DA'), PDFString.of('/Helvetica 12 Tf 0 g'));
                    f.setFontSize(12);
                    f.setAlignment(TextAlignment[align]);
                }
            } catch (err) {
                console.warn(`Campo ${id} já existe ou falhou.`, err);
                return;
            }

            const elLeft = parseFloat(el.style.left);
            const elTop = parseFloat(el.style.top);
            const elW = el.offsetWidth;
            const elH = el.offsetHeight;

            // Converter coordenadas HTML para coordenadas do PDF
            f.addToPage(page, { 
                x: (elLeft * width) / cWidth, 
                y: height - ((elTop * height) / cHeight) - ((elH * height) / cHeight), 
                width: (elW * width) / cWidth, 
                height: (elH * height) / cHeight,
                borderWidth: 0 
            });
        });

        // NOTA SOBRE LÓGICA DE PROGRAMAÇÃO EMBUTIDA NO PDF:
        // Se você renomeou os campos livremente, o script original de RPG vai falhar
        // pois ele procurava por "c1", "res", etc. 
        // Abaixo está uma versão simplificada do seu motor embutido que você pode expandir.
        
        const scriptMotor = [
            '// Script de Lógica do PDF',
            'try {',
            '  var escolha = this.getField("c1") ? this.getField("c1").value : "";',
            '  // Se o campo de resultado existir, podemos colocar lógica aqui',
            '} catch(e) {}'
        ].join('\n');

        const action = pdfDoc.context.obj({
            Type: 'Action',
            S: 'JavaScript',
            JS: PDFString.of(scriptMotor)
        });

        form.acroForm.dict.set(PDFName.of('NeedAppearances'), pdfDoc.context.obj(true));

        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "ficha_customizada.pdf";
        a.click();
        statusEl.innerText = "PDF baixado com sucesso!";
        
    } catch (err) {
        console.error(err);
        alert("Erro técnico ao gerar o PDF: " + err.message);
        statusEl.innerText = "Erro ao gerar PDF.";
    }
});
