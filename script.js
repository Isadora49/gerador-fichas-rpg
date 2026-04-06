// Garantindo acesso à biblioteca
const { PDFDocument, PDFName } = window.PDFLib || {};

let savedPdfBytes = null; // Cópia de segurança para o download
let clicks = [];
const labels = ["Campo 1 (X)", "Campo 2 (X)", "Campo 3 (+)", "Resultado (=)"];

// Configura o worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// 1. Carregamento do Arquivo com Proteção de Dados
document.getElementById('uploadPdf').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // CRUCIAL: Criamos uma cópia (slice) para evitar que o buffer seja "detached" (desconectado)
        savedPdfBytes = arrayBuffer.slice(0); 
        
        // Usamos outra cópia para a visualização no canvas
        const viewBuffer = arrayBuffer.slice(0);
        const loadingTask = pdfjsLib.getDocument({ data: viewBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.getElementById('pdf-canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        // Reset de estado
        clicks = [];
        document.querySelectorAll('.marker').forEach(m => m.remove());
        document.getElementById('status').innerText = "Clique para: " + labels[0];
        document.getElementById('btnDownload').disabled = true;

    } catch (err) {
        alert("Erro ao carregar PDF: " + err.message);
    }
});

// 2. Marcação dos Campos (Captura de coordenadas)
document.getElementById('pdf-canvas').addEventListener('click', (e) => {
    if (clicks.length >= 4 || !savedPdfBytes) return;

    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    clicks.push({ x, y, w: rect.width, h: rect.height });

    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.left = e
