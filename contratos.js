let usuarioAtual = null;
let contratoArquivoBase64 = null;
let obrasCache = [];

auth.onAuthStateChanged(async user => {
    if (user) {
        usuarioAtual = user;
        if (document.querySelector('.user-name')) document.querySelector('.user-name').innerText = user.displayName || "Engenheiro(a)";
        const iniciais = (user.displayName || "EN").split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
        if (document.querySelector('.avatar-iniciais')) document.querySelector('.avatar-iniciais').innerText = iniciais;
        // Carregar obras para os seletores
        const snap = await db.collection("obras").where("idUsuario", "==", usuarioAtual.uid).get();
        snap.forEach(doc => obrasCache.push({ id: doc.id, ...doc.data() }));
        obrasCache.sort((a, b) => a.nome.localeCompare(b.nome));
        await carregarContratos();
    } else { window.location.href = 'index.html'; }
});

function formatarMoeda(v) { return parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarData(s) { if (!s) return '—'; return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR'); }

// Status config
const statusConfig = {
    rascunho:  { label: 'Rascunho',              cor: '#64748b', bg: '#f1f5f9', icone: 'fa-file',           corIcone: '#94a3b8' },
    enviado:   { label: 'Enviado p/ Assinatura',  cor: '#d97706', bg: '#fef9c3', icone: 'fa-paper-plane',    corIcone: '#f59e0b' },
    assinado:  { label: 'Assinado',                cor: '#166534', bg: '#dcfce7', icone: 'fa-circle-check',   corIcone: '#22c55e' }
};

async function carregarContratos() {
    const snap = await db.collection("contratos").where("idUsuario", "==", usuarioAtual.uid).get();

    // Resumo por status
    const porStatus = { rascunho: 0, enviado: 0, assinado: 0 };
    snap.forEach(doc => { const d = doc.data(); porStatus[d.status || 'rascunho'] = (porStatus[d.status || 'rascunho'] || 0) + 1; });

    const gridResumo = document.getElementById('resumoContratos');
    gridResumo.innerHTML = '';
    Object.entries(statusConfig).forEach(([key, cfg]) => {
        gridResumo.innerHTML += `<div class="card resumo-card" style="cursor:pointer;" onclick="filtrarPorStatus('${key}')">
            <div class="card-icon" style="background:linear-gradient(135deg,${cfg.corIcone},${cfg.cor});">
                <i class="fas ${cfg.icone}"></i>
            </div>
            <div class="card-text">
                <p class="card-label">${cfg.label}</p>
                <p class="card-value" style="color:${cfg.cor};">${porStatus[key] || 0}</p>
            </div>
        </div>`;
    });

    document.getElementById('histContratosTexto').innerText = `${snap.size} contrato(s) no total`;
    filtrarContratos();
}

async function filtrarContratos() {
    const filtro = document.getElementById('filtroStatusContrato').value;
    const snap = await db.collection("contratos").where("idUsuario", "==", usuarioAtual.uid).get();

    let lista = [];
    snap.forEach(docSnap => { lista.push({ ...docSnap.data(), id: docSnap.id }); });

    if (filtro !== 'todos') lista = lista.filter(c => c.status === filtro);

    const grid = document.getElementById('gridContratos');
    if (lista.length === 0) {
        grid.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:60px;grid-column:1/-1;"><i class="fas fa-file-signature" style="font-size:48px;opacity:0.2;margin-bottom:12px;display:block;"></i>Nenhum contrato encontrado.</div>';
        return;
    }

    // Popular seletor de obras
    popularSelectObras('ctrObra');

    grid.innerHTML = '';
    lista.forEach(c => {
        const cfg = statusConfig[c.status] || statusConfig.rascunho;
        const obraNome = obrasCache.find(o => o.id === c.idObra)?.nome || 'Sem obra';
        let acoesHtml = '';
        if (c.status === 'rascunho') {
            acoesHtml = `<button onclick="prepararEnvio('${c.id}','${(c.emailAssinante || '').replace(/'/g, "\\'")}')" style="flex:1;border:none;background:#fef9c3;color:#d97706;padding:10px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;"><i class="fas fa-paper-plane"></i> Enviar p/ Assinatura</button>
                         <button onclick="editarContrato('${c.id}')" style="border:none;background:#eff6ff;color:#3b82f6;padding:10px;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px;"><i class="fas fa-edit"></i></button>`;
        } else if (c.status === 'enviado') {
            acoesHtml = `<button onclick="marcarAssinado('${c.id}')" style="flex:1;border:none;background:#dcfce7;color:#166534;padding:10px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;"><i class="fas fa-check"></i> Confirmar Recebimento Assinado</button>`;
        } else {
            acoesHtml = `<span style="color:#166534;font-weight:700;font-size:13px;"><i class="fas fa-check-circle" style="margin-right:4px;"></i>Contrato Finalizado</span>`;
        }

        grid.innerHTML += `<div style="background:white;border-radius:14px;border:1px solid #e2e8f0;padding:24px;transition:all 0.2s;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                <div>
                    <h4 style="margin:0 0 6px;color:#1e293b;font-size:15px;font-weight:700;">${c.titulo}</h4>
                    <span class="badge-categoria">${c.tipo}</span><span class="badge-obra"><i class="fas fa-building" style="margin-right:4px;"></i>${obraNome}</span>
                </div>
                <span style="background:${cfg.bg};color:${cfg.cor};padding:5px 12px;border-radius:14px;font-size:11px;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:4px;">
                    <i class="fas ${cfg.icone}"></i> ${cfg.label}
                </span>
            </div>
            <div style="font-size:13px;color:#64748b;line-height:2;">
                <div><i class="fas fa-user" style="width:16px;margin-right:8px;color:#94a3b8;"></i>${c.parte || '—'}</div>
                <div><i class="fas fa-calendar" style="width:16px;margin-right:8px;color:#94a3b8;"></i>${formatarData(c.inicio)} — ${formatarData(c.fim)}</div>
                <div><i class="fas fa-coins" style="width:16px;margin-right:8px;color:#94a3b8;"></i>${formatarMoeda(c.valor)}</div>
                ${c.emailAssinante ? `<div><i class="fas fa-envelope" style="width:16px;margin-right:8px;color:#94a3b8;"></i>${c.emailAssinante}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;margin-top:16px;padding-top:16px;border-top:1px solid #f1f5f9;flex-wrap:wrap;">
                ${acoesHtml}
                <button onclick="excluirContrato('${c.id}')" style="border:none;background:#fee2e2;color:#ef4444;padding:10px;border-radius:8px;cursor:pointer;font-weight:600;font-size:12px;"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    });
}

function filtrarPorStatus(status) { document.getElementById('filtroStatusContrato').value = status; filtrarContratos(); }

// Modal
function popularSelectObras(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel || obrasCache.length === 0) return;
    // Salva seleção atual
    const valAtual = sel.value;
    // Limpa e recarrega
    sel.innerHTML = '<option value="">Selecione uma obra...</option>';
    obrasCache.forEach(o => {
        sel.innerHTML += `<option value="${o.id}">${o.nome}</option>`;
    });
    if (valAtual) sel.value = valAtual;
}

function abrirModalContrato() {
    document.getElementById('modalContrato').style.display = 'flex';
    document.getElementById('contratoEditId').value = '';
    document.getElementById('modalContratoTitulo').innerText = 'Novo Contrato';
    document.getElementById('ctrArquivoLabel').innerText = 'Clique ou arraste o PDF do contrato';
    contratoArquivoBase64 = null;
    // Popular select de obras
    popularSelectObras('ctrObra');
}
function fecharModalContrato() {
    document.getElementById('modalContrato').style.display = 'none';
    document.getElementById('formContrato').reset();
    document.getElementById('contratoEditId').value = '';
    document.getElementById('ctrArquivoLabel').innerText = 'Clique ou arraste o PDF do contrato';
    contratoArquivoBase64 = null;
}

// Upload PDF para Base64
function handleArquivo(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) return alert('Apenas arquivos PDF são aceitos.');
    if (file.size > 2 * 1024 * 1024) return alert('O PDF deve ter no máximo 2MB.');

    const reader = new FileReader();
    reader.onload = () => {
        contratoArquivoBase64 = reader.result;
        document.getElementById('ctrArquivoLabel').innerHTML = `<i class="fas fa-file-pdf" style="color:#ef4444;margin-right:6px;"></i> ${file.name}`;
    };
    reader.readAsDataURL(file);
}

