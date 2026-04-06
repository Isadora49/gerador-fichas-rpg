const { PDFDocument, PDFName } = window.PDFLib || {};

let pdfBytesOriginal = null; // Cópia de segurança
let clicks = [];
const labels = ["Campo 1 (X)", "Campo 2 (X)", "Campo 3 (+)", "Resultado (=)"];

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// 1. Carregamento com Cópia de Segurança
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // CORREÇÃO AQUI: Criamos uma cópia para o PDF.js e guardamos a original intacta
        pdfBytesOriginal = new Uint8Array(arrayBuffer.slice(0)); 
        
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.getElementById('pdf-canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        document.getElementById('status').innerText = "Clique para: " + labels[0];
        
        // Limpa marcações antigas se houver
        document.querySelectorAll('.marker').forEach(m => m.remove());
        clicks = []; 
    } catch (err) {
        alert("Erro ao carregar PDF: " + err.message);
    }
});

// 2. Marcação dos Campos (Mantido)
document.getElementById('pdf-canvas').addEventListener('click', (e) => {
    if (clicks.length >= 4) return;

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    clicks.push({ x, y, w: rect.width, h: rect.height });

    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.left = e.pageX + 'px';
    marker.style.top = e.pageY + 'px';
    marker.style.position = 'absolute';
    marker.style.background = 'red';
    marker.style.color = 'white';
    marker.style.padding = '2px';
    marker.innerText = labels[clicks.length - 1];
    document.body.appendChild(marker);

    if (clicks.length === 4) {
        document.getElementById('status').innerText = "Pronto para baixar!";
        document.getElementById('btnDownload').disabled = false;
    } else {
        document.getElementById('status').innerText = "Clique para: " + labels[clicks.length];
    }
});

// 3. Geração do PDF Corrigida
document.getElementById('btnDownload').addEventListener('click', async () => {
    try {
        if (!pdfBytesOriginal) throw new Error("Dados do PDF perdidos!");

        // Usamos a cópia de segurança (Uint8Array) para carregar o documento
        const pdfDoc = await PDFDocument.load(pdfBytesOriginal);
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();

        const fieldNames = ['c1', 'c2', 'c3', 'res'];
        
        for (let i = 0; i < 4; i++) {
            const pos = clicks[i];
            const f = form.createTextField(fieldNames[i]);
            
            const pdfX = (pos.x * width) / pos.w;
            const pdfY = height - ((pos.y * height) / pos.h);

            f.addToPage(page, { x: pdfX, y: pdfY - 10, width: 50, height: 20 });
            f.setText("0");

            // Se for o campo de resultado (índice 3), injeta a lógica (C1 * C2) + C3
            if (i === 3) {
                const jsAction = `
                    var v1 = Number(this.getField("c1").value) || 0;
                    var v2 = Number(this.getField("c2").value) || 0;
                    var v3 = Number(this.getField("c3").value) || 0;
                    event.value = (v1 * v2) + v3;
                `;
                f.acroField.dict.set(
                    PDFName.of('AA'),
                    pdfDoc.context.obj({
                        C: pdfDoc.context.obj({
                            Type: 'Action', S: 'JavaScript', JS: jsAction
                        })
                    })
                );
            }
        }

        const finalPdfBytes = await pdfDoc.save();
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "ficha_T20_calculavel.pdf";
        a.click();
    } catch (err) {
        alert("Erro ao gerar: " + err.message);
    }
});
