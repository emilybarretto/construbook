let meuGrafico = null; // Variável para controlar o desenho do gráfico para não bugar

// =========================================================
// 1. VERIFICA LOGIN, ATUALIZA AVATAR E INICIA O SISTEMA
// =========================================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // --- A) ATUALIZAR O NOME E AS INICIAIS LÁ NO TOPO ---
        const nomeCompleto = user.displayName || "Engenheiro(a)";
        
        // Coloca o nome na tela
        const spanNome = document.querySelector('.user-name');
        if (spanNome) spanNome.textContent = nomeCompleto;

        // Calcula as iniciais
        let iniciais = "EN";
        if (nomeCompleto !== "Engenheiro(a)") {
            const partesNome = nomeCompleto.trim().split(" ");
            if (partesNome.length > 1) {
                // Primeira letra do 1º nome + Primeira letra do último nome
                iniciais = partesNome[0][0].toUpperCase() + partesNome[partesNome.length - 1][0].toUpperCase();
            } else {
                iniciais = nomeCompleto.substring(0, 2).toUpperCase();
            }
        }

        // Coloca as iniciais na bolinha azul
        const divAvatar = document.querySelector('.avatar-iniciais');
        if (divAvatar) divAvatar.textContent = iniciais;

        // --- B) PUXAR OS DADOS REAIS DO FIREBASE ---
        await carregarDadosDoDashboard(user.uid);

    } else {
        // Se não tiver logado, manda pro login
        window.location.href = 'index.html';
    }
});

// =========================================================
// 2. BUSCAR DADOS (OBRAS + FINANCEIRO)
// =========================================================
async function carregarDadosDoDashboard(idDoUsuario) {
    try {
        // --- A) BUSCANDO OBRAS ---
        const obrasRef = await db.collection("obras").where("idUsuario", "==", idDoUsuario).get();
        let totalDeObras = 0;
        let somaDoOrcamento = 0;

        const selectFiltro = document.getElementById('filtroObraDash');
        if (selectFiltro) {
            selectFiltro.innerHTML = '<option value="todas">Visão Geral (Portfólio Completo)</option>';
        }

        obrasRef.forEach((doc) => {
            const obra = doc.data();
            totalDeObras++;
            somaDoOrcamento += parseFloat(obra.orcamentoInicial) || 0;
            if (selectFiltro) selectFiltro.innerHTML += `<option value="${doc.id}">${obra.nome}</option>`;
        });

        // --- B) BUSCANDO DESPESAS (O NOVO PODER) ---
        const despesasRef = await db.collection("financeiro").where("idUsuario", "==", idDoUsuario).get();
        let totalExecutado = 0;
        
        // Criamos "baldes" vazios para somar o dinheiro de cada categoria
        const gastosPorCategoria = {
            'Fundação': 0, 'Alvenaria': 0, 'Acabamento': 0, 
            'Elétrica': 0, 'Hidráulica': 0, 'Estrutura': 0
        };

        despesasRef.forEach((doc) => {
            const despesa = doc.data();
            const valor = parseFloat(despesa.valor) || 0;
            
            totalExecutado += valor; // Soma no Montante Total Executado
            
            // Soma o valor no "balde" da categoria certa
            if (gastosPorCategoria[despesa.categoria] !== undefined) {
                gastosPorCategoria[despesa.categoria] += valor;
            }
        });

        // --- C) INJETAR OS NÚMEROS REAIS NA TELA ---
        if (document.getElementById('qtdObras')) {
            document.getElementById('qtdObras').innerText = totalDeObras;
        }
        if (document.getElementById('valorOrcado')) {
            document.getElementById('valorOrcado').innerText = somaDoOrcamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        if (document.getElementById('valorExecutado')) {
            document.getElementById('valorExecutado').innerText = totalExecutado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        // --- D) MANDAR DESENHAR O GRÁFICO REAL ---
        renderizarGrafico(gastosPorCategoria);

    } catch (error) {
        console.error("Erro ao puxar dados do Firebase para o Dashboard:", error);
    }
}

// =========================================================
// 3. DESENHAR O GRÁFICO (AGORA COM DADOS DO BANCO)
// =========================================================
function renderizarGrafico(gastos) {
    const canvas = document.getElementById('graficoDespesas');
    if (!canvas) return; 

    const ctx = canvas.getContext('2d');
    
    // Se o gráfico já existir, destrói para não ficar um por cima do outro se o usuário mudar o filtro
    if (meuGrafico) {
        meuGrafico.destroy();
    }

    // Organiza os valores na ordem exata que o gráfico pede
    const valoresReais = [
        gastos['Fundação'], gastos['Alvenaria'], gastos['Acabamento'], 
        gastos['Elétrica'], gastos['Hidráulica'], gastos['Estrutura']
    ];

    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Fundação', 'Alvenaria', 'Acabamento', 'Elétrica', 'Hidráulica', 'Estrutura'],
            datasets: [{
                data: valoresReais, // <-- A MÁGICA ACONTECE AQUI! DADOS DO FIREBASE!
                backgroundColor: ['#3b82f6', '#f97316', '#10b981', '#eab308', '#8b5cf6', '#64748b'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { font: { family: "'Inter', sans-serif", size: 12 } }
                }
            }
        }
    });
}
