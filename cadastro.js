// Intercepta o clique no botão "Criar Conta"
document.getElementById('formCadastro').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('nomeCadastro').value;
    const email = document.getElementById('emailCadastro').value;
    const senha = document.getElementById('senhaCadastro').value;
    const btnCadastro = document.querySelector('.btn-primary');

    btnCadastro.innerText = "Criando conta...";
    btnCadastro.disabled = true;

    try {
        // 1. Cria o usuário na Autenticação Segura do Firebase
        const credenciais = await auth.createUserWithEmailAndPassword(email, senha);
        const usuarioLogado = credenciais.user;

        // 2. Atualiza o perfil do Firebase com o nome digitado
        await usuarioLogado.updateProfile({
            displayName: nome
        });

        // 3. Salva os dados do usuário no Banco de Dados (Firestore)
        // Isso é ótimo para o TCC: cria uma coleção "usuarios"
        await db.collection('usuarios').doc(usuarioLogado.uid).set({
            nome: nome,
            email: email,
            dataCadastro: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("🎉 Conta criada com sucesso! Bem-vindo ao Construbook.");
        
        // Manda o usuário direto para dentro do sistema!
        window.location.href = 'dashboard.html';

    } catch (error) {
        console.error("Erro no cadastro:", error);
        
        let mensagemErro = "Erro ao criar conta.";
        if (error.code === 'auth/email-already-in-use') {
            mensagemErro = "Este e-mail já está cadastrado! Tente fazer login.";
        } else if (error.code === 'auth/weak-password') {
            mensagemErro = "A senha é muito fraca. Digite pelo menos 6 caracteres.";
        }

        alert("❌ " + mensagemErro);
        btnCadastro.innerText = "Criar Conta";
        btnCadastro.disabled = false;
    }
});