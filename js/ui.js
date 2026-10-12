/* ============================================================
   Roça em C — interface: campo em pixel art, editor e execução.
   ============================================================ */
const $ = (s) => document.querySelector(s);
const C = 72; // tamanho de um terreno no SVG
const LS_KEY = 'roca-em-c.v1';
const estado = { i: 0, codigos: {}, feitas: {}, mundoN: 0, vel: 3, token: 0, rodando: false, campo: null, confirmaReset: 0 };
const fase = () => FASES[estado.i];

/* ---------- persistência (só conveniência por navegador) ---------- */
function lerSalvo() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if (d && typeof d === 'object') {
      estado.codigos = d.codigos || {}; estado.feitas = d.feitas || {};
      if (Number.isInteger(d.i) && FASES[d.i]) estado.i = d.i;
    }
  } catch (e) { /* sem armazenamento: segue sem salvar */ }
}
function gravar() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ codigos: estado.codigos, feitas: estado.feitas, i: estado.i })); } catch (e) { /* ignora */ }
}

/* ---------- sprites ---------- */
const hash = (x, y) => ((Math.imul(x + 11, 73856093) ^ Math.imul(y + 7, 19349663)) >>> 0);
function sprite(grade, pal, px, ox, oy) {
  let out = '';
  grade.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      let j = x; while (j < row.length && row[j] === ch) j++;
      out += `<rect x="${ox + x * px}" y="${oy + y * px}" width="${(j - x) * px}" height="${px}" fill="${pal[ch]}"/>`;
      x = j;
    }
  });
  return out;
}
function gerarAbobora() {
  const rows = [];
  for (let y = 0; y < 12; y++) {
    let r = '';
    for (let x = 0; x < 12; x++) {
      let ch = '.';
      const dx = (x - 5.5) / 5.6, dy = (y - 7) / 4.4, d = dx * dx + dy * dy;
      if (d <= 1) { ch = 'o'; if (d > 0.68) ch = 'd'; else if (dx < -0.2 && dy < -0.15 && d < 0.5) ch = 'h'; else if ((x === 3 || x === 8) && d > 0.1) ch = 'k'; }
      if ((x === 5 || x === 6) && y >= 1 && y <= 3) ch = 's';
      if ((x === 7 || x === 8) && y === 2) ch = 'g';
      r += ch;
    }
    rows.push(r);
  }
  return rows;
}
function gerarPedra() {
  const rows = [];
  for (let y = 0; y < 12; y++) {
    let r = '';
    for (let x = 0; x < 12; x++) {
      const dx = (x - 5.5) / 5.4, dy = (y - 7.5) / 3.9, d = dx * dx + dy * dy;
      let ch = '.';
      if (d <= 1) { ch = 'r'; if (d > 0.7) ch = 'd'; else if (dx < -0.1 && dy < -0.2 && d < 0.55) ch = 'h'; else if (hash(x, y) % 7 === 0 && d < 0.65) ch = 'd'; }
      r += ch;
    }
    rows.push(r);
  }
  return rows;
}
const SPR = {
  broto: sprite([
    '............', '............', '............', '..gg....gg..', '.gGGg..gGGg.', '.gGGGggGGGg.',
    '..ggGGGGgg..', '....gGGg....', '.....ss.....', '.....ss.....', '.....ss.....', '............'],
  { g: '#7bd05a', G: '#3f9a3a', s: '#5a8f3a' }, 5, 0, 0),
  maduro: sprite(gerarAbobora(), { o: '#f28c28', d: '#b85a0e', h: '#ffc266', k: '#d9731a', s: '#4d8a35', g: '#6fcf5b' }, 5, 0, 0),
  pedra: sprite(gerarPedra(), { r: '#8f989d', d: '#5c6468', h: '#bcc3c6' }, 5, 0, 0),
  fazendeiro: sprite([
    '....hhhh....', '...hhhhhh...', 'hhhhhhhhhhhh', '...ffffff...', '...fKffKf...', '...ffffff...',
    '..BBBBBBBB..', '.fBBBBBBBBf.', '..BBBBBBBB..', '..BBBB.BBBB.', '..BBB..BBB..', '..kkk..kkk..'],
  { h: '#e9c46a', f: '#f1c9a0', K: '#1c1c1c', B: '#3b6fb6', k: '#5a3b23' }, 3, 30, 30),
};
const culturaSVG = (t) => (t === T.BROTO ? SPR.broto : t === T.MADURO ? SPR.maduro : t === T.PEDRA ? SPR.pedra : '');

