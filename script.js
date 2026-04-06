const { PDFDocument, PDFName, PDFString } = window.PDFLib || {};

let pdfOriginalBytes = null; 
let clicks = [];
const labels = ["Campo 1 (X)", "Campo 2 (X)", "Campo 3 (+)", "Resultado (=)"];

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// 1. CARREGAMENTO COM CLONAGEM DE MEMÓRIA
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        // Guardamos o original intacto e usamos uma cópia para o preview
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
        
        // Reset de interface
        document.querySelectorAll('.marker').forEach(m => m.remove());
        clicks = [];
        document.getElementById('status').innerText = "Clique para: " + labels[0];
        document.getElementById('btnDownload').disabled = true;

    } catch (err) {
        alert("Erro ao carregar PDF: " + err.message);
    }
});

// 2. MAPEAMENTO VISUAL (IGUAL AO ANTERIOR)
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
        document.getElementById('status').innerText = "Pronto para gerar a ficha!";
        document.getElementById('btnDownload').disabled = false;
    } else {
        document.getElementById('status').innerText = "Clique para: " + labels[clicks.length];
    }
});

// 3. O CORAÇÃO DO CÁLCULO - DOWNLOAD E INJEÇÃO DE LÓGICA
document.getElementById('btnDownload').addEventListener('click', async () => {
    try {
        if (!pdfOriginalBytes) return alert("Suba um PDF primeiro.");

        // Criamos o documento a partir do clone para evitar erro de ArrayBuffer
        const pdfDoc = await PDFDocument.load(pdfOriginalBytes.slice(0));
        const form = pdfDoc.getForm();
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();

        const fieldNames = ['c1', 'c2', 'c3', 'res'];
        const createdFields = [];

        // Criar os campos nas coordenadas clicadas
        for (let i = 0; i < 4; i++) {
            const pos = clicks[i];
            const name = fieldNames[i];
            const f = form.createTextField(name);
            
            const pdfX = (pos.x * width) / pos.w;
            const pdfY = height - ((pos.y * height) / pos.h);

            f.addToPage(page, { x: pdfX, y: pdfY - 10, width: 60, height: 20 });
            f.setText("0"); // Valor inicial padrão
            createdFields.push(f);
        }

        // LÓGICA DE RPG: (Campo1 * Campo2) + Campo3 = Resultado
        // Usamos Number() para garantir que o PDF trate como conta matemática, não texto
        const calculationJS = `
            var v1 = this.getField("c1").value;
            var v2 = this.getField("c2").value;
            var v3 = this.getField("c3").value;
            event.value = (Number(v1) * Number(v2)) + Number(v3);
        `;

        const resField = createdFields[3];
        const docContext = pdfDoc.context;

        // REGISTRANDO A AÇÃO DE CÁLCULO (AA -> C)
        // Isso diz ao PDF: "Quando qualquer valor mudar, rode este script no campo de resultado"
        resField.acroField.dict.set(
            PDFName.of('AA'),
            docContext.obj({
                C: docContext.obj({
                    Type: 'Action',
                    S: 'JavaScript',
                    JS: calculationJS
                })
            })
        );

        // CONFIGURANDO A ORDEM DE CÁLCULO (CRUCIAL!)
        // O PDF precisa saber que 'res' depende dos outros. 
        // Adicionamos o campo de resultado no array de Ordem de Cálculo do formulário.
        const acroForm = pdfDoc.catalog.get(PDFName.of('AcroForm'));
        if (acroForm) {
            acroForm.set(PDFName.of('CO'), docContext.obj([resField.ref]));
        }

        const finalPdfBytes = await pdfDoc.save();
        
        // Executar download
        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = "ficha_automatizada_T20.pdf";
        document.body.appendChild(a);
        a.click();
        
        // Limpeza
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (err) {
        console.error(err);
        alert("Falha na geração: " + err.message);
    }
});