// Mascara de valor
document.getElementById('ctrValor')?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '');
    if (v === '') return e.target.value = '';
    e.target.value = (parseInt(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
});

// Editar
async function editarContrato(id) {
    const snap = await db.collection("contratos").doc(id).get();
    if (!snap.exists) return;
    const c = snap.data();
    popularSelectObras('ctrObra');
    document.getElementById('ctrObra').value = c.idObra || '';
    document.getElementById('ctrTitulo').value = c.titulo;
    document.getElementById('ctrTipo').value = c.tipo;
    document.getElementById('ctrValor').value = c.valor || '';
    document.getElementById('ctrParte').value = c.parte || '';
    document.getElementById('ctrEmailAssinante').value = c.emailAssinante || '';
    document.getElementById('ctrDescricao').value = c.descricao || '';
    document.getElementById('ctrInicio').value = c.inicio || '';
    document.getElementById('ctrFim').value = c.fim || '';
    document.getElementById('contratoEditId').value = id;
    document.getElementById('modalContratoTitulo').innerText = 'Editar Contrato';
    document.getElementById('modalContrato').style.display = 'flex';
}

// Salvar
document.getElementById('formContrato').addEventListener('submit', async e => {
    e.preventDefault();
    const editId = document.getElementById('contratoEditId').value;
    const dados = {
        idUsuario: usuarioAtual.uid,
        idObra: document.getElementById('ctrObra').value,
        titulo: document.getElementById('ctrTitulo').value.trim(),
        tipo: document.getElementById('ctrTipo').value,
        valor: document.getElementById('ctrValor').value,
        parte: document.getElementById('ctrParte').value.trim(),
        emailAssinante: document.getElementById('ctrEmailAssinante').value.trim(),
        descricao: document.getElementById('ctrDescricao').value.trim(),
        inicio: document.getElementById('ctrInicio').value,
        fim: document.getElementById('ctrFim').value
    };

    if (!editId) {
        dados.status = 'rascunho';
        dados.dataRegistro = firebase.firestore.FieldValue.serverTimestamp();
    }
    if (contratoArquivoBase64) dados.pdfArquivo = contratoArquivoBase64;

    try {
        if (editId) await db.collection("contratos").doc(editId).update(dados);
        else await db.collection("contratos").add(dados);
        fecharModalContrato();
        await carregarContratos();
    } catch (err) { alert('Erro ao salvar.'); console.error(err); }
});