/* ---------- campo ---------- */
function montarCampo(spec, f, rotulo) {
  const w = spec.w, h = spec.h, extra = f.indices ? 26 : 0, W = w * C, H = h * C + extra;
  let s = `<svg class="svg-campo" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" role="img" aria-label="Fazenda com ${w} colunas e ${h} linhas">`;
  s += `<rect class="grama" width="${W}" height="${H}"/>`;
  for (let i = 0; i < w * h * 2; i++) { const gx = hash(i, 3) % W, gy = hash(i, 9) % (h * C); s += `<rect class="grama2" x="${gx - gx % 6}" y="${gy - gy % 6}" width="6" height="6"/>`; }
  spec.tiles.forEach((t, i) => {
    const x = i % w, y = Math.floor(i / w);
    s += `<g class="tile${t.n && f.indices ? '' : ' vazio'}" id="tl${i}" transform="translate(${x * C},${y * C})">`;
    s += `<rect class="solo" x="2" y="2" width="${C - 4}" height="${C - 4}"/>`;
    for (let k = 0; k < 9; k++) {
      const hx = hash(x * 9 + k, y * 5 + k), px = 4 + (hx % 10) * 6, py = 4 + ((hx >> 8) % 10) * 6;
      s += `<rect class="${k % 2 ? 'solo2' : 'solo3'}" x="${px}" y="${py}" width="6" height="6"/>`;
    }
    s += `<rect class="agua" x="2" y="2" width="${C - 4}" height="${C - 4}"/>`;
    s += `<rect class="gota" x="10" y="12" width="4" height="8"/><rect class="gota" x="30" y="6" width="4" height="8"/><rect class="gota" x="52" y="14" width="4" height="8"/><rect class="gota" x="20" y="56" width="4" height="8"/>`;
    s += `<g class="cultura" transform="translate(6,2)">${culturaSVG(t.t)}</g>`;
    if (f.indices) s += `<g class="cont"><rect class="cont-fundo" x="4" y="46" width="26" height="22"/><text class="cont-txt" x="17" y="63">${t.n}</text></g>`;
    s += `<g class="selo" transform="translate(${C - 34},4)"><rect width="28" height="28" fill="#2b7a3b"/><rect x="5" y="13" width="4" height="4" fill="#fff"/><rect x="9" y="17" width="4" height="4" fill="#fff"/><rect x="13" y="13" width="4" height="4" fill="#fff"/><rect x="17" y="9" width="4" height="4" fill="#fff"/><rect x="21" y="5" width="4" height="4" fill="#fff"/></g>`;
    s += '</g>';
  });
  if (f.indices) for (let x = 0; x < w; x++) s += `<text class="idx" x="${x * C + C / 2}" y="${h * C + 19}">[${x}]</text>`;
  const sx = spec.start ? spec.start[0] : 0, sy = spec.start ? spec.start[1] : 0;
  s += `<g class="fazendeiro" id="fz" style="transform:translate(${sx * C}px,${sy * C}px)"><g class="bob">${SPR.fazendeiro}</g></g></svg>`;
  $('#campo').innerHTML = s;
  const m = $('#moldura'); m.classList.remove('festa', 'oops');
  estado.campo = { spec, w, h, x: sx, y: sy, col: 0 };
  hud(); $('#hudCel').textContent = 'nada'; $('#hudMundo').textContent = rotulo || 'Fazenda de treino';
}
function hud() { const c = estado.campo; $('#hudPos').textContent = `(${c.x}, ${c.y})`; $('#hudCol').textContent = c.col; }

