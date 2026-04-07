// Variáveis Globais
let usuarioAtual = null;
let idObraAtual = null;
let dadosObra = null;
let unsubscribeEtapas = null;
let graficoPizza = null;
let financLancamentos = [];

// =========================================================
// 1. LOGIN E INICIALIZAÇÃO
// =========================================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        usuarioAtual = user;
        const nome = user.displayName || "Engenheiro(a)";
        if (document.querySelector('.user-name')) document.querySelector('.user-name').innerText = nome;
        const iniciais = nome.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
        if (document.querySelector('.avatar-iniciais')) document.querySelector('.avatar-iniciais').innerText = iniciais;

        const params = new URLSearchParams(window.location.search);
        idObraAtual = params.get('id');

        if (!idObraAtual) {
            alert("Obra não especificada.");
            window.location.href = 'dashboard.html';
            return;
        }

        // Define data padrão do form financeiro
        const hojeInput = document.getElementById('dataLancamento');
        if (hojeInput) {
            const hoje = new Date().toISOString().split('T')[0];
            hojeInput.value = hoje;
        }

        await carregarDadosObra();
    } else {
        window.location.href = 'index.html';
    }
});

// =========================================================
// 2. CARREGAR DADOS DA OBRA
// =========================================================
async function carregarDadosObra() {
    try {
        const docSnap = await db.collection("obras").doc(idObraAtual).get();
        if (!docSnap.exists) {
            alert("Obra não encontrada.");
            window.location.href = 'dashboard.html';
            return;
        }

        dadosObra = docSnap.data();

        // Header
        document.getElementById('obraNome').innerText = dadosObra.nome;
        document.getElementById('breadcrumbObra').innerText = dadosObra.nome;
        const endereco = [dadosObra.logradouro, dadosObra.numero, dadosObra.bairro, dadosObra.cidade].filter(Boolean).join(', ');
        document.getElementById('obraEndereco').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${endereco}`;

        // Meta
        if (dadosObra.dataCriacao && dadosObra.dataCriacao.toDate) {
            document.getElementById('obraDataCriacao').innerText = dadosObra.dataCriacao.toDate().toLocaleDateString('pt-BR');
        }
        document.getElementById('obraNumItens').innerText = (dadosObra.itens || []).length;
        document.getElementById('obraCidade').innerText = dadosObra.cidade || '—';

        // Status
        atualizarStatusBadge(dadosObra.status || 'ativa');
        document.getElementById('statusObraSelect').value = dadosObra.status || 'ativa';

        // Orçamento
        const orcamento = parseFloat(dadosObra.orcamentoInicial || 0);
        document.getElementById('cardOrcamento').innerText = formatarMoeda(orcamento);

        // Carrega tudo em paralelo
        await Promise.all([
            carregarFinanceiro(),
            ativarRealtimeKanban(),
            carregarMateriais()
        ]);

        // Entra com animação
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('obraDashboard').classList.remove('dashboard-hidden');
        document.getElementById('obraDashboard').classList.add('dashboard-visible');

    } catch (error) {
        console.error("Erro ao carregar obra:", error);
        alert("Erro ao carregar dados da obra.");
    }
}

// =========================================================
// 3. STATUS BADGE
// =========================================================
function atualizarStatusBadge(status) {
    const badge = document.getElementById('statusBadge');
    const label = badge.querySelector('span');
    badge.className = 'status-badge';
    if (status === 'planejamento') { badge.classList.add('status-planejamento'); label.innerText = 'Planejamento'; }
    else if (status === 'concluida') { badge.classList.add('status-concluida'); label.innerText = 'Concluída'; }
    else { badge.classList.add('status-ativa'); label.innerText = 'Ativa'; }
}

async function mudarStatusObra(novoStatus) {
    try {
        await db.collection("obras").doc(idObraAtual).update({ status: novoStatus });
        atualizarStatusBadge(novoStatus);
    } catch (e) { console.error(e); }
}

// =========================================================
// 4. SISTEMA DE ABAS
// =========================================================
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.getAttribute('data-tab')}`).classList.add('active');
});

