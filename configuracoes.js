let usuarioAtual = null;

auth.onAuthStateChanged(async user => {
    if (user) {
        usuarioAtual = user;
        if (document.querySelector('.user-name')) document.querySelector('.user-name').innerText = user.displayName || "Engenheiro(a)";
        const iniciais = (user.displayName || "EN").split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
        if (document.querySelector('.avatar-iniciais')) document.querySelector('.avatar-iniciais').innerText = iniciais;
        document.getElementById('perfilNome').value = user.displayName || '';
        document.getElementById('perfilEmail').value = user.email || '';
        await carregarEstatisticas();
    } else { window.location.href = 'index.html'; }
});

// Salvar perfil
document.getElementById('formPerfil').addEventListener('submit', async e => {
    e.preventDefault();
    const nome = document.getElementById('perfilNome').value.trim();
    if (!nome) return alert("O nome é obrigatório.");
    try {
        await usuarioAtual.updateProfile({ displayName: nome });
        const nomeEl = document.querySelector('.user-name');
        if (nomeEl) nomeEl.innerText = nome;
        const iniciais = nome.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
        document.querySelector('.avatar-iniciais').innerText = iniciais;
        alert("Perfil atualizado com sucesso!");
    } catch(e) { alert("Erro ao atualizar perfil: " + e.message); }
});

// Alterar senha
document.getElementById('formSenha').addEventListener('submit', async e => {
    e.preventDefault();
    const atual = document.getElementById('senhaAtual').value;
    const nova = document.getElementById('novaSenha').value;
    if (nova.length < 6) return alert("A nova senha deve ter pelo menos 6 caracteres.");
    try {
        const cred = firebase.auth.EmailAuthProvider.credential(usuarioAtual.email, atual);
        await usuarioAtual.reauthenticateWithCredential(cred);
        await usuarioAtual.updatePassword(nova);
        alert("Senha alterada com sucesso!");
        e.target.reset();
    } catch(e) { alert("Erro ao alterar senha: " + e.message); }
});

// Estatísticas
async function carregarEstatisticas() {
    try {
        const obrasSnap = await db.collection("obras").where("idUsuario","==",usuarioAtual.uid).get();
        const equipeSnap = await db.collection("equipe").where("idUsuario","==",usuarioAtual.uid).get();
        const fornSnap = await db.collection("fornecedores").where("idUsuario","==",usuarioAtual.uid).get();
        const docsSnap = await db.collection("documentos").where("idUsuario","==",usuarioAtual.uid).get();

        document.getElementById('statObras').innerText = obrasSnap.size;
        document.getElementById('statEquipe').innerText = equipeSnap.size;
        document.getElementById('statFornecedores').innerText = fornSnap.size;
        document.getElementById('statDocs').innerText = docsSnap.size;
    } catch(e) { console.error("Erro stats:", e); }
}

function fazerLogout() {
    if (confirm("Deseja realmente sair?")) auth.signOut().then(() => { window.location.href = 'index.html'; });
}
