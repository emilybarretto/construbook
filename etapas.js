// Variáveis Globais
let obraSelecionadaId = "";
let idEtapaAtual = ""; 
let unsubscribeEtapas = null; // Para parar de ouvir atualizações quando trocar de obra

// =========================================================
// 1. LOGIN E TOPBAR
// =========================================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const nome = user.displayName || "Engenheiro(a)";
        if (document.querySelector('.user-name')) document.querySelector('.user-name').textContent = nome;
        
        const iniciais = nome.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
        if (document.querySelector('.avatar-iniciais')) document.querySelector('.avatar-iniciais').textContent = iniciais;

        await carregarObrasSelect(user.uid);
    } else {
        window.location.href = 'index.html';
    }
});

// =========================================================
// 2. CARREGAR OBRAS NO SELECT
// =========================================================
async function carregarObrasSelect(uid) {
    const select = document.getElementById('obraSelectEtapas');
    if (!select) return;

    try {
        const snapshot = await db.collection("obras").where("idUsuario", "==", uid).get();
        
        select.innerHTML = '<option value="">-- Selecione uma Obra --</option>';
        if (snapshot.empty) {
            select.innerHTML = '<option value="">Nenhuma obra cadastrada</option>';
            return;
        }

        snapshot.forEach(doc => {
            select.innerHTML += `<option value="${doc.id}">${doc.data().nome}</option>`;
        });

        select.addEventListener('change', (e) => {
            obraSelecionadaId = e.target.value;
            if (obraSelecionadaId) {
                ativarRealtimeKanban();
            } else {
                limparColunas();
            }
        });
    } catch (error) {
        console.error("Erro ao carregar obras:", error);
    }
}

// =========================================================
// 3. QUADRO KANBAN EM TEMPO REAL (onSnapshot)
// =========================================================
function ativarRealtimeKanban() {
    // Se já houver uma escuta ativa de outra obra, cancela ela
    if (unsubscribeEtapas) unsubscribeEtapas();

    const colunas = {
        afazer: document.getElementById('colunaAFazer'),
        andamento: document.getElementById('colunaEmAndamento'),
        concluido: document.getElementById('colunaConcluido')
    };

    // Escuta mudanças no Firestore em tempo real
    unsubscribeEtapas = db.collection("etapas")
        .where("idObra", "==", obraSelecionadaId)
        .onSnapshot((snapshot) => {
            limparColunas();
            
            snapshot.forEach(doc => {
                const etapa = doc.data();
                const card = criarCardEtapa(doc.id, etapa);
                if (colunas[etapa.status]) colunas[etapa.status].appendChild(card);
            });
        }, (error) => {
            console.error("Erro no Realtime Kanban:", error);
        });
}

// Função auxiliar para criar o HTML do card
function criarCardEtapa(id, etapa) {
    const div = document.createElement('div');
    div.className = "kanban-card"; // Recomendo adicionar este estilo no CSS
    div.style = "background:white; padding:15px; border-radius:10px; box-shadow:0 4px 6px rgba(0,0,0,0.05); border-left:5px solid #3b82f6; position:relative; margin-bottom:12px;";
    
    div.innerHTML = `
        <p style="font-weight:700; color:#1e293b; margin-bottom:10px; font-size:14px;">${etapa.nome}</p>
        
        ${etapa.foto ? `<img src="${etapa.foto}" style="width:100%; border-radius:6px; margin-bottom:10px; cursor:pointer;" onclick="window.open('${etapa.foto}')">` : ''}
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
            <button onclick="abrirModalFoto('${id}', '${etapa.nome}')" style="border:none; background:#eff6ff; color:#3b82f6; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:700;">
                <i class="fas fa-camera"></i> Foto
            </button>
            
            <select onchange="atualizarStatusTarefa('${id}', this.value)" style="font-size:11px; padding:5px; border-radius:6px; border:1px solid #cbd5e1; background:#f8fafc; cursor:pointer;">
                <option value="afazer" ${etapa.status === 'afazer' ? 'selected' : ''}>A Fazer</option>
                <option value="andamento" ${etapa.status === 'andamento' ? 'selected' : ''}>Andamento</option>
                <option value="concluido" ${etapa.status === 'concluido' ? 'selected' : ''}>Concluído</option>
            </select>
        </div>
        
        <button onclick="deletarTarefa('${id}')" style="position:absolute; top:10px; right:10px; border:none; background:none; color:#cbd5e1; cursor:pointer;">
            <i class="fas fa-trash"></i>
        </button>
    `;
    return div;
}

function limparColunas() {
    document.getElementById('colunaAFazer').innerHTML = "";
    document.getElementById('colunaEmAndamento').innerHTML = "";
    document.getElementById('colunaConcluido').innerHTML = "";
}

// =========================================================
// 4. LÓGICA DE FOTOS (BASE64 COM COMPRESSÃO - BYPASS STORAGE)
// =========================================================
document.getElementById('btnSalvarFoto').addEventListener('click', async () => {
    const file = document.getElementById('inputFotoEtapa').files[0];
    const btn = document.getElementById('btnSalvarFoto');

    if (!file) return alert("Selecione uma imagem!");

    btn.innerText = "Processando...";
    btn.disabled = true;

    try {
        // Converte e comprime a imagem para não estourar o limite do Firestore (1MB)
        const base64 = await comprimirImagem(file);

        await db.collection("etapas").doc(idEtapaAtual).update({
            foto: base64
        });

        fecharModal();
        alert("📸 Foto salva no diário!");
    } catch (error) {
        console.error(error);
        alert("Erro ao processar foto.");
    } finally {
        btn.innerText = "Enviar Foto";
        btn.disabled = false;
    }
});

// Função mágica para comprimir imagem e transformar em texto (Base64)
function comprimirImagem(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Redimensiona para 800px para economizar espaço
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Retorna a imagem em qualidade média (0.7)
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// =========================================================
// 5. AÇÕES (STATUS, DELETAR, ADICIONAR)
// =========================================================
async function atualizarStatusTarefa(id, novoStatus) {
    await db.collection("etapas").doc(id).update({ status: novoStatus });
}

async function deletarTarefa(id) {
    if (confirm("Excluir esta tarefa?")) await db.collection("etapas").doc(id).delete();
}

document.getElementById('btnAdicionarEtapa').addEventListener('click', async () => {
    const input = document.getElementById('novaEtapaInput');
    const nome = input.value.trim();

    if (!obraSelecionadaId || !nome) return alert("Selecione a obra e digite a tarefa!");

    await db.collection("etapas").add({
        idObra: obraSelecionadaId,
        nome: nome,
        status: "afazer",
        foto: "",
        dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = "";
});

function abrirModalFoto(id, nome) {
    idEtapaAtual = id;
    document.getElementById('nomeEtapaModal').innerText = nome;
    document.getElementById('modalFoto').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('modalFoto').style.display = 'none';
    document.getElementById('inputFotoEtapa').value = "";
}