// =========================================================
// 5. FORMATADORES
// =========================================================
function formatarMoeda(v) { return parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarData(s) {
    if (!s) return '\u2014';
    const p = s.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
}

// =========================================================
// 6. FINANCEIRO
// =========================================================
async function carregarFinanceiro() {
    try {
        const snap = await db.collection("financeiro").where("idObra", "==", idObraAtual).get();
        let totalGasto = 0;
        const porCategoria = {};
        financLancamentos = [];

        snap.forEach(doc => {
            const d = doc.data();
            const valor = parseFloat(d.valor || 0);
            totalGasto += valor;
            porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + valor;
            financLancamentos.push({ ...d, id: doc.id });
        });

        const orcamento = parseFloat(dadosObra.orcamentoInicial || 0);
        document.getElementById('cardGasto').innerText = formatarMoeda(totalGasto);
        const saldo = orcamento - totalGasto;
        const elSaldo = document.getElementById('cardSaldo');
        elSaldo.innerText = formatarMoeda(saldo);
        elSaldo.style.color = saldo >= 0 ? '#10b981' : '#ef4444';

        // Cards do financeiro
        const elTotalGasto = document.getElementById('finTotalGasto');
        if (elTotalGasto) elTotalGasto.innerText = formatarMoeda(totalGasto);

        const elSaldo2 = document.getElementById('finSaldo');
        if (elSaldo2) { elSaldo2.innerText = formatarMoeda(saldo); elSaldo2.style.color = saldo >= 0 ? '#10b981' : '#ef4444'; }

        const elNum = document.getElementById('finNumLancamentos');
        if (elNum) elNum.innerText = financLancamentos.length;

        const elMedia = document.getElementById('finMedia');
        if (elMedia) { const media = financLancamentos.length > 0 ? totalGasto / financLancamentos.length : 0; elMedia.innerText = formatarMoeda(media); }

        const elHistTexto = document.getElementById('histTotalTexto');
        if (elHistTexto) elHistTexto.innerText = `${financLancamentos.length} registro(s) encontrado(s)`;

        // Progresso orçamento
        const pctOrc = orcamento > 0 ? Math.min((totalGasto / orcamento) * 100, 100) : 0;
        const barOrc = document.getElementById('progressOrcamento');
        barOrc.style.width = `${pctOrc}%`;
        barOrc.className = pctOrc > 80 ? 'progress-fill progress-danger' : pctOrc > 50 ? 'progress-fill progress-warning' : 'progress-fill progress-success';
        document.getElementById('progressOrcamentoLabel').innerText = `${pctOrc.toFixed(0)}% utilizado`;

        renderTabelaFinanceiro(financLancamentos);
        renderizarGrafico(porCategoria);
    } catch (e) { console.error(e); }
}

function renderTabelaFinanceiro(lista) {
    const tbody = document.getElementById('tabelaFinanceiroBody');
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:50px;"><i class="fas fa-inbox" style="font-size:28px; opacity:0.2; display:block; margin-bottom:10px;"></i><span style="font-size:14px;">Nenhum lancamento encontrado.</span></td></tr>';
        const elHist = document.getElementById('histTotalTexto');
        if (elHist) elHist.innerText = '0 registros encontrados';
        return;
    }
    tbody.innerHTML = '';
    lista.sort((a, b) => new Date(b.data) - new Date(a.data));
    lista.forEach(l => {
        tbody.innerHTML += `<tr>
            <td style="font-weight:600; color:#1e293b; padding:14px 16px;">${l.descricao}</td>
            <td style="padding:14px 16px;"><span class="badge-categoria">${l.categoria}</span></td>
            <td style="color:#64748b; padding:14px 16px;">${formatarData(l.data)}</td>
            <td style="text-align:right; font-weight:700; color:#ef4444; padding:14px 16px;">${formatarMoeda(l.valor)}</td>
            <td style="text-align:center; padding:14px 16px;">
                <button onclick="excluirLancamento('${l.id}')" style="border:none; background:#fee2e2; color:#ef4444; padding:6px 8px; border-radius:6px; cursor:pointer; font-size:12px;" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
}

async function excluirLancamento(id) {
    if (confirm("Excluir este lancamento?")) {
        await db.collection("financeiro").doc(id).delete();
        await carregarFinanceiro();
    }
}

function filtrarFinanceiro() {
    const cat = document.getElementById('filtroCatFinanc').value;
    if (cat === 'todas') return renderTabelaFinanceiro(financLancamentos);
    renderTabelaFinanceiro(financLancamentos.filter(l => l.categoria === cat));
}

// =========================================================
// 7. GRÁFICO DONUT
// =========================================================
function renderizarGrafico(porCategoria) {
    const canvas = document.getElementById('graficoCategorias');
    const placeholder = document.getElementById('graficoPlaceholder');
    const labels = Object.keys(porCategoria);
    const valores = Object.values(porCategoria);
    const cores = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

    if (graficoPizza) graficoPizza.destroy();

    if (labels.length === 0) {
        canvas.style.display = 'none';
        placeholder.style.display = 'flex';
        return;
    }

    canvas.style.display = 'block';
    placeholder.style.display = 'none';

    graficoPizza = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data: valores, backgroundColor: cores.slice(0, labels.length), borderWidth: 3, borderColor: '#ffffff', hoverOffset: 8 }]
        },
        options: {
            responsive: true,
            cutout: '62%',
            plugins: {
                legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true, pointStyleWidth: 10, font: { size: 11, weight: '500' } } },
                tooltip: {
                    backgroundColor: '#1e293b', cornerRadius: 8, padding: 10,
                    callbacks: {
                        label: ctx => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            return `${ctx.label}: ${formatarMoeda(ctx.raw)} (${((ctx.raw / total) * 100).toFixed(0)}%)`;
                        }
                    }
                }
            },
            animation: { animateScale: true, animateRotate: true }
        }
    });
}

// =========================================================
// 8. KANBAN ETAPAS
// =========================================================
function ativarRealtimeKanban() {
    if (unsubscribeEtapas) unsubscribeEtapas();
    const colunas = { afazer: document.getElementById('colAFazer'), andamento: document.getElementById('colAndamento'), concluido: document.getElementById('colConcluido') };

    unsubscribeEtapas = db.collection("etapas").where("idObra", "==", idObraAtual).onSnapshot(snapshot => {
        Object.values(colunas).forEach(c => c.innerHTML = '');
        let total = 0, concluidas = 0, afazer = 0, andamento = 0, concluido = 0;

        snapshot.forEach(doc => {
            const e = doc.data();
            const s = e.status || 'afazer';
            total++;
            if (s === 'concluido') { concluidas++; concluido++; }
            if (s === 'afazer') afazer++;
            if (s === 'andamento') andamento++;
            if (colunas[s]) colunas[s].appendChild(criarCardEtapa(doc.id, e));
        });

        document.getElementById('countAFazer').innerText = afazer;
        document.getElementById('countAndamento').innerText = andamento;
        document.getElementById('countConcluido').innerText = concluido;
        document.getElementById('cardEtapas').innerText = `${concluidas}/${total}`;

        const pct = total > 0 ? (concluidas / total) * 100 : 0;
        document.getElementById('progressEtapas').style.width = `${pct}%`;
        document.getElementById('progressEtapasLabel').innerText = `${pct.toFixed(0)}% concluído`;
    }, err => console.error("Erro kanban:", err));
}

function criarCardEtapa(id, etapa) {
    const div = document.createElement('div');
    div.className = 'etapa-card';
    const borda = etapa.status === 'concluido' ? '#22c55e' : etapa.status === 'andamento' ? '#f59e0b' : '#cbd5e1';
    const nomeEsc = etapa.nome.replace(/'/g, "\\'");
    div.innerHTML = `
        <div class="etapa-card-header" style="border-left-color:${borda};">
            <p class="etapa-card-nome">${etapa.nome}</p>
            <button onclick="deletarEtapa('${id}')" class="etapa-excluir" title="Excluir"><i class="fas fa-times"></i></button>
        </div>
        ${etapa.foto && etapa.foto.includes('base64') ? `<img src="${etapa.foto}" class="etapa-foto" onclick="window.open('${etapa.foto}')" alt="Foto">` : ''}
        <div class="etapa-card-actions">
            <button onclick="abrirModalFoto('${id}','${nomeEsc}')" class="btn-etapa btn-foto"><i class="fas fa-camera"></i> Foto</button>
            <select onchange="atualizarStatusEtapa('${id}',this.value)" class="etapa-status-select">
                <option value="afazer" ${etapa.status === 'afazer' ? 'selected' : ''}>A Fazer</option>
                <option value="andamento" ${etapa.status === 'andamento' ? 'selected' : ''}>Em Andamento</option>
                <option value="concluido" ${etapa.status === 'concluido' ? 'selected' : ''}>Concluído</option>
            </select>
        </div>`;
    return div;
}

async function atualizarStatusEtapa(id, s) { try { await db.collection("etapas").doc(id).update({ status: s }); } catch(e) { console.error(e); } }
async function deletarEtapa(id) { if (confirm("Excluir esta etapa?")) await db.collection("etapas").doc(id).delete(); }

document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = document.getElementById('btnAdicionarEtapa');
    const input = document.getElementById('novaEtapaInput');
    if (btnAdd && input) {
        btnAdd.addEventListener('click', async () => {
            if (!idObraAtual || !input.value.trim()) return alert("Digite o nome da etapa!");
            await db.collection("etapas").add({ idObra: idObraAtual, nome: input.value.trim(), status: "afazer", foto: "", dataCriacao: firebase.firestore.FieldValue.serverTimestamp() });
            input.value = ""; input.focus();
        });
        input.addEventListener('keypress', e => { if (e.key === 'Enter') btnAdd.click(); });
    }
});

// =========================================================
// 9. MODAL FOTO
// =========================================================
let idEtapaAtual = "";
function abrirModalFoto(id, nome) { idEtapaAtual = id; document.getElementById('nomeEtapaModal').innerText = nome; document.getElementById('modalFoto').style.display = 'flex'; }
function fecharModal() { document.getElementById('modalFoto').style.display = 'none'; document.getElementById('inputFotoEtapa').value = ""; }

document.getElementById('btnSalvarFoto').addEventListener('click', async () => {
    const file = document.getElementById('inputFotoEtapa').files[0];
    const btn = document.getElementById('btnSalvarFoto');
    if (!file) return alert("Selecione uma imagem!");
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; btn.disabled = true;
    try {
        const base64 = await comprimirImagem(file);
        await db.collection("etapas").doc(idEtapaAtual).update({ foto: base64 });
        fecharModal();
    } catch(e) { console.error(e); alert("Erro ao processar foto."); }
    finally { btn.innerHTML = '<i class="fas fa-upload"></i> Enviar'; btn.disabled = false; }
});

function comprimirImagem(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const W = 800; const S = W / img.width;
                canvas.width = W; canvas.height = img.height * S;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// =========================================================
// 10b. TOGGLE FORM DESPESA
// =========================================================
function toggleFormDespesa() {
    const container = document.getElementById('formDespesaContainer');
    const btn = document.getElementById('btnNovaDespesa');
    if (container) {
        const isOpen = container.style.display !== 'none';
        container.style.display = isOpen ? 'none' : 'block';
        btn?.classList.toggle('open', !isOpen);
        if (!isOpen) {
            document.getElementById('descLancamento')?.focus();
        }
    }
}

// =========================================================
// 10. COMPRAS E MATERIAIS
// =========================================================
let materiaisCache = [];

async function carregarMateriais() {
    const itens = dadosObra.itens || [];
    materiaisCache = [];

    let totalPrevisto = 0;
    let totalComprado = 0;
    let totalPendente = 0;

    itens.forEach((item, i) => {
        const val = parseFloat(item.valorUnitario || item.val || 0);
        const qtd = parseInt(item.quantidade || item.qtd || 0);
        const total = val * qtd;
        const status = item.statusLogistico || "Pendente";

        materiaisCache.push({ ...item, index: i, total, status: status, quantidade: qtd, valor: val });

        totalPrevisto += total;
        if (status === "Comprado") totalComprado += total;
        else totalPendente += total;
    });

    // Resumo
    document.getElementById('compraTotalPrevisto').innerText = formatarMoeda(totalPrevisto);
    document.getElementById('compraTotalComprado').innerText = formatarMoeda(totalComprado);
    document.getElementById('compraTotalPendente').innerText = formatarMoeda(totalPendente);

    // Progresso de materiais
    const n = itens.length;
    const comprados = itens.filter(it => (it.statusLogistico || "Pendente") === "Comprado").length;
    const pendentes = n - comprados;
    if (n > 0) {
        document.getElementById('progressComprados').style.width = `${(comprados / n) * 100}%`;
        document.getElementById('progressPendentes').style.width = `${(pendentes / n) * 100}%`;
        document.getElementById('statusMateriaisTexto').innerText = `${comprados} de ${n} materiais comprados`;
    } else {
        document.getElementById('statusMateriaisTexto').innerText = 'Nenhum material no orçamento.';
    }

    renderTabelaMateriais(materiaisCache);
}

function renderTabelaMateriais(lista) {
    const tbody = document.getElementById('tabelaMateriaisBody');
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:40px;"><i class="fas fa-inbox" style="font-size:24px; opacity:0.3; display:block; margin-bottom:8px;"></i>Nenhum material encontrado.</td></tr>';
        return;
    }
    tbody.innerHTML = '';
    lista.forEach((item, idx) => {
        const tr = document.createElement('tr');
        const isComprado = item.status === "Comprado";
        tr.innerHTML = `
            <td style="color:#94a3b8; font-weight:500; font-size:12px;">${String(idx + 1).padStart(3, '0')}</td>
            <td style="font-weight:600; color:#1e293b;">${item.descricao || item.desc}</td>
            <td style="text-align:center; color:#475569;">${item.quantidade}</td>
            <td style="color:#64748b;">${item.unidade || 'un'}</td>
            <td style="text-align:right; color:#64748b;">${formatarMoeda(item.valor)}</td>
            <td style="text-align:right; font-weight:700; color:#1e293b;">${formatarMoeda(item.total)}</td>
            <td style="text-align:center;">
                <span onclick="mudarStatusCompra(this, ${item.index}, '${item.status}')"
                      class="status-compra ${isComprado ? 'comprado' : 'pendente'}"
                      title="Clique para trocar">
                    ${isComprado ? '<i class="fas fa-check"></i>' : '<i class="fas fa-clock"></i>'} ${isComprado ? 'Comprado' : 'Pendente'}
                </span>
            </td>`;
        tbody.appendChild(tr);
    });
}

function filtrarMateriais(status) {
    if (status === 'todos') return renderTabelaMateriais(materiaisCache);
    renderTabelaMateriais(materiaisCache.filter(m => m.status === status));
}

async function mudarStatusCompra(el, index, statusAtual) {
    const novo = statusAtual === "Pendente" ? "Comprado" : "Pendente";
    try {
        const docRef = db.collection("obras").doc(idObraAtual);
        const snap = await docRef.get();
        if (!snap.exists) return;
        const obra = snap.data();
        const itensAtuais = [...(obra.itens || [])];
        if (itensAtuais[index]) itensAtuais[index].statusLogistico = novo;
        await docRef.update({ itens: itensAtuais });
        await carregarMateriais();
    } catch(e) {
        alert("Erro ao atualizar status.");
        console.error(e);
    }
}

// =========================================================
// 11. LANÇAMENTO RÁPIDO (DENTRO DO PROJETO)
// =========================================================
document.getElementById('valorLancamento')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v === "") return e.target.value = "";
    e.target.value = (parseInt(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
});

document.getElementById('formLancamentoRapido')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const desc = document.getElementById('descLancamento').value.trim();
    if (!desc) return alert("Preencha a descrição!");

    const valorRaw = document.getElementById('valorLancamento').value;
    const valor = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.')) || 0;
    if (valor <= 0) return alert("Valor inválido!");

    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;

    try {
        await db.collection("financeiro").add({
            idUsuario: usuarioAtual.uid,
            idObra: idObraAtual,
            descricao: desc,
            categoria: document.getElementById('catLancamento').value,
            data: document.getElementById('dataLancamento').value,
            valor: valor,
            dataRegistro: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Despesa registrada com sucesso!");
        e.target.reset();
        const hoje = new Date().toISOString().split('T')[0];
        document.getElementById('dataLancamento').value = hoje;
        await carregarFinanceiro();
    } catch(e) {
        console.error(e);
        alert("Erro ao registrar despesa.");
    } finally {
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Registrar Despesa';
        btn.disabled = false;
    }
});

// =========================================================
// 12. GERAR PDF
// =========================================================
async function gerarPDFObra() {
    if (!dadosObra) return;
    const btn = event.currentTarget;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; btn.disabled = true;

    try {
        const finSnap = await db.collection("financeiro").where("idObra", "==", idObraAtual).get();
        const etapasSnap = await db.collection("etapas").where("idObra", "==", idObraAtual).get();
        const itensObra = dadosObra.itens || [];

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // CAPA
        doc.setFillColor(30, 41, 59); doc.rect(0, 0, 210, 60, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(24); doc.text("Construbook", 14, 25);
        doc.setFontSize(14); doc.setTextColor(203, 213, 225); doc.text("Relatorio Consolidado", 14, 40);

        let y = 72;
        doc.setTextColor(0); doc.setFontSize(11);
        doc.setFont(undefined, 'bold'); doc.text(`Obra: ${dadosObra.nome}`, 14, y); y += 8;
        doc.setFont(undefined, 'normal');
        const end = [dadosObra.logradouro, dadosObra.numero, dadosObra.bairro, dadosObra.cidade].filter(Boolean).join(', ');
        doc.text(`Endereco: ${end}`, 14, y); y += 8;
        if (dadosObra.dataCriacao?.toDate) doc.text(`Criada em: ${dadosObra.dataCriacao.toDate().toLocaleDateString('pt-BR')}`, 14, y); y += 8;
        doc.line(14, y, 196, y); y += 8;

        // 1. FINANCEIRO
        doc.setFont(undefined, 'bold'); doc.setFontSize(16); doc.text("1. Resumo Financeiro", 14, y); y += 6;
        let totalFin = 0; const tbFin = [];
        finSnap.forEach(d => {
            const g = d.data(); totalFin += parseFloat(g.valor || 0);
            tbFin.push([g.descricao, g.categoria, formatarMoeda(g.valor)]);
        });
        doc.autoTable({ startY: y, head: [['Descricao','Categoria','Valor']], body: tbFin, foot: [['TOTAL','',formatarMoeda(totalFin)]], headStyles: {fillColor:[30,41,59]}, footStyles: {fillColor:[30,41,59]} });
        y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 120;

        // 2. COMPRAS
        if (itensObra.length > 0) {
            doc.setFont(undefined, 'bold'); doc.setFontSize(16); doc.text("2. Materiais e Orcamento", 14, y); y += 6;
            let totalMat = 0; const tbMat = [];
            itensObra.forEach(it => {
                const v = parseFloat(it.valorUnitario || it.val || 0) * parseInt(it.quantidade || it.qtd || 0);
                totalMat += v;
                tbMat.push([it.descricao || it.desc, `${it.quantidade || it.qtd} ${it.unidade || 'un'}`, formatarMoeda(v), it.statusLogistico || 'Pendente']);
            });
            doc.autoTable({ startY: y, head: [['Descricao','Qtd','Total','Status']], body: tbMat, foot: [['TOTAL PREVISTO','',formatarMoeda(totalMat),'']], headStyles: {fillColor:[249,115,22]} });
            y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 120;
        } else { y += 5; }

        // 3. ETAPAS
        doc.setFont(undefined, 'bold'); doc.setFontSize(16); doc.text("3. Cronograma de Etapas", 14, y); y += 6;
        const sMap = { afazer: 'A Fazer', andamento: 'Em Andamento', concluido: 'Concluido' };
        doc.autoTable({ startY: y, head: [['Atividade','Status']], body: etapasSnap.docs.map(e => [e.data().nome, sMap[e.data().status] || '-']), headStyles: {fillColor:[34,197,94]} });

        // 4. FOTOS
        const fotos = etapasSnap.docs.filter(d => d.data().foto && d.data().foto.includes('base64'));
        if (fotos.length > 0) {
            doc.addPage(); doc.setFontSize(18); doc.text("Anexo Fotografico", 14, 22); doc.line(14, 25, 196, 25);
            let xp = 14, yp = 35, ct = 0;
            for (const de of fotos) {
                const et = de.data();
                doc.setFontSize(10); doc.text(`Tarefa: ${et.nome}`, xp, yp - 3);
                try { doc.addImage(et.foto, 'JPEG', xp, yp, 85, 60); } catch(_) { doc.text("[erro]", xp, yp + 10); }
                ct++; xp = ct % 2 === 0 ? 14 : 105;
                if (ct % 2 === 0) yp += 75;
                if (yp > 240) { doc.addPage(); yp = 35; }
            }
        }

        doc.save(`Relatorio_${dadosObra.nome}.pdf`);
    } catch(e) {
        console.error(e); alert("Erro ao gerar PDF.");
    } finally {
        btn.innerHTML = '<i class="fas fa-file-pdf"></i> Gerar PDF'; btn.disabled = false;
    }
}
