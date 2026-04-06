document.getElementById('uploadPdf').addEventListener('change', function() {
    // Libera o botão de gerar quando o usuário envia um arquivo
    document.getElementById('gerarPdf').disabled = false;
});

document.getElementById('gerarPdf').addEventListener('click', async () => {
    const fileInput = document.getElementById('uploadPdf');
    if (fileInput.files.length === 0) return alert('Faça o upload do PDF primeiro!');

    const file = fileInput.files[0];
    const arrayBuffer = await file.arrayBuffer();

    // Carrega o PDF original que o usuário enviou
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    // Pega o formulário do PDF (ou cria um se não existir)
    const form = pdfDoc.getForm();
    const page = pdfDoc.getPage(0); // Pega a primeira página

    // 1. Cria o campo "Força" (Exemplo)
    const fieldForca = form.createTextField('forca');
    fieldForca.addToPage(page, { x: 50, y: 700, width: 50, height: 30 });
    fieldForca.setText('2'); // Valor inicial

    // 2. Cria o campo "Multiplicador" (Exemplo)
    const fieldMultiplicador = form.createTextField('multiplicador');
    fieldMultiplicador.addToPage(page, { x: 150, y: 700, width: 50, height: 30 });
    fieldMultiplicador.setText('3'); // Valor inicial

    // 3. Cria o campo de "Total" (Onde o cálculo vai aparecer)
    const fieldTotal = form.createTextField('total');
    fieldTotal.addToPage(page, { x: 250, y: 700, width: 50, height: 30 });

    // --- A LÓGICA DE CÁLCULO DENTRO DO PDF ---
    // O pdf-lib padrão não tem uma função simples como "fieldTotal.setFormula(...)". 
    // Precisamos injetar o JavaScript do Acrobat PDF "na unha" usando dicionários do PDF.
    
    const acroField = fieldTotal.acroField;
    const docContext = pdfDoc.context;

    // Criamos a ação de cálculo em JavaScript do PDF (Força * Multiplicador)
    const calculateAction = docContext.obj({
        Type: 'Action',
        S: 'JavaScript',
        JS: 'var f = this.getField("forca").value; var m = this.getField("multiplicador").value; event.value = f * m;'
    });

    // Injetamos a ação no dicionário de Ações Adicionais (/AA) do campo "total"
    acroField.dict.set(PDFLib.PDFName.of('AA'), docContext.obj({
        C: calculateAction // 'C' significa Calculation (Cálculo)
    }));
    // -----------------------------------------

    // Salva o PDF modificado
    const pdfBytes = await pdfDoc.save();

    // Faz o download do arquivo pro usuário
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Ficha_Calculada.pdf';
    link.click();
});
