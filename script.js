const { PDFDocument, PDFName, PDFString } = PDFLib;
let pdfBytes = null;
let clicks = [];
const labels = ["C1 (x)", "C2 (x)", "C3 (+)", "RESULTADO (=)"];

// Configura o Worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// 1. Carregar e Renderizar o PDF
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    pdfBytes = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 1.2 });
    const canvas = document.getElementById('pdf-canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport: viewport }).promise;
    document.getElementById('status').innerText = "Clique para: " + labels[0];
    clicks = []; // Reseta cliques ao subir novo PDF
});

// 2. Marcar Pontos
document.getElementById('pdf-canvas').addEventListener('click', (e) => {
    if (clicks.length >= 4) return;

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    clicks.push({ x, y, cw: rect.width, ch: rect.height });

    // Criar marcador visual
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

// 3. Gerar PDF e Calcular (O CORAÇÃO DO PROBLEMA)
document.getElementById('btnDownload').addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();

        const names = ['c1', 'c2', 'c3', 'res'];
        const fields = [];

        for (let i = 0; i < 4; i++) {
            const f = form.createTextField(names[i]);
            // Ajuste preciso de coordenadas
            const pdfX = (clicks[i].x * width) / clicks[i].cw;
            const pdfY = height - (clicks[i].y * height) / clicks[i].ch;
            
            f.addToPage(page, { x: pdfX, y: pdfY, width: 50, height: 20 });
            f.setText("0");
            fields.push(f);
        }

        // Lógica de Cálculo (JS do Acrobat)
        const calculationJS = `
            var v1 = Number(this.getField("c1").value);
            var v2 = Number(this.getField("c2").value);
            var v3 = Number(this.getField("c3").value);
            event.value = (v1 * v2) + v3;
        `;

        // Injetando a ação de cálculo no campo de resultado
        const resField = fields[3].acroField.dict;
        const docContext = pdfDoc.context;
        
        const actionDict = docContext.obj({
            Type: 'Action',
            S: 'JavaScript',
            JS: calculationJS
        });

        resField.set(PDFName.of('AA'), docContext.obj({
            C: actionDict
        }));

        // Salvar e Forçar Download
        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = "ficha_rpg_automatizada.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert("Download concluído! Teste os campos no seu leitor de PDF.");
    } catch (err) {
        console.error(err);
        alert("Erro ao gerar PDF: " + err.message);
    }
});