// Excluir
async function excluirContrato(id) {
    if (confirm('Excluir este contrato?')) {
        await db.collection("contratos").doc(id).delete();
        await carregarContratos();
    }
}

// =========================================
// ASSINATURA DIGITAL COM CANVAS + PDF-LIB
// =========================================
let contratoAssinaturaAtualId = null;
let pdfAssinadoBlob = null;

function initCanvasAssinatura() {
    const canvas = document.getElementById('canvasAssinatura');
    const ctx = canvas.getContext('2d');
    let desenhando = false;

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }

    canvas.addEventListener('mousedown', e => { desenhando = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
    canvas.addEventListener('mousemove', e => {
        if (!desenhando) return;
        const p = getPos(e);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    });
    canvas.addEventListener('mouseup', () => desenhando = false);
    canvas.addEventListener('mouseleave', () => desenhando = false);

    canvas.addEventListener('touchstart', e => { e.preventDefault(); desenhando = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }, { passive: false });
    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (!desenhando) return;
        const p = getPos(e);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    }, { passive: false });
    canvas.addEventListener('touchend', () => desenhando = false);
}

function limparAssinatura() {
    const canvas = document.getElementById('canvasAssinatura');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function isCanvasVazio() {
    const canvas = document.getElementById('canvasAssinatura');
    const ctx = canvas.getContext('2d');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] > 0) return false;
    }
    return true;
}

