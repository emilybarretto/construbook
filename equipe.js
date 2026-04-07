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
        await carregarEquipe();
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

async function carregarEquipe() {
    const snap = await db.collection("equipe").where("idUsuario", "==", usuarioAtual.uid).get();
    const tbody = document.getElementById('tabelaEquipeBody');
    if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:40px;"><i class="fas fa-inbox" style="font-size:24px;opacity:0.3;display:block;margin-bottom:8px;"></i>Nenhum membro cadastrado.</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    snap.forEach(doc => {
        const m = doc.data();
        const nomeObra = getNomeObra(m.idObra);
        const isGlobal = !m.idObra;
        tbody.innerHTML += `<tr>
            <td style="font-weight:600;color:#1e293b;"><i class="fas fa-user-circle" style="color:#3b82f6;margin-right:8px;"></i>${m.nome}</td>
            <td><span class="badge-categoria">${m.cargo}</span></td>
            <td>${isGlobal ? '<span class="badge-global"><i class="fas fa-globe" style="margin-right:4px;"></i>Global</span>' : `<span class="badge-obra"><i class="fas fa-building" style="margin-right:4px;"></i>${nomeObra}</span>`}</td>
            <td style="color:#64748b;">${m.telefone}</td>
            <td style="color:#64748b;">${m.email || '\u2014'}</td>
            <td style="text-align:center;">
                <button onclick="editarMembro('${doc.id}')" style="border:none;background:#eff6ff;color:#3b82f6;padding:6px 10px;border-radius:6px;cursor:pointer;margin:0 3px;"><i class="fas fa-edit"></i></button>
                <button onclick="excluirMembro('${doc.id}')" style="border:none;background:#fee2e2;color:#ef4444;padding:6px 10px;border-radius:6px;cursor:pointer;margin:0 3px;"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
}

function abrirModalMembro(id) {
    popularSelectObras('membroObra');
    document.getElementById('modalMembro').style.display = 'flex';
    if (id) {
        document.getElementById('membroEditId').value = id;
        document.getElementById('modalMembroTitulo').innerText = 'Editar Membro';
    } else {
        document.getElementById('formMembro').reset();
        document.getElementById('membroEditId').value = '';
        document.getElementById('modalMembroTitulo').innerText = 'Novo Membro';
    }
}

function fecharModalMembro() {
    document.getElementById('modalMembro').style.display = 'none';
    document.getElementById('formMembro').reset();
    document.getElementById('membroEditId').value = '';
}

async function editarMembro(id) {
    const snap = await db.collection("equipe").doc(id).get();
    if (!snap.exists) return;
    const m = snap.data();
    popularSelectObras('membroObra');
    document.getElementById('membroObra').value = m.idObra || '';
    document.getElementById('membroNome').value = m.nome;
    document.getElementById('membroCargo').value = m.cargo;
    document.getElementById('membroTelefone').value = m.telefone;
    document.getElementById('membroEmail').value = m.email || '';
    abrirModalMembro(id);
}

async function excluirMembro(id) {
    if (confirm("Remover este membro da equipe?")) {
        await db.collection("equipe").doc(id).delete();
        await carregarEquipe();
    }
}

document.getElementById('formMembro').addEventListener('submit', async e => {
    e.preventDefault();
    const dados = {
        idUsuario: usuarioAtual.uid,
        idObra: document.getElementById('membroObra').value || null,
        nome: document.getElementById('membroNome').value.trim(),
        cargo: document.getElementById('membroCargo').value,
        telefone: document.getElementById('membroTelefone').value,
        email: document.getElementById('membroEmail').value.trim()
    };
    const editId = document.getElementById('membroEditId').value;
    try {
        if (editId) {
            await db.collection("equipe").doc(editId).update(dados);
        } else {
            await db.collection("equipe").add(dados);
        }
        fecharModalMembro();
        await carregarEquipe();
    } catch(err) { alert("Erro ao salvar."); console.error(err); }
});
