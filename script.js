let usuarioAtual = null;

// =========================================================
// 1. MONITOR DE LOGIN (ESSENCIAL)
// =========================================================
auth.onAuthStateChanged((user) => {
    if (user) {
        usuarioAtual = user;
        const nome = user.displayName || "Engenheiro(a)";
        document.querySelector('.user-name').innerText = nome;
        const iniciais = nome.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
        document.querySelector('.avatar-iniciais').innerText = iniciais;
    } else {
        window.location.href = 'index.html';
    }
});

// =========================================================
// 2. BUSCA DE CEP (API VIACEP)
// =========================================================
async function buscarEndereco() {
    const cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const dados = await res.json();
        if (!dados.erro) {
            document.getElementById('logradouro').value = dados.logradouro;
            document.getElementById('bairro').value = dados.bairro;
            document.getElementById('cidade').value = dados.localidade;
            document.getElementById('numero').focus();
        } else {
            alert("CEP não encontrado.");
        }
    } catch (e) {
        console.error("Erro ao buscar CEP:", e);
    }
}
// Vincula o evento do CEP
document.getElementById('cep')?.addEventListener('blur', buscarEndereco);

// =========================================================
// 3. TABELA DINÂMICA (ADICIONAR/REMOVER)
// =========================================================
function adicionarLinha() {
    const tbody = document.getElementById('listaItens');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="desc-item" placeholder="Ex: Cimento" required style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;"></td>
        <td><input type="number" class="qtd" value="1" min="1" oninput="calcularTotalLinha(this)" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;"></td>
        <td>
            <select class="unidade-item" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                <option>Un</option><option>m²</option><option>Kg</option><option>Saco</option>
            </select>
        </td>
        <td><input type="number" class="valor-unit" value="0.00" step="0.01" oninput="calcularTotalLinha(this)" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;"></td>
        <td><input type="text" class="valor-total-linha" value="R$ 0,00" readonly style="width:100%; border:none; font-weight:700; background:#f8fafc; padding:10px;"></td>
        <td style="text-align:center;"><button type="button" onclick="removerLinha(this)" class="btn-remover"><i class="fas fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
}

function removerLinha(botao) {
    botao.closest('tr').remove();
    calcularTotalObra();
}

function calcularTotalLinha(el) {
    const tr = el.closest('tr');
    const qtd = parseFloat(tr.querySelector('.qtd').value) || 0;
    const unit = parseFloat(tr.querySelector('.valor-unit').value) || 0;
    const total = qtd * unit;
    tr.querySelector('.valor-total-linha').value = total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    calcularTotalObra();
}

function calcularTotalObra() {
    let totalGeral = 0;
    document.querySelectorAll('#listaItens tr').forEach(tr => {
        const qtd = parseFloat(tr.querySelector('.qtd').value) || 0;
        const unit = parseFloat(tr.querySelector('.valor-unit').value) || 0;
        totalGeral += (qtd * unit);
    });
    document.getElementById('valorTotalObra').innerText = totalGeral.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
}

// Inicia com uma linha vazia
document.addEventListener('DOMContentLoaded', () => { if(document.getElementById('listaItens')) adicionarLinha(); });

// =========================================================
// 4. SALVAR OBRA NO FIREBASE
// =========================================================
document.getElementById('formObra')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!usuarioAtual) return alert("Erro: Aguarde o carregamento do perfil.");

    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerText = "Salvando Obra...";
    btn.disabled = true;

    // Coleta itens da tabela
    const itensObra = [];
    document.querySelectorAll('#listaItens tr').forEach(tr => {
        itensObra.push({
            descricao: tr.querySelector('.desc-item').value,
            quantidade: tr.querySelector('.qtd').value,
            unidade: tr.querySelector('.unidade-item').value,
            valorUnitario: tr.querySelector('.valor-unit').value
        });
    });

    const dadosObra = {
        idUsuario: usuarioAtual.uid,
        nome: document.getElementById('nomeObra').value,
        cep: document.getElementById('cep').value,
        logradouro: document.getElementById('logradouro').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        numero: document.getElementById('numero').value,
        orcamentoInicial: document.getElementById('orcamentoInicial').value,
        itens: itensObra,
        dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("obras").add(dadosObra);
        alert("✅ Obra salva com sucesso!");
        window.location.href = 'dashboard.html';
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar.");
        btn.innerText = "Salvar Obra Completa";
        btn.disabled = false;
    }
});

// =========================================================
// 5. MÁSCARAS
// =========================================================
document.getElementById('orcamentoInicial')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, "");
    v = (parseInt(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    e.target.value = v !== "NaN" ? v : "";
});

document.getElementById('cep')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, "");
    v = v.replace(/^(\d{5})(\d)/, "$1-$2");
    e.target.value = v.substring(0, 9);
});