function aplicar(ev, base) {
  const c = estado.campo;
  if (ev.k === 'mover') {
    c.x = ev.x; c.y = ev.y;
    const fz = $('#fz'); fz.style.setProperty('--passo', Math.min(base * 0.85, 320) + 'ms');
    fz.style.transform = `translate(${ev.x * C}px,${ev.y * C}px)`; hud();
  } else if (ev.k === 'acao') {
    const tl = $('#tl' + (ev.y * c.w + ev.x));
    tl.querySelector('.cultura').innerHTML = culturaSVG(ev.t);
    tl.classList.add('feito'); tl.classList.toggle('molhado', !!ev.molhado);
    if (ev.a === 'colher') { c.col++; tl.classList.add('vazio'); hud(); }
  } else if (ev.k === 'entregar') {
    $('#hudCel').textContent = ev.n;
  } else if (ev.k === 'say') {
    const so = $('#saida'); so.textContent += ev.text; so.scrollTop = so.scrollHeight;
  }
}

/* ---------- editor ---------- */
const ta = $('#codigo');
const LH = 22, PAD = 12;
let gutN = 0;
function gutter() {
  const n = ta.value.split('\n').length;
  if (n !== gutN) { $('#gutter pre').textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); gutN = n; }
}
const barras = { ativa: null, erro: null };
function posBarra(el, linha) {
  if (!linha) { el.style.display = 'none'; return; }
  el.style.display = 'block'; el.style.top = (PAD + (linha - 1) * LH - ta.scrollTop) + 'px';
}
function sincronizar() { $('#gutter').scrollTop = ta.scrollTop; posBarra($('#barraAtiva'), barras.ativa); posBarra($('#barraErro'), barras.erro); }
function marcar(linha) { barras.ativa = linha; posBarra($('#barraAtiva'), linha); if (linha) rolarPara(linha); }
function marcarErro(linha) { barras.ativa = null; barras.erro = linha; posBarra($('#barraAtiva'), null); posBarra($('#barraErro'), linha); if (linha) rolarPara(linha); }
function limparBarras() { barras.ativa = null; barras.erro = null; sincronizar(); }
function rolarPara(linha) {
  const y = PAD + (linha - 1) * LH;
  if (y < ta.scrollTop + 10) ta.scrollTop = Math.max(0, y - 40);
  else if (y + LH > ta.scrollTop + ta.clientHeight - 20) ta.scrollTop = y - ta.clientHeight + 70;
  sincronizar();
}
function inserir(txt) {
  ta.focus();
  let ok = false;
  try { ok = document.execCommand('insertText', false, txt); } catch (e) { ok = false; }
  if (!ok) { const s = ta.selectionStart; ta.setRangeText(txt, s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
}
ta.addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); executar(); return; }
  if (ev.key === 'Tab' && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); inserir('    '); return; }
  if (ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
    const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    const ls = v.lastIndexOf('\n', s - 1) + 1, base = v.slice(ls, s).match(/^[ \t]*/)[0];
    ev.preventDefault();
    if (v[s - 1] === '{' && v[e] === '}') {
      inserir('\n' + base + '    \n' + base);
      const pos = s + 1 + base.length + 4; ta.setSelectionRange(pos, pos);
    } else if (v[s - 1] === '{') inserir('\n' + base + '    ');
    else inserir('\n' + base);
    return;
  }
  if (ev.key === '}' && !ev.ctrlKey && !ev.metaKey) {
    const s = ta.selectionStart, v = ta.value, ls = v.lastIndexOf('\n', s - 1) + 1, antes = v.slice(ls, s);
    if (/^ {4,}$/.test(antes) && s === ta.selectionEnd) { ev.preventDefault(); ta.setSelectionRange(s - 4, s); inserir('}'); }
  }
});
ta.addEventListener('input', () => { gutter(); sincronizar(); estado.codigos[fase().id] = ta.value; gravar(); });
ta.addEventListener('scroll', sincronizar);

