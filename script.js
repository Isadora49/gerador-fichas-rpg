const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

let pdfDoc = null;
let rawPdfBytes = null;
let fieldPositions = {}; // Armazena x, y de cada campo

// 1. Carregar e Visualizar o PDF
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    rawPdfBytes = await file.arrayBuffer();
    
    const loadingTask = pdfjsLib.getDocument({data: rawPdfBytes});
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1); // Mostra a primeira página
    
    const viewport = page.getViewport({scale: 1.5});
    const canvas = document.getElementById('pdf-canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({canvasContext: context, viewport: viewport}).promise;
    pdfDoc = await PDFLib.PDFDocument.load(rawPdfBytes);
});

// 2. Capturar o Clique para Posicionar Campos
document.getElementById('pdf-container').addEventListener('mousedown', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const type = document.getElementById('fieldType').value;

    // Salva a posição (ajustando para o sistema de coordenadas do PDF que é de baixo para cima)
    const canvas = document.getElementById('pdf-canvas');
    fieldPositions[type] = { 
        x: x, 
        y: canvas.height - y - 20, // Inverte o eixo Y
        viewX: x,
        viewY: y
    };

    // Adiciona uma marcação visual na tela
    const label = document.createElement('div');
    label.className = 'field-label';
    label.style.left = x + 'px';
    label.style.top = y + 'px';
    label.innerText = type;
    e.currentTarget.appendChild(label);
});

// 3. Gerar o PDF Final com a lógica (C1 * C2) + C3 = C4
document.getElementById('downloadBtn').addEventListener('click', async () => {
    if (!rawPdfBytes) return alert("Suba um PDF primeiro!");
    
    const { PDFDocument, PDFName } = PDFLib;
    const finalDoc = await PDFDocument.load(rawPdfBytes);
    const form = finalDoc.getForm();
    const page = finalDoc.getPage(0);

    // Criar os 4 campos nas posições clicadas
    const campos = ['campo1', 'campo2', 'campo3', 'resultado'];
    const createdFields = {};

    campos.forEach(name => {
        if (fieldPositions[name]) {
            const f = form.createTextField(name);
            f.addToPage(page, { 
                x: fieldPositions[name].x, 
                y: fieldPositions[name].y, 
                width: 60, height: 20 
            });
            createdFields[name] = f;
        }
    });

    // Injetar a Lógica Matemática no Campo de Resultado
    if (createdFields['resultado']) {
        const scriptJS = `
            var c1 = this.getField("campo1").value || 0;
            var c2 = this.getField("campo2").value || 0;
            var c3 = this.getField("campo3").value || 0;
            event.value = (Number(c1) * Number(c2)) + Number(c3);
        `;

        const resField = createdFields['resultado'].acroField;
        const context = finalDoc.context;
        
        // Comando para o PDF calcular automaticamente
        resField.dict.set(PDFName.of('AA'), context.obj({
            C: context.obj({
                Type: 'Action',
                S: 'JavaScript',
                JS: scriptJS
            })
        }));
    }

    const pdfBytes = await finalDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ficha_automatizada.pdf';
    link.click();
});
