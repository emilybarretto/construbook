// Variável Global
let usuarioAtual = null;

// =========================================================
// FUNÇÕES DE FORMATAÇÃO (O "TAPINHA" NO VISUAL)
// =========================================================
const formatarMoeda = (valor) => {
    return parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatarStatus = (status) => {
    const statusMap = {
        'afazer': 'A Fazer',
        'andamento': 'Em Andamento',
        'concluido': 'Concluído'
    };
    return statusMap[status.toLowerCase()] || status;
};

// =========================================================
// 1. MONITOR DE LOGIN
// =========================================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        usuarioAtual = user; 
        document.querySelector('.user-name').innerText = user.displayName || "Engenheiro(a)";
        const iniciais = (user.displayName || "EN").split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
        document.querySelector('.avatar-iniciais').innerText = iniciais;
        await carregarObrasNoSelect();
    } else {
        window.location.href = 'index.html';
    }
});

async function carregarObrasNoSelect() {
    const select = document.getElementById('obraSelectRelatorio');
    if (!select) return;
    const snapshot = await db.collection("obras").where("idUsuario", "==", usuarioAtual.uid).get();
    select.innerHTML = '<option value="">-- Escolha uma Obra --</option>';
    snapshot.forEach(doc => {
        select.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
    });
}

// =========================================================
// 2. GERAÇÃO DO PDF (COM CORREÇÃO DE IMAGEM)
// =========================================================
document.getElementById('btnGerarPDF').addEventListener('click', async () => {
    const idObra = document.getElementById('obraSelectRelatorio').value;
    if (!idObra) return alert("Selecione uma obra!");

    const btn = document.getElementById('btnGerarPDF');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;

    try {
        const obraDoc = await db.collection("obras").doc(idObra).get();
        const obra = obraDoc.data();
        const financeiroSnap = await db.collection("financeiro").where("idObra", "==", idObra).get();
        const etapasSnap = await db.collection("etapas").where("idObra", "==", idObra).get();

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // PÁGINA 1: DADOS
        doc.setFontSize(22);
        doc.setTextColor(30, 41, 59);
        doc.text("Relatório Consolidado de Engenharia", 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Obra: ${obra.nome} | CEP: ${obra.cep || 'N/A'}`, 14, 30);
        doc.line(14, 35, 196, 35);

        // 1. FINANCEIRO (Corrigido: Moeda pt-BR)
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("1. Resumo Financeiro", 14, 45);

        let totalSoma = 0;
        const dadosFin = [];
        financeiroSnap.forEach(d => {
            const g = d.data();
            totalSoma += parseFloat(g.valor || 0);
            dadosFin.push([g.descricao, g.categoria, formatarMoeda(g.valor)]);
        });

        doc.autoTable({
            startY: 50,
            head: [['Descrição', 'Categoria', 'Valor']],
            body: dadosFin,
            foot: [['TOTAL', '', formatarMoeda(totalSoma)]],
            headStyles: { fillColor: [44, 62, 80] },
            footStyles: { fillColor: [44, 62, 80] }
        });

        // 2. ETAPAS (Corrigido: Status amigável)
        const yEtapa = doc.lastAutoTable.finalY + 15;
        doc.text("2. Cronograma de Etapas", 14, yEtapa);
        
        const dadosEtapas = [];
        etapasSnap.forEach(e => {
            const et = e.data();
            dadosEtapas.push([et.nome, formatarStatus(et.status)]);
        });

        doc.autoTable({
            startY: yEtapa + 5,
            head: [['Atividade', 'Status']],
            body: dadosEtapas,
            headStyles: { fillColor: [34, 197, 94] }
        });

        // --- PÁGINA 2: ANEXO FOTOGRÁFICO ---
        // Filtra apenas o que tem o texto da imagem (Base64)
        const etapasComFoto = etapasSnap.docs.filter(d => d.data().foto && d.data().foto.includes('base64'));

        console.log("Etapas encontradas com foto:", etapasComFoto.length);

        if (etapasComFoto.length > 0) {
            doc.addPage();
            doc.setFontSize(18);
            doc.text("3. Anexo Fotográfico", 14, 22);
            doc.line(14, 25, 196, 25);

            let xPos = 14;
            let yPos = 35;
            let contador = 0;

            for (const docEtapa of etapasComFoto) {
                const etapa = docEtapa.data();
                
                doc.setFontSize(10);
                doc.text(`Tarefa: ${etapa.nome}`, xPos, yPos - 3);
                
                try {
                    // Tenta desenhar a imagem
                    doc.addImage(etapa.foto, 'JPEG', xPos, yPos, 85, 60);
                    console.log("Foto renderizada com sucesso:", etapa.nome);
                } catch (err) {
                    console.error("Erro ao colocar foto no PDF:", err);
                    doc.text("[Erro ao renderizar esta imagem]", xPos, yPos + 10);
                }

                contador++;
                // Organiza em 2 colunas
                if (contador % 2 === 0) {
                    xPos = 14;
                    yPos += 75;
                } else {
                    xPos = 105;
                }

                // Se estourar a página, pula
                if (yPos > 240) {
                    doc.addPage();
                    yPos = 35;
                    xPos = 14;
                    contador = 0;
                }
            }
        }

        doc.save(`Relatorio_${obra.nome}.pdf`);

    } catch (error) {
        console.error("Erro Geral:", error);
        alert("Erro ao gerar PDF. Verifique o console (F12).");
    } finally {
        btn.innerHTML = '<i class="fas fa-file-pdf"></i> Gerar e Baixar PDF';
        btn.disabled = false;
    }
});