/* ---------- exibição da fase ---------- */
function colorir(code) {
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*")|\b(int|void|if|else|while|for|do|return|break|continue)\b|\b(\d+)\b|\b([A-Z][A-Z_]{2,})\b|\b([a-z_]\w*)(?=\()/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : m[4] ? 'n' : m[5] ? 'u' : 'f';
    out += `<span class="t-${cls}">${esc(m[0])}</span>`; last = re.lastIndex;
  }
  return out + esc(code.slice(last));
}
const txt = (s) => document.createTextNode(s);
function renderPassos() {
  const nav = $('#fases'); nav.textContent = '';
  FASES.forEach((f, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fase-btn' + (estado.feitas[f.id] ? ' feita' : '');
    if (i === estado.i) b.setAttribute('aria-current', 'step');
    b.title = `Fase ${f.id}: ${f.conceito}` + (estado.feitas[f.id] ? ' (concluída)' : '');
    b.innerHTML = `<span class="n">${f.id}</span><span class="l">${f.curto}</span>`;
    b.addEventListener('click', () => irParaFase(i));
    nav.appendChild(b);
  });
}
function renderFase() {
  const f = fase();
  renderPassos();
  $('#kicker').textContent = `Fase ${f.id} de ${FASES.length} · ${f.conceito}`;
  $('#titulo').textContent = f.nome;
  $('#historia').textContent = f.historia;
  const ul = $('#objetivos'); ul.textContent = '';
  f.objetivos.forEach((o) => { const li = document.createElement('li'); li.textContent = o; ul.appendChild(li); });
  $('#aprenda').textContent = f.aprenda;
  $('#exemplo').innerHTML = colorir(f.exemplo);
  $('#nota').textContent = f.nota;
  const dl = $('#comandos'); dl.textContent = '';
  f.tools.forEach((n) => {
    const [sig, desc] = DOCS[n], dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = sig; dd.textContent = desc; dl.append(dt, dd);
  });
  $('#dica').open = false; $('#dicaTxt').textContent = f.dica;
  $('#prof').open = false; $('#gabarito').innerHTML = colorir(f.solucao);
  ta.value = estado.codigos[f.id] != null ? estado.codigos[f.id] : f.starter;
  ta.scrollTop = 0; gutN = -1; gutter(); limparBarras();
  resetResultado();
  montarCampo(fase().gerar(criarRng(semente(f, 0)), 0), f, 'Fazenda de treino');
}
function irParaFase(i) {
  if (i === estado.i && !estado.rodando) return;
  parar(true); estado.codigos[fase().id] = ta.value;
  estado.i = i; estado.mundoN = 0; gravar(); renderFase();
}

/* ---------- resultado ---------- */
function status(s, t) { $('#estado').dataset.s = s; $('#estadoTxt').textContent = t; $('#btnProxima').hidden = true; }
function resetResultado() {
  status('ocioso', 'Escreva seu código e clique em Executar (ou Ctrl+Enter).');
  $('#checks').textContent = ''; $('#saida').textContent = '';
}
function itemCheck(ul, ok, texto) {
  const li = document.createElement('li'); li.className = ok ? 'ok' : 'falha';
  const sel = document.createElement('span'); sel.className = 'sel'; sel.textContent = ok ? '✓' : '✕';
  const sp = document.createElement('span'); sp.textContent = texto; li.append(sel, sp); ul.appendChild(li);
}
function mostrarChecks(w, av) {
  const ul = $('#checks'); ul.textContent = '';
  const h1 = document.createElement('h3'); h1.textContent = w.k > 0 ? `Resultado na fazenda de teste ${w.k}` : 'Resultado na fazenda';
  ul.appendChild(h1);
  w.metas.forEach((m) => itemCheck(ul, m.ok, m.texto));
  const h2 = document.createElement('h3'); h2.textContent = 'Conceito da fase'; ul.appendChild(h2);
  av.reqs.forEach((r) => itemCheck(ul, r.ok, r.texto));
}

