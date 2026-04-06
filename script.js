const { PDFDocument, PDFName, PDFString } = window.PDFLib || {};

let pdfOriginalBytes = null; 
let clicks = [];
const labels = ["Campo 1 (X)", "Campo 2 (X)", "Campo 3 (+)", "Resultado (=)"];

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// 1. CARREGAMENTO SEGURO
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfOriginalBytes = arrayBuffer.slice(0); 
        const previewBytes = arrayBuffer.slice(0);

        const loadingTask = pdfjsLib.getDocument({ data: previewBytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.getElementById('pdf-canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        document.querySelectorAll('.marker').forEach(m => m.remove());
        clicks = [];
        document.getElementById('status').innerText = "Clique para: " + labels[0];
        document.getElementById('btnDownload').disabled = true;
    } catch (err) {
        alert("Erro ao carregar PDF: " + err.message);
    }
});

// 2. MARCAÇÃO DE CAMPOS
document.getElementById('pdf-canvas').addEventListener('click', (e) => {
    if (clicks.length >= 4 || !pdfOriginalBytes) return;
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    clicks.push({ x, y, w: rect.width, h: rect.height });

    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.left = e.pageX + 'px';
    marker.style.top = e.pageY + 'px';
    marker.style.position = 'absolute';
    marker.style.background = '#e74c3c';
    marker.style.color = 'white';
    marker.style.padding = '4px';
    marker.style.borderRadius = '4px';
    marker.style.zIndex = "100";
    marker.innerText = labels[clicks.length - 1];
    document.body.appendChild(marker);

    if (clicks.length === 4) {
        document.getElementById('status').innerText = "Pronto para baixar!";
        document.getElementById('btnDownload').disabled = false;
    } else {
        document.getElementById('status').innerText = "Clique para: " + labels[clicks.length];
    }
});

// 3. DOWNLOAD + CÁLCULO (CHROME/EDGE COMPATÍVEL)
document.getElementById('btnDownload').addEventListener('click', async () => {
    try {
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        const docContext = pdfDoc.context;

        const fieldNames = ['c1', 'c2', 'c3', 'res'];
        const fields = [];

        for (let i = 0; i < 4; i++) {
            const f = form.createTextField(fieldNames[i]);
            const pos = clicks[i];
            const pdfX = (pos.x * width) / pos.w;
            const pdfY = height - ((pos.y * height) / pos.h);

            f.addToPage(page, { x: pdfX, y: pdfY - 10, width: 60, height: 20 });
            f.setText("0");
            fields.push(f);
        }

        // LÓGICA DE CÁLCULO (Sintaxe robusta para navegadores)
        const calculationJS = `
            var v1 = this.getField("c1").value;
            var v2 = this.getField("c2").value;
            var v3 = this.getField("c3").value;
            var n1 = isNaN(parseFloat(v1)) ? 0 : parseFloat(v1);
            var n2 = isNaN(parseFloat(v2)) ? 0 : parseFloat(v2);
            var n3 = isNaN(parseFloat(v3)) ? 0 : parseFloat(v3);
            event.value = (n1 * n2) + n3;
        `;

        const resField = fields[3];

        // INJEÇÃO MANUAL DO GATILHO DE CÁLCULO
        // Criamos o objeto de ação JavaScript
        const jsAction = docContext.obj({
            Type: 'Action',
            S: 'JavaScript',
            JS: PDFString.of(calculationJS),
        });

        // Adicionamos ao dicionário AA (Additional Actions) do campo de resultado
        resField.acroField.dict.set(
            PDFName.of('AA'),
            docContext.obj({
                C: jsAction // 'C' para Calculate
            })
        );

        // CONFIGURAÇÃO DO FORMULÁRIO (Essencial para o Chrome ativar o JS)
        const acroForm = pdfDoc.catalog.get(PDFName.of('AcroForm'));
        if (acroForm) {
            const acroFormDict = docContext.lookup(acroForm);
            
            // Define a Ordem de Cálculo (CO) - O navegador precisa saber quem calcular
            acroFormDict.set(PDFName.of('CO'), docContext.obj([resField.ref]));
            
            // NeedAppearances ajuda o Chrome a renderizar os valores novos
            acroFormDict.set(PDFName.of('NeedAppearances'), docContext.obj(true));
        }

        const finalPdfBytes = await pdfDoc.save();
        
        // EXECUÇÃO DO DOWNLOAD
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "ficha_rpg_calculavel.pdf";
        document.body.appendChild(a);
        a.click();
        
        // Limpeza de memória
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 1000);

    } catch (err) {
        console.error(err);
        alert("Erro na geração: " + err.message);
    }
});
