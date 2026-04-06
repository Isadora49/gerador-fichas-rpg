// Configuração do worker do PDF.js (Necessário para a biblioteca funcionar)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let pdfBytesOriginal = null; // Vai guardar o PDF cru
let cliques = []; // Vai guardar as coordenadas de onde o usuário clicou
let pdfEscala = 1.5; // Tamanho do zoom do PDF na tela
let alturaOriginalPagina = 0; // Necessário para inverter o eixo Y depois

const container = document.getElementById('pdf-container');
const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');

// --- PASSO 1: LER E MOSTRAR O PDF NA TELA ---
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Guarda os bytes para usar no pdf-lib depois
    pdfBytesOriginal = await file.arrayBuffer(); 

    // Carrega o PDF na tela usando pdf.js
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytesOriginal });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1); // Pega a primeira página

    const viewport = page.getViewport({ scale: pdfEscala });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Precisamos saber a altura real do PDF (sem o zoom) para a conversão matemática
    alturaOriginalPagina = viewport.height / pdfEscala;

    // Desenha o PDF no canvas
    const renderContext = { canvasContext: ctx, viewport: viewport };
    await page.render(renderContext).promise;

    // Libera os botões
    document.getElementById('gerarPdf').disabled = false;
    document.getElementById('limpar').disabled = false;
});

// --- PASSO 2: CAPTURAR OS CLIQUES NA TELA ---
container.addEventListener('mousedown', (e) => {
    if (!pdfBytesOriginal) return;
    if (cliques.length >= 3) {
        alert("Você já colocou os 3 campos (Valor 1, Valor 2 e Resultado). Clique em Gerar ou Limpar.");
        return;
    }

    // Pega a posição do clique relativa ao container
    const rect = container.getBoundingClientRect();
    const xTela = e.clientX - rect.left;
    const yTela = e.clientY - rect.top;

    // Tamanho padrão dos campos de formulário (na tela)
    const larguraCampo = 50 * pdfEscala; 
    const alturaCampo = 20 * pdfEscala;

    // Cria o visual do marcador no HTML (só para o usuário ver onde clicou)
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.left = `${xTela}px`;
    marker.style.top = `${yTela}px`;
    marker.style.width = `${larguraCampo}px`;
    marker.style.height = `${alturaCampo}px`;

    // Nomeia o marcador de acordo com a ordem do clique
    const nomes = ['Valor 1', 'Valor 2', 'Total'];
    marker.innerText = nomes[cliques.length];
    container.appendChild(marker);

    // Salva a coordenada (removendo a escala visual para o PDF-lib entender)
    cliques.push({ 
        x: xTela / pdfEscala, 
        y: yTela / pdfEscala, 
        width: 50, 
        height: 20 
    });
});

// Botão para limpar caso o usuário clique errado
document.getElementById('limpar').addEventListener('click', () => {
    cliques = [];
    document.querySelectorAll('.marker').forEach(m => m.remove());
});

// --- PASSO 3: GERAR O PDF FINAL COM CÁLCULOS ---
document.getElementById('gerarPdf').addEventListener('click', async () => {
    if (cliques.length < 3) {
        return alert('Por favor, clique no PDF para posicionar os 3 campos antes de gerar!');
    }

    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.load(pdfBytesOriginal);
    const form = pdfDoc.getForm();
    const page = pdfDoc.getPage(0);

    // Função auxiliar para inverter o Eixo Y (A tela lê de cima pra baixo, o PDF de baixo pra cima)
    const converterY = (yDaTela, alturaCampo) => {
        return alturaOriginalPagina - yDaTela - alturaCampo;
    };

    // 1. Cria Campo "Valor 1"
    const coord1 = cliques[0];
    const field1 = form.createTextField('valor1');
    field1.addToPage(page, { 
        x: coord1.x, 
        y: converterY(coord1.y, coord1.height), 
        width: coord1.width, 
        height: coord1.height 
    });

    // 2. Cria Campo "Valor 2"
    const coord2 = cliques[1];
    const field2 = form.createTextField('valor2');
    field2.addToPage(page, { 
        x: coord2.x, 
        y: converterY(coord2.y, coord2.height), 
        width: coord2.width, 
        height: coord2.height 
    });

    // 3. Cria Campo "Total"
    const coord3 = cliques[2];
    const fieldTotal = form.createTextField('total');
    fieldTotal.addToPage(page, { 
        x: coord3.x, 
        y: converterY(coord3.y, coord3.height), 
        width: coord3.width, 
        height: coord3.height 
    });

    // --- INJETANDO A FÓRMULA MATEMÁTICA ---
    const acroField = fieldTotal.acroField;
    const docContext = pdfDoc.context;

    // JavaScript interno do PDF (Multiplica valor1 * valor2)
    const calculateAction = docContext.obj({
        Type: 'Action',
        S: 'JavaScript',
        JS: 'var v1 = Number(this.getField("valor1").value) || 0; var v2 = Number(this.getField("valor2").value) || 0; event.value = v1 * v2;'
    });

    acroField.dict.set(PDFLib.PDFName.of('AA'), docContext.obj({
        C: calculateAction
    }));
    // ----------------------------------------

    // Salva e força o download
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Ficha_Interativa_Calculada.pdf';
    link.click();
});