/* ---------- execução ---------- */
const semente = (f, k) => (k === 0 ? f.seed + estado.mundoN * 31 : f.seed * 1000 + k * 97);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
function botoes() { $('#btnRodar').disabled = estado.rodando; $('#btnParar').disabled = !estado.rodando; }
function parar(silencioso) {
  estado.token++;
  if (estado.rodando) { estado.rodando = false; botoes(); if (!silencioso) status('ocioso', 'Execução interrompida.'); }
  limparBarras();
}
async function executar() {
  if (estado.rodando) return;
  const f = fase();
  estado.codigos[f.id] = ta.value; gravar();
  limparBarras(); $('#saida').textContent = ''; $('#checks').textContent = '';
  const av = avaliarFase(f, ta.value, [0, 1, 2].map((k) => semente(f, k)));
  if (av.compErro) {
    status('erro', `Erro na linha ${av.compErro.line == null ? '?' : av.compErro.line}: ${av.compErro.msg}`);
    marcarErro(av.compErro.line); return;
  }
  const w = av.mundos[av.exibir];
  montarCampo(w.spec, f, w.k > 0 ? `Fazenda de teste ${w.k}` : 'Fazenda de treino');
  estado.rodando = true; const tk = ++estado.token; botoes();
  status('rodando', w.k > 0 ? `Rodando na fazenda de teste ${w.k}…` : 'Rodando…');
  const base = [900, 520, 300, 140, 45][estado.vel - 1];
  for (const ev of w.run.trace) {
    if (tk !== estado.token) return;
    if (ev.line) marcar(ev.line);
    aplicar(ev, base);
    await dormir(ev.k === 'say' ? base * 0.6 : base);
  }
  if (tk !== estado.token) return;
  await dormir(200);
  if (tk !== estado.token) return;
  estado.rodando = false; botoes(); finalizar(av, w);
}
function finalizar(av, w) {
  const f = fase(), er = w.run.erro;
  limparBarras();
  mostrarChecks(w, av);
  if (er) {
    status('erro', `Erro na linha ${er.line == null ? '?' : er.line}: ${er.msg}`);
    marcarErro(er.line);
    const m = $('#moldura'); m.classList.remove('oops'); void m.offsetWidth; m.classList.add('oops');
    return;
  }
  if (av.aprovado) {
    estado.feitas[f.id] = true; gravar(); renderPassos();
    status('ok', 'Fase concluída! Seu código funcionou nas 3 fazendas.');
    const b = $('#btnProxima');
    if (estado.i < FASES.length - 1) { b.hidden = false; b.textContent = 'Próxima fase'; }
    else status('ok', 'Você concluiu todas as fases!');
    const m = $('#moldura'); m.classList.remove('festa'); void m.offsetWidth; m.classList.add('festa');
    return;
  }
  if (!w.ok) {
    status('falha', w.k > 0
      ? 'Funcionou na fazenda que você viu, mas falhou em uma fazenda de teste. Um bom programa funciona em qualquer fazenda, não só nessa.'
      : 'Ainda não. Veja abaixo o que faltou.');
  } else {
    status('falha', 'O resultado está certo, mas esta fase pede para usar o conceito que está marcado abaixo.');
  }
}

/* ---------- ligações ---------- */
$('#btnRodar').addEventListener('click', executar);
$('#btnParar').addEventListener('click', () => parar(false));
$('#btnProxima').addEventListener('click', () => irParaFase(estado.i + 1));
$('#btnMundo').addEventListener('click', () => {
  parar(true); estado.mundoN++;
  montarCampo(fase().gerar(criarRng(semente(fase(), 0)), 0), fase(), 'Fazenda de treino');
  $('#saida').textContent = ''; limparBarras();
});
$('#vel').addEventListener('input', (e) => { estado.vel = +e.target.value; });
$('#btnRestaurar').addEventListener('click', (e) => {
  const b = e.currentTarget;
  if (!estado.confirmaReset) {
    estado.confirmaReset = setTimeout(() => { estado.confirmaReset = 0; b.textContent = 'Código inicial'; }, 3000);
    b.textContent = 'Apagar meu código?'; return;
  }
  clearTimeout(estado.confirmaReset); estado.confirmaReset = 0; b.textContent = 'Código inicial';
  parar(true); ta.value = fase().starter; estado.codigos[fase().id] = ta.value; gravar();
  gutN = -1; gutter(); limparBarras(); resetResultado();
});
$('#btnGabarito').addEventListener('click', () => {
  parar(true); ta.value = fase().solucao; estado.codigos[fase().id] = ta.value; gravar();
  gutN = -1; gutter(); limparBarras(); resetResultado();
});

lerSalvo();
renderFase();
