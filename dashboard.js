let usuarioAtual = null;

auth.onAuthStateChanged(async (user) => {
    if (user) {
        usuarioAtual = user;
        document.querySelector('.user-name').innerText = user.displayName || "Engenheiro(a)";
        const iniciais = (user.displayName || "EN").split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
        document.querySelector('.avatar-iniciais').innerText = iniciais;
        
        await carregarKanban(user.uid);
    } else {
        window.location.href = 'index.html';
    }
});

async function carregarKanban(uid) {
    try {
        // Busca apenas as obras (não precisa mais buscar financeiro aqui)
        const obrasSnap = await db.collection("obras").where("idUsuario", "==", uid).get();

        let contPlan = 0, contAtivas = 0, contConcluidas = 0;

        const colPlan = document.getElementById('col-planejamento');
        const colAtiv = document.getElementById('col-ativas');
        const colConc = document.getElementById('col-concluidas');
        colPlan.innerHTML = ''; colAtiv.innerHTML = ''; colConc.innerHTML = '';

        obrasSnap.forEach(doc => {
            const obra = doc.data();
            const idObra = doc.id; // O ID secreto da obra no Firebase
            
            const status = obra.status || "ativa"; 
            const cidade = obra.cidade || "Feira de Santana";
            const valorFormat = parseFloat(obra.orcamentoInicial || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

            // O pulo do gato: onclick manda o ID para a nova página!
            const cardHTML = `
                <div class="obra-card" onclick="abrirDetalhes('${idObra}')">
                    <div class="obra-card-img default-bg"></div>
                    <div class="obra-card-body">
                        <div class="obra-card-title">${obra.nome}</div>
                        <div class="obra-card-city"><i class="fas fa-map-marker-alt"></i> ${cidade}</div>
                        <div class="obra-card-budget">${valorFormat}</div>
                    </div>
                </div>
            `;

            if (status === "planejamento") {
                colPlan.innerHTML += cardHTML;
                contPlan++;
            } else if (status === "concluida") {
                colConc.innerHTML += cardHTML;
                contConcluidas++;
            } else {
                colAtiv.innerHTML += cardHTML;
                contAtivas++;
            }
        });

        // Atualiza as bolinhas contadoras
        document.getElementById('count-plan').innerText = contPlan;
        document.getElementById('count-ativas').innerText = contAtivas;
        document.getElementById('count-concluidas').innerText = contConcluidas;

    } catch (error) {
        console.error("Erro ao carregar o Kanban:", error);
    }
}

// ==========================================
// FUNÇÃO PARA ABRIR O DASHBOARD INDIVIDUAL
// ==========================================
function abrirDetalhes(idObra) {
    // Redireciona o usuário para uma nova página e leva o ID da obra na URL
    window.location.href = `detalhes-obra.html?id=${idObra}`;
}
