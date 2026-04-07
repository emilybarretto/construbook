let usuarioAtual = null;
let obrasCache = [];

auth.onAuthStateChanged(async user => {
    if (user) {
        usuarioAtual = user;
        if (document.querySelector('.user-name')) document.querySelector('.user-name').innerText = user.displayName || "Engenheiro(a)";
        const iniciais = (user.displayName || "EN").split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
        if (document.querySelector('.avatar-iniciais')) document.querySelector('.avatar-iniciais').innerText = iniciais;
        const snap = await db.collection("obras").where("idUsuario", "==", usuarioAtual.uid).get();
        snap.forEach(doc => obrasCache.push({ id: doc.id, ...doc.data() }));
        obrasCache.sort((a, b) => a.nome.localeCompare(b.nome));
        await carregarDocumentos();
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

const iconesDoc = {"Alvará":"fa-file-shield","ART":"fa-file-pen","Licença Ambiental":"fa-leaf","Laudo Técnico":"fa-microscope","Planta Baixa":"fa-map","Memorial de Cálculo":"fa-calculator","Outro":"fa-file"};
const coresDoc = {"Alvará":"#3b82f6","ART":"#f59e0b","Licença Ambiental":"#10b981","Laudo Técnico":"#8b5cf6","Planta Baixa":"#06b6d4","Memorial de Cálculo":"#64748b","Outro":"#94a3b8"};

async function carregarDocumentos() {
    const snap = await db.collection("documentos").where("idUsuario","==",usuarioAtual.uid).get();
    const grid = document.getElementById('gridDocumentos');
    if (snap.empty) {
        grid.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:60px;grid-column:1/-1;"><i class="fas fa-folder-open" style="font-size:48px;opacity:0.2;margin-bottom:12px;display:block;"></i>Nenhum documento cadastrado.</div>';
        return;
    }
    grid.innerHTML = '';
    snap.forEach(docSnap => {
        const d = docSnap.data();
        const tipo = d.tipo || "Outro";
        const icone = iconesDoc[tipo] || "fa-file";
        const cor = coresDoc[tipo] || "#64748b";
        const nomeObra = getNomeObra(d.idObra);
        const isGlobal = !d.idObra;
        let statusBadge = '<span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;"><i class="fas fa-check-circle" style="margin-right:4px;"></i>Válido</span>';
        if (d.validade) {
            const hoje = new Date(); const val = new Date(d.validade);
            if (val < hoje) statusBadge = '<span style="background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;"><i class="fas fa-exclamation-triangle" style="margin-right:4px;"></i>Vencido</span>';
            else { const diff = Math.ceil((val - hoje) / 86400000); if (diff < 30) statusBadge = `<span style="background:#fef9c3;color:#854d0e;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;"><i class="fas fa-clock" style="margin-right:4px;"></i>${diff} dias</span>`; }
        }
        grid.innerHTML += `<div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:22px;transition:all 0.2s;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:40px;height:40px;border-radius:10px;background:${cor}15;display:flex;align-items:center;justify-content:center;font-size:16px;color:${cor};"><i class="fas ${icone}"></i></div>
                    <div><h4 style="margin:0;font-size:14px;color:#1e293b;">${d.titulo}</h4><span class="badge-categoria">${tipo}</span></div>
                </div>
            </div>
            <div style="margin-bottom:10px;">
                ${isGlobal ? '<span class="badge-global"><i class="fas fa-globe" style="margin-right:4px;"></i>Global</span>' : `<span class="badge-obra"><i class="fas fa-building" style="margin-right:4px;"></i>${nomeObra}</span>`}
            </div>
            ${d.descricao ? `<p style="font-size:12px;color:#64748b;margin-bottom:12px;">${d.descricao}</p>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between;">
                ${d.validade ? `<span style="font-size:12px;color:#94a3b8;"><i class="fas fa-calendar" style="margin-right:4px;"></i>${new Date(d.validade+'T12:00:00').toLocaleDateString('pt-BR')}</span>` : ''}
                ${statusBadge}
            </div>
            <div style="display:flex;gap:6px;margin-top:12px;padding-top:12px;border-top:1px solid #f1f5f9;">
                <button onclick="editarDocumento('${docSnap.id}')" style="flex:1;border:none;background:#eff6ff;color:#3b82f6;padding:8px;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px;"><i class="fas fa-edit"></i> Editar</button>
                <button onclick="excluirDocumento('${docSnap.id}')" style="flex:1;border:none;background:#fee2e2;color:#ef4444;padding:8px;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px;"><i class="fas fa-trash"></i> Excluir</button>
            </div>
        </div>`;
    });
}

function abrirModalDocumento() { popularSelectObras('docObra'); document.getElementById('modalDocumento').style.display='flex'; document.getElementById('docEditId').value=''; document.getElementById('modalDocTitulo').innerText='Novo Documento'; }
function fecharModalDocumento() { document.getElementById('modalDocumento').style.display='none'; document.getElementById('formDocumento').reset(); }

async function editarDocumento(id) {
    const snap = await db.collection("documentos").doc(id).get();
    if (!snap.exists) return;
    const d = snap.data();
    popularSelectObras('docObra');
    document.getElementById('docObra').value = d.idObra || '';
    document.getElementById('docTitulo').value = d.titulo; document.getElementById('docTipo').value = d.tipo;
    document.getElementById('docValidade').value = d.validade || ''; document.getElementById('docDescricao').value = d.descricao || '';
    document.getElementById('docEditId').value = id; document.getElementById('modalDocTitulo').innerText = 'Editar Documento';
    document.getElementById('modalDocumento').style.display = 'flex';
}

async function excluirDocumento(id) { if (confirm("Excluir este documento?")) { await db.collection("documentos").doc(id).delete(); carregarDocumentos(); } }

document.getElementById('formDocumento').addEventListener('submit', async e => {
    e.preventDefault();
    const dados = { idUsuario: usuarioAtual.uid, idObra: document.getElementById('docObra').value || null, titulo: document.getElementById('docTitulo').value.trim(), tipo: document.getElementById('docTipo').value, validade: document.getElementById('docValidade').value, descricao: document.getElementById('docDescricao').value.trim() };
    const editId = document.getElementById('docEditId').value;
    try { if (editId) await db.collection("documentos").doc(editId).update(dados); else await db.collection("documentos").add(dados); fecharModalDocumento(); carregarDocumentos(); }
    catch(err) { alert("Erro ao salvar."); console.error(err); }
});
