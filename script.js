const { PDFDocument, PDFName } = PDFLib;
let pdfDoc = null;
let pdfBytes = null;
let clicks = []; // Armazena as coordenadas dos 4 campos
const labels = ["Campo 1 (X)", "Campo 2 (X)", "Campo 3 (+)", "Resultado (=)"];

// Configuração do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Carregar PDF e renderizar no Canvas
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    pdfBytes = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({data: pdfBytes});
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1); // Página 1
    
    const viewport = page.getViewport({scale: 1.5});
    const canvas = document.getElementById('pdf-canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({canvasContext: context, viewport: viewport}).promise;
    document.getElementById('status').innerText = "Clique no PDF para o 1º campo";
});

// Capturar cliques para posicionar campos
document.getElementById('pdf-canvas').addEventListener('mousedown', (e) => {
    if (clicks.length >= 4) return;

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Salva as coordenadas relativas ao tamanho do canvas
    clicks.push({ x, y, canvasW: rect.width, canvasH: rect.height });

    // Adiciona uma marca visual no site
    const overlay = document.getElementById('overlay-fields');
    const dot = document.createElement('div');
    dot.className = 'field-label';
    dot.style.left = `${e.clientX + window.scrollX}px`;
    dot.style.top = `${e.clientY + window.scrollY}px`;
    dot.innerText = labels[clicks.length - 1];
    document.body.appendChild(dot);

    if (clicks.length === 4) {
        document.getElementById('status').innerText = "Campos prontos!";
        document.getElementById('btnDownload').disabled = false;
    } else {
        document.getElementById('status').innerText = `Clique para o ${labels[clicks.length]}`;
    }
});

// Gerar PDF final com lógica interna
document.getElementById('btnDownload').addEventListener('click', async () => {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const page = pdfDoc.getPage(0);
    const { height } = page.getSize();

    const names = ['c1', 'c2', 'c3', 'res'];
    
    // Criar os 4 campos no PDF
    const fields = clicks.map((pos, i) => {
        const f = form.createTextField(names[i]);
        // Conversão de coordenadas do Canvas para o PDF
        const pdfX = (pos.x * page.getSize().width) / pos.canvasW;
        const pdfY = height - ((pos.y * page.getSize().height) / pos.canvasH);
        
        f.addToPage(page, { x: pdfX, y: pdfY - 20, width: 60, height: 20 });
        f.setText("0");
        return f;
    });

    // LÓGICA DE RPG: (Campo1 * Campo2) + Campo3 = Resultado
    const resField = fields[3];
    const docContext = pdfDoc.context;

    const calculateJS = `
        var c1 = Number(this.getField("c1").value);
        var c2 = Number(this.getField("c2").value);
        var c3 = Number(this.getField("c3").value);
        event.value = (c1 * c2) + c3;
    `;

    const calculateAction = docContext.obj({
        Type: 'Action',
        S: 'JavaScript',
        JS: calculateJS
    });

    resField.acroField.dict.set(PDFName.of('AA'), docContext.obj({
        C: calculateAction
    }));

    const finalBytes = await pdfDoc.save();
    const blob = new Blob([finalBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ficha_automatizada_2026.pdf';
    link.click();
});
