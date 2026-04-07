let usuarioAtual = null;
let obrasCache = [];

auth.onAuthStateChanged(async user => {
    if (user) {
        usuarioAtual = user;
        if (document.querySelector('.user-name')) document.querySelector('.user-name').innerText = user.displayName || "Engenheiro(a)";
        const iniciais = (user.displayName || "EN").split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
        if (document.querySelector('.avatar-iniciais')) document.querySelector('.avatar-iniciais').innerText = iniciais;
        // Carregar obras para o seletor
        const snap = await db.collection("obras").where("idUsuario", "==", usuarioAtual.uid).get();
        snap.forEach(doc => obrasCache.push({ id: doc.id, ...doc.data() }));
        obrasCache.sort((a, b) => a.nome.localeCompare(b.nome));
        await carregarFornecedores();
    } else { window.location.href = 'index.html'; }
});

function popularSelectObras(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione uma obra...</option>';
    obrasCache.forEach(o => {
        sel.innerHTML += `<option value="${o.id}">${o.nome}</option>`;
    });
}

function getNomeObra(idObra) {
    if (!idObra) return 'Global';
    const obra = obrasCache.find(o => o.id === idObra);
    return obra ? obra.nome : '—';
}

const iconesCat = { "Material Básico":"fa-cubes","Elétrica":"fa-bolt","Hidráulica":"fa-faucet","Acabamento":"fa-paint-roller","Ferramentas":"fa-hammer","Equipamentos":"fa-truck-monster","Tintas":"fa-fill-drip","Piso e Revestimento":"fa-th-large","Outro":"fa-store" };
const coresCat = { "Material Básico":"#3b82f6","Elétrica":"#f59e0b","Hidráulica":"#06b6d4","Acabamento":"#8b5cf6","Ferramentas":"#ef4444","Equipamentos":"#10b981","Tintas":"#ec4899","Piso e Revestimento":"#f97316","Outro":"#64748b" };

async function carregarFornecedores() {
    const snap = await db.collection("fornecedores").where("idUsuario","==",usuarioAtual.uid).get();
    const grid = document.getElementById('gridFornecedores');
    if (snap.empty) {
        grid.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:60px;grid-column:1/-1;"><i class="fas fa-truck" style="font-size:48px;opacity:0.2;margin-bottom:12px;display:block;"></i>Nenhum fornecedor cadastrado.</div>';
        return;
    }
    grid.innerHTML = '';
    snap.forEach(doc => {
        const f = doc.data();
        const cat = f.categoria || "Outro";
        const icone = iconesCat[cat] || "fa-store";
        const cor = coresCat[cat] || "#64748b";
        const nomeObra = getNomeObra(f.idObra);
        const isGlobal = !f.idObra;
        grid.innerHTML += `<div class="fornecedor-card" style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:24px;transition:all 0.2s;position:relative;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <div style="width:44px;height:44px;border-radius:12px;background:${cor}15;display:flex;align-items:center;justify-content:center;font-size:18px;color:${cor};"><i class="fas ${icone}"></i></div>
                <div><h4 style="margin:0;font-size:15px;color:#1e293b;">${f.nome}</h4><span class="badge-categoria">${cat}</span></div>
            </div>
            <div style="margin-bottom:10px;">
                ${isGlobal ? '<span class="badge-global"><i class="fas fa-globe" style="margin-right:4px;"></i>Global</span>' : `<span class="badge-obra"><i class="fas fa-building" style="margin-right:4px;"></i>${nomeObra}</span>`}
            </div>
            <div style="font-size:13px;color:#64748b;line-height:1.8;">
                ${f.telefone ? `<div><i class="fas fa-phone" style="width:16px;margin-right:8px;color:#94a3b8;"></i>${f.telefone}</div>` : ''}
                ${f.email ? `<div><i class="fas fa-envelope" style="width:16px;margin-right:8px;color:#94a3b8;"></i>${f.email}</div>` : ''}
                ${f.endereco ? `<div><i class="fas fa-map-marker-alt" style="width:16px;margin-right:8px;color:#94a3b8;"></i>${f.endereco}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;margin-top:14px;padding-top:14px;border-top:1px solid #f1f5f9;">
                <button onclick="editarFornecedor('${doc.id}')" style="flex:1;border:none;background:#eff6ff;color:#3b82f6;padding:8px;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px;"><i class="fas fa-edit"></i> Editar</button>
                <button onclick="excluirFornecedor('${doc.id}')" style="flex:1;border:none;background:#fee2e2;color:#ef4444;padding:8px;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px;"><i class="fas fa-trash"></i> Excluir</button>
            </div>
        </div>`;
    });
}

function abrirModalFornecedor() {
    popularSelectObras('fornecedorObra');
    document.getElementById('modalFornecedor').style.display = 'flex';
    document.getElementById('fornecedorEditId').value = '';
    document.getElementById('modalFornecedorTitulo').innerText = 'Novo Fornecedor';
}
function fecharModalFornecedor() {
    document.getElementById('modalFornecedor').style.display = 'none';
    document.getElementById('formFornecedor').reset();
}

async function editarFornecedor(id) {
    const snap = await db.collection("fornecedores").doc(id).get();
    if (!snap.exists) return;
    const f = snap.data();
    popularSelectObras('fornecedorObra');
    document.getElementById('fornecedorObra').value = f.idObra || '';
    document.getElementById('forNome').value = f.nome;
    document.getElementById('forCategoria').value = f.categoria;
    document.getElementById('forTelefone').value = f.telefone || '';
    document.getElementById('forEmail').value = f.email || '';
    document.getElementById('forEndereco').value = f.endereco || '';
    document.getElementById('fornecedorEditId').value = id;
    document.getElementById('modalFornecedorTitulo').innerText = 'Editar Fornecedor';
    document.getElementById('modalFornecedor').style.display = 'flex';
}

async function excluirFornecedor(id) {
    if (confirm("Excluir este fornecedor?")) {
        await db.collection("fornecedores").doc(id).delete();
        await carregarFornecedores();
    }
}

document.getElementById('formFornecedor').addEventListener('submit', async e => {
    e.preventDefault();
    const editId = document.getElementById('fornecedorEditId').value;
    const dados = {
        idUsuario: usuarioAtual.uid,
        idObra: document.getElementById('fornecedorObra').value || null,
        nome: document.getElementById('forNome').value.trim(),
        categoria: document.getElementById('forCategoria').value,
        telefone: document.getElementById('forTelefone').value, email: document.getElementById('forEmail').value.trim(),
        endereco: document.getElementById('forEndereco').value
    };
    try {
        if (editId) await db.collection("fornecedores").doc(editId).update(dados);
        else await db.collection("fornecedores").add(dados);
        fecharModalFornecedor(); await carregarFornecedores();
    } catch(err) { alert("Erro ao salvar."); console.error(err); }
});
