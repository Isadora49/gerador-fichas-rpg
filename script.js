const { PDFDocument, PDFName } = window.PDFLib || {};

let pdfDataBackup = null; // Vamos guardar uma cópia viva aqui
let clicks = [];
const labels = ["Campo 1 (X)", "Campo 2 (X)", "Campo 3 (+)", "Resultado (=)"];

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// 1. Carregamento e Cópia de Segurança
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        // Criamos um ArrayBuffer e IMEDIATAMENTE tiramos uma cópia (slice)
        // Isso evita o erro de "detached ArrayBuffer"
        const originalBuffer = await file.arrayBuffer();
        pdfDataBackup = originalBuffer.slice(0); 

        const loadingTask = pdfjsLib.getDocument({ data: originalBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.getElementById('pdf-canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        // Limpar marcações antigas se houver
        document.querySelectorAll('.marker').forEach(m => m.remove());
        clicks = [];
        document.getElementById('status').innerText = "Clique para: " + labels[0];
        document.getElementById('btnDownload').disabled = true;

    } catch (err) {
        alert("Erro ao carregar: " + err.message);
    }
});

// 2. Marcação (Clique)
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
    marker.innerText = labels[clicks.length - 1];
    document.body.appendChild(marker);

    if (clicks.length === 4) {
        document.getElementById('status').innerText = "Tudo pronto!";
        document.getElementById('btnDownload').disabled = false;
    } else {
        document.getElementById('status').innerText = "Clique para: " + labels[clicks.length];
    }
});

// 3. Download (A parte que estava dando erro)
document.getElementById('btnDownload').addEventListener('click', async () => {
    try {
        if (!pdfDataBackup) return alert("Suba o PDF novamente.");

        // Usamos a CÓPIA do buffer, assim ele nunca está "detached"
        const pdfDoc = await PDFDocument.load(pdfDataBackup.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();

        const names = ['c1', 'c2', 'c3', 'res'];
        const fields = [];

        for (let i = 0; i < 4; i++) {
            const pos = clicks[i];
            const f = form.createTextField(names[i]);
            const pdfX = (pos.x * width) / pos.w;
            const pdfY = height - ((pos.y * height) / pos.h);

            f.addToPage(page, { x: pdfX, y: pdfY - 10, width: 60, height: 20 });
            f.setText("0");
            fields.push(f);
        }

        // Lógica: (C1 * C2) + C3
        const jsAction = `
            var v1 = Number(this.getField("c1").value) || 0;
            var v2 = Number(this.getField("c2").value) || 0;
            var v3 = Number(this.getField("c3").value) || 0;
            this.getField("res").value = (v1 * v2) + v3;
        `;

        const resField = fields[3];
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

        const finalBytes = await pdfDoc.save();
        const blob = new Blob([finalBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "ficha_tormenta_automatizada.pdf";
        a.click();
        URL.revokeObjectURL(url);

    } catch (err) {
        alert("Erro crítico: " + err.message);
        console.error(err);
    }
});
