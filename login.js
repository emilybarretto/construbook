// Intercepta o clique no botão "Entrar"
document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que a página recarregue

    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const btnLogin = document.querySelector('.btn-primary');

    // Muda o texto do botão para dar um feedback visual (UX)
    btnLogin.innerText = "Autenticando...";
    btnLogin.disabled = true;

    try {
        // MÁGICA DO FIREBASE: Tenta fazer o login com e-mail e senha
        await auth.signInWithEmailAndPassword(email, senha);
        
        // Se a linha de cima não der erro, o login foi um sucesso!
        alert("✅ Login realizado com sucesso!");
        window.location.href = 'dashboard.html'; // Vai para o sistema

    } catch (error) {
        // Se der erro (senha errada, usuário não existe, etc.)
        console.error("Erro no login:", error);
        
        let mensagemErro = "Erro ao fazer login.";
        if (error.code === 'auth/user-not-found') {
            mensagemErro = "Usuário não encontrado. Crie uma conta primeiro.";
        } else if (error.code === 'auth/wrong-password') {
            mensagemErro = "Senha incorreta. Tente novamente.";
        } else if (error.code === 'auth/invalid-credential') {
            mensagemErro = "Credenciais inválidas. Verifique seu e-mail e senha.";
        }

        alert("❌ " + mensagemErro);
        
        // Volta o botão ao normal
        btnLogin.innerText = "Entrar";
        btnLogin.disabled = false;
    }
});