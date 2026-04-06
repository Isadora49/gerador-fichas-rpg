// Alias para facilitar o uso da biblioteca
const { PDFDocument, PDFName, PDFString } = window.PDFLib || {};

let pdfBytes = null;
let clicks = [];
const labels = ["Campo 1 (X)", "Campo 2 (X)", "Campo 3 (+)", "Resultado (=)"];

// Configura o worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// 1. Carregamento do Arquivo
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        pdfBytes = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.getElementById('pdf-canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        document.getElementById('status').innerText = "Clique para: " + labels[0];
        clicks = []; // Reseta cliques ao subir novo PDF
    } catch (err) {
        alert("Erro ao carregar PDF: " + err.message);
    }
});

// 2. Marcação dos Campos
document.getElementById('pdf-canvas').addEventListener('click', (e) => {
    if (clicks.length >= 4) return;

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    clicks.push({ x, y, w: rect.width, h: rect.height });

    // Criar marca visual
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.left = e.pageX + 'px';
    marker.style.top = e.pageY + 'px';
    marker.innerText = labels[clicks.length - 1];
    document.body.appendChild(marker);

    if (clicks.length === 4) {
        document.getElementById('status').innerText = "Pronto para baixar!";
        document.getElementById('btnDownload').disabled = false;
    } else {
        document.getElementById('status').innerText = "Clique para: " + labels[clicks.length];
    }
});

// 3. Geração do PDF (Botão Baixar)
document.getElementById('btnDownload').addEventListener('click', async () => {
    try {
        if (!window.PDFLib) throw new Error("Biblioteca PDF-Lib não carregada!");

        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();

        const fieldNames = ['c1', 'c2', 'c3', 'res'];
        const fields = [];

        for (let i = 0; i < 4; i++) {
            const pos = clicks[i];
            const f = form.createTextField(fieldNames[i]);
            
            // Converte coordenada do clique para escala do PDF
            const pdfX = (pos.x * width) / pos.w;
            const pdfY = height - ((pos.y * height) / pos.h);

            f.addToPage(page, { 
                x: pdfX, 
                y: pdfY - 10, 
                width: 50, 
                height: 20 
            });
            f.setText("0");
            fields.push(f);
        }

        // Lógica de Cálculo Interna: (C1 * C2) + C3 = Res
        const resField = fields[3];
        const jsAction = `
            var v1 = Number(this.getField("c1").value) || 0;
            var v2 = Number(this.getField("c2").value) || 0;
            var v3 = Number(this.getField("c3").value) || 0;
            event.value = (v1 * v2) + v3;
        `;

        // Injeção do Script de Cálculo
        const docContext = pdfDoc.context;
        resField.acroField.dict.set(
            PDFName.of('AA'),
            docContext.obj({
                C: docContext.obj({
                    Type: 'Action',
                    S: 'JavaScript',
                    JS: jsAction
                })
            })
        );

        const finalPdfBytes = await pdfDoc.save();
        
        // Trigger de Download
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "ficha_calculavel_rpg.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error(err);
        alert("Erro ao gerar o PDF: " + err.message);
    }
});
