let uFin = null;

// =========================================================
// 1. MONITOR DE LOGIN E CARREGAMENTO
// =========================================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        uFin = user;
        // Atualiza a Topbar
        const nome = user.displayName || "Engenheiro(a)";
        document.querySelector('.user-name').innerText = nome;
        const iniciais = nome.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
        document.querySelector('.avatar-iniciais').innerText = iniciais;

        console.log("Logado como:", user.uid);
        await carregarObrasNoSelect();
    } else {
        window.location.href = 'index.html';
    }
});

// =========================================================
// 2. BUSCAR OBRAS (COM FILTRO CORRETO)
// =========================================================
async function carregarObrasNoSelect() {
    const sel = document.getElementById('obraSelectFinanceiro');
    if (!sel) return;

    try {
        // Busca as obras do usuário logado
        const snap = await db.collection("obras")
            .where("idUsuario", "==", uFin.uid)
            .get();
        
        console.log("Obras encontradas:", snap.size);

        if (snap.empty) {
            sel.innerHTML = '<option value="">Nenhuma obra encontrada</option>';
            return;
        }

        sel.innerHTML = '<option value="">-- Selecione a Obra --</option>';
        snap.forEach(doc => {
            const obra = doc.data();
            sel.innerHTML += `<option value="${doc.id}">${obra.nome}</option>`;
        });

    } catch (e) {
        console.error("Erro ao carregar obras:", e);
        sel.innerHTML = '<option value="">Erro ao carregar obras</option>';
    }
}

// =========================================================
// 3. SALVAR LANÇAMENTO
// =========================================================
document.getElementById('formFinanceiro')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const idObra = document.getElementById('obraSelectFinanceiro').value;
    if (!idObra) return alert("Selecione uma obra!");

    const btn = e.target.querySelector('button');
    btn.innerText = "Salvando...";
    btn.disabled = true;

    // Converte o valor da máscara (ex: 1.500,00) para número (1500)
    const valorRaw = document.getElementById('valorGasto').value;
    const valorNum = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.')) || 0;

    const dados = {
        idUsuario: uFin.uid,
        idObra: idObra,
        descricao: document.getElementById('descricaoGasto').value,
        categoria: document.getElementById('categoriaGasto').value,
        data: document.getElementById('dataGasto').value,
        valor: valorNum,
        dataRegistro: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("financeiro").add(dados);
        alert("✅ Gasto registrado com sucesso!");
        e.target.reset();
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Salvar Despesa';
        btn.disabled = false;
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar.");
        btn.disabled = false;
    }
});

// =========================================================
// 4. MÁSCARA DE DINHEIRO
// =========================================================
document.getElementById('valorGasto')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v === "") return e.target.value = "";
    v = (parseInt(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    e.target.value = v;
});