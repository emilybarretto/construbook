// 1. Variável Global - Agora ela vai receber o valor corretamente
let usuarioAtual = null;

// =========================================================
// 1. VERIFICA LOGIN E INICIA A TELA
// =========================================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // CORREÇÃO AQUI: Agora a variável global sabe quem é o usuário
        usuarioAtual = user; 

        const nomeCompleto = user.displayName || "Engenheiro(a)";
        
        // Atualiza a Topbar
        const elNome = document.querySelector('.user-name');
        if (elNome) elNome.innerText = nomeCompleto;

        const elAvatar = document.querySelector('.avatar-iniciais');
        if (elAvatar) {
            const iniciais = nomeCompleto.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
            elAvatar.innerText = iniciais || "EN";
        }
        
        // CORREÇÃO AQUI: Chamando a função para carregar as obras agora que o usuário logou!
        await carregarObrasNoFiltro();

    } else {
        window.location.href = 'index.html';
    }
});

// =========================================================
// 2. BUSCAR AS OBRAS DO USUÁRIO PARA O SELECT
// =========================================================
async function carregarObrasNoFiltro() {
    const selectObra = document.getElementById('obraSelectCompras');
    if (!selectObra) return;

    try {
        // Busca as obras filtrando pelo ID do usuário logado
        const snapshot = await db.collection("obras").where("idUsuario", "==", usuarioAtual.uid).get();
        
        if (snapshot.empty) {
            selectObra.innerHTML = '<option value="">Nenhuma obra encontrada.</option>';
            return;
        }

        selectObra.innerHTML = '<option value="">-- Escolha uma Obra --</option>';
        snapshot.forEach((doc) => {
            const obra = doc.data();
            selectObra.innerHTML += `<option value="${doc.id}">${obra.nome}</option>`;
        });
    } catch (error) {
        console.error("Erro ao buscar obras:", error);
        selectObra.innerHTML = '<option value="">Erro ao carregar obras.</option>';
    }
}

// =========================================================
// 3. OUVINTE: DESENHAR A TABELA QUANDO ESCOLHER A OBRA
// =========================================================
document.getElementById('obraSelectCompras')?.addEventListener('change', async function() {
    const idDaObraSelecionada = this.value; 
    const tbodyMateriais = document.getElementById('listaDeMateriais');

    if (!idDaObraSelecionada) {
        tbodyMateriais.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 30px;">Selecione uma obra acima para carregar a lista do banco de dados.</td></tr>`;
        return;
    }

    tbodyMateriais.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px;"><i class="fas fa-spinner fa-spin"></i> Buscando suprimentos na nuvem...</td></tr>`;

    try {
        const docRef = await db.collection("obras").doc(idDaObraSelecionada).get();
        
        if (docRef.exists) {
            const obra = docRef.data();
            // Pega a lista de itens que foi salva no orçamento lá na "Nova Obra"
            const listaItens = obra.itens || []; 

            if (listaItens.length === 0) {
                tbodyMateriais.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #f97316; font-weight: bold; padding: 30px;">Nenhum material foi orçado para esta obra.</td></tr>`;
                return;
            }

            tbodyMateriais.innerHTML = '';

            listaItens.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid #f1f5f9"; 
                
                // Cálculo do valor baseado no que veio da coleção Obras
                const valorCalculado = (item.quantidade || 0) * (item.valorUnitario || item.val || 0);
                const valorFormatado = valorCalculado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const codPedido = `#PED-${(index + 1).toString().padStart(3, '0')}`;

                const statusAtual = item.statusLogistico || "Pendente"; 
                
                let corFundo, corTexto, textoBadge;

                if (statusAtual === "Comprado") {
                    corFundo = "#dcfce7"; // Verde clarinho
                    corTexto = "#166534"; // Verde escuro
                    textoBadge = "✓ Comprado / Entregue";
                } else {
                    corFundo = "#fef08a"; // Amarelinho
                    corTexto = "#854d0e"; // Marrom escuro
                    textoBadge = "⏳ Pendente";
                }

                tr.innerHTML = `
                    <td style="color: #64748b; font-weight: 600; padding: 15px 10px;">${codPedido}</td>
                    <td style="font-weight: 600; color: #1e293b; padding: 15px 10px;">${item.descricao || item.desc}</td>
                    <td style="text-align: center; padding: 15px 10px;">${item.quantidade || item.qtd} ${item.unidade || 'un'}</td>
                    <td style="color: #3b82f6; font-weight: 600; text-align: right; padding: 15px 10px;">${valorFormatado}</td>
                    <td style="text-align: center; padding: 15px 10px;">
                        <span onclick="mudarStatusCompra('${idDaObraSelecionada}', ${index}, '${statusAtual}')" 
                              style="background-color: ${corFundo}; padding: 8px 15px; border-radius: 20px; font-size: 12px; font-weight: 700; color: ${corTexto}; cursor: pointer; transition: 0.3s; display: inline-block;">
                            ${textoBadge}
                        </span>
                    </td>
                `;
                tbodyMateriais.appendChild(tr);
            });
        }
    } catch (error) {
        console.error("Erro ao puxar itens:", error);
    }
});

// =========================================================
// 4. FUNÇÃO QUE ATUALIZA O STATUS DO MATERIAL
// =========================================================
window.mudarStatusCompra = async function(idObra, indexDoItem, statusAtual) {
    try {
        const novoStatus = statusAtual === "Pendente" ? "Comprado" : "Pendente";
        const docRef = db.collection("obras").doc(idObra);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const obra = docSnap.data();
            let listaItensAtualizada = [...obra.itens]; // Cópia da lista

            // Atualiza o status logístico do item específico
            listaItensAtualizada[indexDoItem].statusLogistico = novoStatus;

            await docRef.update({ itens: listaItensAtualizada });

            // Simula a mudança no select para redesenhar a tabela na hora
            document.getElementById('obraSelectCompras').dispatchEvent(new Event('change'));
        }
    } catch (error) {
        console.error("Erro ao mudar status:", error);
        alert("Erro ao atualizar o banco de dados.");
    }
};

// =========================================================
// 5. BOTÃO SOLICITAR COTAÇÃO
// =========================================================
const btnCotacao = document.getElementById('btnCotacao');
if(btnCotacao) {
    btnCotacao.addEventListener('click', () => {
        const obraSelecionada = document.getElementById('obraSelectCompras').value;
        if (!obraSelecionada) {
            alert("Por favor, selecione uma obra primeiro!");
            return;
        }
        if (confirm("Deseja buscar fornecedores próximos no Google Maps?")) {
            window.open('https://www.google.com.br/maps/search/materiais+de+construção', '_blank');
        }
    });
}