// Preparar modal de assinatura
async function prepararEnvio(id, email) {
    if (!email) return alert("Este contrato não tem um email de signatário. Edite e adicione o email.");

    contratoAssinaturaAtualId = id;
    pdfAssinadoBlob = null;

    // Buscar dados do signatário
    const snap = await db.collection("contratos").doc(id).get();
    const dados = snap.data();
    const nomeParte = dados.parte || 'Signatário';
    document.getElementById('assEmailTexto').innerText = `${nomeParte} (${email})`;
    document.getElementById('assTitulo').innerText = 'Assinar Contrato';
    document.getElementById('assTexto').innerText = 'Desenhe sua assinatura no quadro abaixo';

    limparAssinatura();
    document.getElementById('modalAssinatura').style.display = 'flex';

    // Botão confirmar
    document.getElementById('btnConfirmarAssinatura').onclick = async () => {
        if (isCanvasVazio()) return alert('Por favor, desenhe sua assinatura.');
        document.getElementById('btnConfirmarAssinatura').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        document.getElementById('btnConfirmarAssinatura').disabled = true;

        try {
            // Assinatura como imagem PNG
            const canvas = document.getElementById('canvasAssinatura');
            const assinaturaImgData = canvas.toDataURL('image/png');
            const assinaturaBytes = Uint8Array.from(atob(assinaturaImgData.split(',')[1]), c => c.charCodeAt(0));

            console.log('[Assinatura] Tem PDF:', !!dados.pdfArquivo, '| Tamanho do base64:', (dados.pdfArquivo || '').length);

            // Carregar PDF original ou criar um novo
            let pdfDoc;
            const hasValidPdf = dados.pdfArquivo && dados.pdfArquivo.length > 1000;

            if (hasValidPdf) {
                try {
                    const pdfBytes = Uint8Array.from(atob(dados.pdfArquivo.split(',')[1]), c => c.charCodeAt(0));
                    console.log('[Assinatura] PDF tamanho:', pdfBytes.length, 'bytes');
                    pdfDoc = await PDFLib.PDFDocument.load(pdfBytes, {
                        updateMetadata: false,
                        ignoreEncryption: true
                    });
                    console.log('[Assinatura] PDF carregado:', pdfDoc.getPageCount(), 'paginas');
                } catch (pdfErr) {
                    console.warn('[Assinatura] Falha ao carregar PDF enviado, criando documento alternativo:', pdfErr.message);
                    pdfDoc = await criarPdfContrato(dados);
                }
            } else {
                console.log('[Assinatura] Sem PDF, criando documento alternativo.');
                pdfDoc = await criarPdfContrato(dados);
            }

            // Inserir assinatura no PDF
            const assinaturaImg = await pdfDoc.embedPng(assinaturaBytes);
            const assW = 180;
            const assH = 60;
            const pages = pdfDoc.getPages();
            const lastPage = pages[pages.length - 1];
            const { width } = lastPage.getSize();
            lastPage.drawImage(assinaturaImg, {
                x: width / 2 - assW / 2,
                y: 60,
                width: assW,
                height: assH,
            });

            // Linha de assinatura
            lastPage.drawLine({ start: { x: width / 2 - assW / 2 - 5, y: 52 }, end: { x: width / 2 + assW / 2 + 5, y: 52 }, thickness: 0.7, color: PDFLib.rgb(0.5, 0.5, 0.5) });

            // Nome e data
            const fontSmall = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            const nomeWidth = fontSmall.widthOfTextAtSize(nomeParte, 9);
            lastPage.drawText(nomeParte, { x: width / 2 - nomeWidth / 2, y: 38, size: 9, font: fontSmall, color: PDFLib.rgb(0.3, 0.3, 0.3) });
            const hoje = new Date().toLocaleDateString('pt-BR');
            const dataText = `Assinado em: ${hoje}`;
            const dataWidth = fontSmall.widthOfTextAtSize(dataText, 7);
            lastPage.drawText(dataText, { x: width / 2 - dataWidth / 2, y: 26, size: 7, font: fontSmall, color: PDFLib.rgb(0.4, 0.4, 0.4) });

            // Carimbo
            const carimbo = '[Documento Assinado Digitalmente]';
            const carWidth = fontSmall.widthOfTextAtSize(carimbo, 8);
            lastPage.drawText(carimbo, { x: width / 2 - carWidth / 2, y: 20, size: 8, font: fontSmall, color: PDFLib.rgb(0, 0.55, 0.15) });

            // Salvar
            const pdfBytes = await pdfDoc.save();
            pdfAssinadoBlob = new Blob([pdfBytes], { type: 'application/pdf' });
            const assinadoBase64 = arrayBufferToBase64(pdfBytes);

            console.log('[Assinatura] PDF assinado gerado: ' + pdfBytes.byteLength + ' bytes');

            await db.collection("contratos").doc(id).update({
                status: 'assinado',
                dataAssinatura: firebase.firestore.FieldValue.serverTimestamp(),
                pdfAssinado: assinadoBase64
            });

            fecharModalAssinatura();
            abrirModalSucesso(id, email, dados.titulo, nomeParte);
            await carregarContratos();

        } catch (err) {
            console.error('[Assinatura] ERRO:', err.message, err.stack);
            alert('Erro ao assinar: ' + err.message);
        }

        document.getElementById('btnConfirmarAssinatura').innerHTML = '<i class="fas fa-check"></i> Confirmar Assinatura';
        document.getElementById('btnConfirmarAssinatura').disabled = false;
    };
}

// Criar PDF com dados do contrato quando nao ha arquivo
async function criarPdfContrato(dados) {
    const pdfDoc = await PDFLib.PDFDocument.create();
    const page = pdfDoc.addPage([420, 560]);
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

    page.drawText(dados.titulo || 'Contrato', { x: 30, y: 520, size: 18, font: fontBold });
    page.drawLine({ start: { x: 30, y: 505 }, end: { x: 390, y: 505 }, thickness: 1.5, color: PDFLib.rgb(0.04, 0.33, 0.68) });

    let yPos = 480;
    function addField(label, value) {
        page.drawText(label, { x: 30, y: yPos, size: 10, font: fontBold, color: PDFLib.rgb(0.4, 0.45, 0.55) });
        page.drawText(value || '—', { x: 30, y: yPos - 16, size: 12, font });
        yPos -= 50;
    }

    addField('Tipo', dados.tipo);
    addField('Parte Contratada', dados.parte);
    addField('Valor (R$)', dados.valor || '—');
    addField('Email do Signatario', dados.emailAssinante || '—');
    addField('Periodo', (dados.inicio || '—') + ' ate ' + (dados.fim || '—'));

    if (dados.descricao) {
        page.drawText('Descricao', { x: 30, y: yPos, size: 10, font: fontBold, color: PDFLib.rgb(0.4, 0.45, 0.55) });
        yPos -= 18;
        page.drawText(dados.descricao, { x: 30, y: yPos, size: 10, font });
    }

    page.drawText('Gerado por Construbook', { x: 30, y: 20, size: 8, font, color: PDFLib.rgb(0.6, 0.65, 0.7) });

    return pdfDoc;
}

function abrirModalSucesso(id, email, titulo, nomeParte) {
    document.getElementById('assOkTexto').innerText = `"${titulo || 'Contrato'}" foi assinado por ${nomeParte || 'Signatário'} e pode ser baixado.`;

    // Botão baixar
    document.getElementById('btnBaixarPDFAssinado').onclick = () => {
        baixarPDFAssinado(titulo, id);
    };

    // Botão e-mail
    document.getElementById('btnEnviarEmailAssinado').onclick = () => {
        enviarEmailAssinado(email, titulo, nomeParte, id);
    };

    document.getElementById('modalAssinaturaOk').style.display = 'flex';
}

function fecharModalAssinaturaOk() {
    document.getElementById('modalAssinaturaOk').style.display = 'none';
}

function fecharModalAssinatura() {
    document.getElementById('modalAssinatura').style.display = 'none';
    // Não limpa pdfAssinadoBlob aqui — o modal de sucesso precisa dele
}

async function baixarPDFAssinado(titulo, contratoId) {
    try {
        let pdfBytes;
        if (pdfAssinadoBlob) {
            // Usa o blob em memória
            pdfBytes = await pdfAssinadoBlob.arrayBuffer();
        } else if (contratoId) {
            // Reconstrói a partir do Firestore (salvo como base64 no pdfAssinado)
            console.log('[Download] Tentando reconstruir do Firestore para:', contratoId);
            const snap = await db.collection("contratos").doc(contratoId).get();
            const dados = snap.data();
            if (dados && dados.pdfAssinado) {
                pdfBytes = Uint8Array.from(atob(dados.pdfAssinado), c => c.charCodeAt(0)).buffer;
                pdfAssinadoBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
            }
        }

        if (!pdfBytes) return alert('PDF assinado não disponível.');

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${titulo || 'Contrato'}_ass.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('[Download] Erro:', e);
        alert('Erro ao baixar o PDF: ' + e.message);
    }
}

async function enviarEmailAssinado(email, titulo, nomeParte, contratoId) {
    try {
        let pdfBytes;
        if (pdfAssinadoBlob) {
            pdfBytes = await pdfAssinadoBlob.arrayBuffer();
        } else if (contratoId) {
            console.log('[Email] Reconstruindo do Firestore para:', contratoId);
            const snap = await db.collection("contratos").doc(contratoId).get();
            const dados = snap.data();
            if (dados && dados.pdfAssinado) {
                pdfBytes = Uint8Array.from(atob(dados.pdfAssinado), c => c.charCodeAt(0)).buffer;
                pdfAssinadoBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
            }
        }

        if (!pdfBytes) return alert('PDF não disponível para envio.');

        // Baixar primeiro
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${titulo || 'Contrato'}_ass.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Abrir e-mail com instruções
        alert(
            '📧 O PDF assinado foi baixado automaticamente.\n\nAgora o app de e-mail vai abrir com o texto pronto. Apenas anexe o arquivo PDF que acabou de ser baixado!'
        );

        const assunto = `Contrato Assinado - ${titulo || 'Contrato'}`;
        const corpo = `Prezado(a) ${nomeParte || 'Signatário'},\n\nSegue em anexo o contrato assinado digitalmente.\n\nTítulo: ${titulo}\nAssinado em: ${new Date().toLocaleDateString('pt-BR')}\n\nAtenciosamente,\nConstrubook - Sistema de Gestão de Obras`;

        window.open(`mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`, '_blank');
    } catch (e) {
        console.error('[Email] Erro:', e);
        alert('Erro ao preparar e-mail: ' + e.message);
    }
}

// Marcar como assinado (fluxo legado: confirmação de recebimento sem desenhar)
async function marcarAssinado(id) {
    if (confirm("Confirmar que o contrato foi assinado e devolvido?")) {
        // Buscar o nome do signatário para o modal
        const snap = await db.collection("contratos").doc(id).get();
        const dados = snap.data();
        const email = dados.emailAssinante || '';
        const titulo = dados.titulo || 'Contrato';
        const nomeParte = dados.parte || 'Signatário';

        await db.collection("contratos").doc(id).update({
            status: 'assinado',
            dataAssinatura: firebase.firestore.FieldValue.serverTimestamp()
        });

        pdfAssinadoBlob = null;
        abrirModalSucesso(id, email, titulo, nomeParte);
        await carregarContratos();
    }
}

// Converter ArrayBuffer para base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Inicializar canvas quando DOM estiver pronto
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCanvasAssinatura);
else initCanvasAssinatura();
