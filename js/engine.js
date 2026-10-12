'use strict';
/* ============================================================
   Roça em C — motor: léxico, parser, interpretador e mundo.
   Subconjunto de C: int, void, if/else, while, do-while, for,
   funções, vetores (int v[N]), printf("%d").
   ============================================================ */

class CErro extends Error {
  constructor(msg, line) { super(msg); this.cerro = true; this.line = line == null ? null : line; }
}

const PALAVRAS = new Set(['int', 'void', 'if', 'else', 'while', 'for', 'do', 'return', 'break', 'continue']);
const NAO_SUPORTADAS = new Set(['char', 'float', 'double', 'long', 'short', 'unsigned', 'signed', 'struct', 'switch', 'case',
  'default', 'typedef', 'enum', 'union', 'goto', 'const', 'static', 'sizeof', 'register', 'volatile', 'extern']);

/* ---------- Léxico ---------- */
function lexer(src) {
  const toks = [];
  const n = src.length;
  let i = 0, line = 1, inicioLinha = true;
  const push = (t, v) => toks.push({ t, v, line });
  const dig = (c) => c >= '0' && c <= '9';
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; inicioLinha = true; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '#' && inicioLinha) { while (i < n && src[i] !== '\n') i++; continue; }
    inicioLinha = false;
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const ini = line; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      if (i >= n) throw new CErro('O comentário que começa na linha ' + ini + ' com /* nunca foi fechado com */.', ini);
      i += 2; continue;
    }
    if (dig(c)) {
      let j = i;
      while (j < n && dig(src[j])) j++;
      if (src[j] === '.' && dig(src[j + 1] || '')) throw new CErro('Números com vírgula (float) ainda não existem neste jogo. Use só números inteiros.', line);
      if (j < n && /[A-Za-z_]/.test(src[j])) throw new CErro('Número inválido: nomes de variáveis não podem começar com número.', line);
      push('num', parseInt(src.slice(i, j), 10)); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const w = src.slice(i, j);
      if (NAO_SUPORTADAS.has(w)) throw new CErro(`'${w}' ainda não faz parte desta versão do jogo (só existem int e void).`, line);
      push(PALAVRAS.has(w) ? 'kw' : 'id', w); i = j; continue;
    }
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < n && src[j] !== '"') {
        if (src[j] === '\n') throw new CErro('O texto entre aspas não foi fechado na mesma linha.', line);
        if (src[j] === '\\') {
          const e = src[j + 1];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e === '"' ? '"' : e === '\\' ? '\\' : e;
          j += 2;
        } else { s += src[j]; j++; }
      }
      if (j >= n) throw new CErro('O texto entre aspas não foi fechado.', line);
      push('str', s); i = j + 1; continue;
    }
    if (c === "'") {
      let ch, j = i + 1;
      if (src[j] === '\\') { const e = src[j + 1]; ch = e === 'n' ? 10 : e === 't' ? 9 : e.charCodeAt(0); j += 2; }
      else { ch = (src[j] || ' ').charCodeAt(0); j += 1; }
      if (src[j] !== "'") throw new CErro("Caractere entre aspas simples mal formado, como 'a'.", line);
      push('num', ch); i = j + 1; continue;
    }
    const dois = src.substr(i, 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%='].includes(dois)) { push('op', dois); i += 2; continue; }
    if ('+-*/%=<>!(){}[];,'.includes(c)) { push('op', c); i++; continue; }
    if (c === '&' || c === '|') throw new CErro(`Para "${c === '&' ? 'e' : 'ou'}" lógico use dois símbolos: ${c}${c}.`, line);
    throw new CErro(`Caractere inesperado: "${c}".`, line);
  }
  return toks;
}

/* ---------- Parser ---------- */
const NIVEIS = [['||'], ['&&'], ['==', '!='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%']];
const OPS_ATRIB = ['=', '+=', '-=', '*=', '/=', '%='];

class Parser {
  constructor(toks) {
    this.t = toks; this.p = 0;
    this.fim = { t: 'eof', v: '', line: toks.length ? toks[toks.length - 1].line : 1 };
  }
  get tok() { return this.t[this.p] || this.fim; }
  ant() { return this.t[this.p - 1] || this.tok; }
  ehOp(v) { const k = this.tok; return k.t === 'op' && k.v === v; }
  ehKw(v) { const k = this.tok; return k.t === 'kw' && k.v === v; }
  eatOp(v) { if (this.ehOp(v)) { this.p++; return true; } return false; }
  mostra(k) { return k.t === 'eof' ? 'o fim do código' : k.t === 'str' ? 'um texto' : `'${k.v}'`; }
  esperaOp(v, ctx) {
    if (this.ehOp(v)) { this.p++; return; }
    if (v === ';') throw new CErro(`Faltou um ponto e vírgula (;) ${ctx || 'no final da instrução'}.`, this.ant().line);
    if (this.tok.t === 'eof') throw new CErro(`O código terminou, mas faltou '${v}'.`, this.ant().line);
    throw new CErro(`Esperava '${v}' ${ctx || ''}, mas encontrei ${this.mostra(this.tok)}.`.replace(' ,', ','), this.tok.line);
  }
  esperaId(ctx) {
    const k = this.tok;
    if (k.t !== 'id') throw new CErro(`Esperava um nome ${ctx || ''}, mas encontrei ${this.mostra(k)}.`.replace(' ,', ','), k.line);
    this.p++; return k;
  }

  parsePrograma() {
    const funcs = new Map(), globais = [];
    while (this.tok.t !== 'eof') {
      const k = this.tok;
      if (!(k.t === 'kw' && (k.v === 'int' || k.v === 'void')))
        throw new CErro(`Esperava o começo de uma função ou variável (int ou void), mas encontrei ${this.mostra(k)}. Confira se sobrou alguma chave '}'.`, k.line);
      this.p++;
      const nome = this.esperaId('depois do tipo');
      if (this.ehOp('(')) {
        const f = this.parseFuncao(k.v, nome);
        if (f) {
          if (funcs.has(f.nome)) throw new CErro(`A função '${f.nome}' foi definida duas vezes.`, nome.line);
          funcs.set(f.nome, f);
        }
      } else {
        if (k.v === 'void') throw new CErro('Uma variável não pode ser void. Use int.', nome.line);
        this.p--;
        globais.push(this.parseDeclResto());
        this.esperaOp(';', 'no final da declaração');
      }
    }
    return { funcs, globais };
  }

  parseFuncao(ret, nome) {
    this.esperaOp('(');
    const params = [];
    if (this.ehKw('void') && this.t[this.p + 1] && this.t[this.p + 1].v === ')') this.p++;
    else if (!this.ehOp(')')) {
      do {
        if (!this.ehKw('int')) throw new CErro("Cada parâmetro precisa de um tipo: escreva 'int nome'.", this.tok.line);
        this.p++;
        const pn = this.esperaId('para o parâmetro');
        let isArray = false;
        if (this.eatOp('[')) { if (!this.ehOp(']')) this.parseAssign(); this.esperaOp(']'); isArray = true; }
        params.push({ nome: pn.v, isArray });
      } while (this.eatOp(','));
    }
    this.esperaOp(')', 'para fechar a lista de parâmetros');
    if (this.eatOp(';')) return null; // protótipo
    if (!this.ehOp('{')) throw new CErro(`Esperava '{' para começar o corpo da função ${nome.v}, mas encontrei ${this.mostra(this.tok)}.`, this.tok.line);
    const body = this.parseBloco();
    return { nome: nome.v, ret, params, body, line: nome.line };
  }

  parseBloco() {
    const ini = this.tok;
    this.esperaOp('{');
    const body = [];
    while (!this.ehOp('}')) {
      if (this.tok.t === 'eof') throw new CErro(`A chave '{' da linha ${ini.line} nunca foi fechada com '}'.`, ini.line);
      body.push(this.parseStmt());
    }
    this.p++;
    return { k: 'block', body, line: ini.line };
  }

  parseDeclResto() {
    const items = [], line = this.tok.line;
    do {
      const nome = this.esperaId('para a variável');
      let isArray = false, size = null, init = null, lista = null;
      if (this.eatOp('[')) { isArray = true; if (!this.ehOp(']')) size = this.parseAssign(); this.esperaOp(']'); }
      if (this.eatOp('=')) {
        if (isArray) {
          this.esperaOp('{'); lista = [];
          if (!this.ehOp('}')) { do { if (this.ehOp('}')) break; lista.push(this.parseAssign()); } while (this.eatOp(',')); }
          this.esperaOp('}');
        } else init = this.parseAssign();
      }
      if (isArray && size === null && lista === null) throw new CErro(`O vetor '${nome.v}' precisa de um tamanho, por exemplo ${nome.v}[5].`, nome.line);
      items.push({ nome: nome.v, isArray, size, init, lista, line: nome.line });
    } while (this.eatOp(','));
    return { k: 'decl', items, line };
  }

  parseStmt() {
    const k = this.tok;
    if (k.t === 'op' && k.v === '{') return this.parseBloco();
    if (k.t === 'op' && k.v === ';') { this.p++; return { k: 'vazio', line: k.line }; }
    if (k.t === 'kw') {
      switch (k.v) {
        case 'if': {
          this.p++; this.esperaOp('(', 'depois do if');
          const c = this.parseExpr(); this.esperaOp(')', 'para fechar a condição do if');
          const entao = this.parseStmt(); let senao = null;
          if (this.ehKw('else')) { this.p++; senao = this.parseStmt(); }
          return { k: 'if', c, entao, senao, line: k.line };
        }
        case 'while': {
          this.p++; this.esperaOp('(', 'depois do while');
          const c = this.parseExpr(); this.esperaOp(')', 'para fechar a condição do while');
          return { k: 'while', c, corpo: this.parseStmt(), line: k.line };
        }
        case 'do': {
          this.p++; const corpo = this.parseStmt();
          if (!this.ehKw('while')) throw new CErro("Depois do bloco do 'do' precisa vir 'while (condição);'.", this.tok.line);
          this.p++; this.esperaOp('('); const c = this.parseExpr(); this.esperaOp(')'); this.esperaOp(';', 'depois do while do do-while');
          return { k: 'dowhile', c, corpo, line: k.line };
        }
        case 'for': {
          this.p++; this.esperaOp('(', 'depois do for');
          let init = null;
          if (this.ehKw('int')) { this.p++; init = this.parseDeclResto(); }
          else if (!this.ehOp(';')) init = { k: 'expr', e: this.parseExpr(), line: k.line };
          this.esperaOp(';', 'depois da parte inicial do for');
          let c = null; if (!this.ehOp(';')) c = this.parseExpr();
          this.esperaOp(';', 'depois da condição do for');
          let passo = null; if (!this.ehOp(')')) passo = this.parseExpr();
          this.esperaOp(')', 'para fechar o for');
          return { k: 'for', init, c, passo, corpo: this.parseStmt(), line: k.line };
        }
        case 'return': {
          this.p++; let e = null;
          if (!this.ehOp(';')) e = this.parseExpr();
          this.esperaOp(';', 'depois do return');
          return { k: 'return', e, line: k.line };
        }
        case 'break': this.p++; this.esperaOp(';', 'depois do break'); return { k: 'break', line: k.line };
        case 'continue': this.p++; this.esperaOp(';', 'depois do continue'); return { k: 'continue', line: k.line };
        case 'int': {
          this.p++; const d = this.parseDeclResto(); this.esperaOp(';', 'no final da declaração'); return d;
        }
        case 'else': throw new CErro("Esse 'else' não tem um 'if' antes dele. Confira as chaves { }.", k.line);
        case 'void': throw new CErro('void só serve para funções. Para variáveis use int.', k.line);
      }
    }
    if (k.t === 'id' && this.t[this.p + 1] && this.t[this.p + 1].t === 'id')
      throw new CErro(`Não conheço o tipo '${k.v}'. Neste jogo as variáveis são declaradas com int.`, k.line);
    const e = this.parseExpr();
    this.esperaOp(';');
    return { k: 'expr', e, line: k.line };
  }

  parseExpr() { return this.parseAssign(); }
  parseAssign() {
    const l = this.parseBin(0), k = this.tok;
    if (k.t === 'op' && OPS_ATRIB.includes(k.v)) {
      if (l.k !== 'var' && l.k !== 'index') throw new CErro('Só dá para guardar um valor em uma variável (ou em uma posição de vetor).', k.line);
      this.p++;
      return { k: 'assign', op: k.v, target: l, e: this.parseAssign(), line: k.line };
    }
    return l;
  }
  parseBin(n) {
    if (n === NIVEIS.length) return this.parseUnario();
    let l = this.parseBin(n + 1);
    while (this.tok.t === 'op' && NIVEIS[n].includes(this.tok.v)) {
      const op = this.tok; this.p++;
      l = { k: 'bin', op: op.v, l, r: this.parseBin(n + 1), line: op.line };
    }
    return l;
  }
  checaLv(e, k) {
    if (e.k !== 'var' && e.k !== 'index') throw new CErro(`${k.v} só funciona com uma variável.`, k.line);
  }
  parseUnario() {
    const k = this.tok;
    if (k.t === 'op' && (k.v === '!' || k.v === '-' || k.v === '+')) { this.p++; return { k: 'un', op: k.v, e: this.parseUnario(), line: k.line }; }
    if (k.t === 'op' && (k.v === '++' || k.v === '--')) {
      this.p++; const e = this.parseUnario(); this.checaLv(e, k);
      return { k: 'incdec', op: k.v, prefixo: true, target: e, line: k.line };
    }
    return this.parsePosfixo();
  }
  parsePosfixo() {
    let e = this.parsePrimario();
    for (;;) {
      const k = this.tok;
      if (k.t === 'op' && k.v === '[') {
        if (e.k === 'index') throw new CErro('Vetores com duas dimensões ainda não existem neste jogo.', k.line);
        if (e.k !== 'var') throw new CErro('Os colchetes [ ] só funcionam logo depois do nome de um vetor.', k.line);
        this.p++; const idx = this.parseExpr(); this.esperaOp(']', 'para fechar o índice do vetor');
        e = { k: 'index', base: e, idx, line: k.line };
      } else if (k.t === 'op' && (k.v === '++' || k.v === '--')) {
        this.checaLv(e, k); this.p++;
        e = { k: 'incdec', op: k.v, prefixo: false, target: e, line: k.line };
      } else break;
    }
    return e;
  }
  parsePrimario() {
    const k = this.tok;
    if (k.t === 'num') { this.p++; return { k: 'num', v: k.v, line: k.line }; }
    if (k.t === 'str') { this.p++; return { k: 'str', v: k.v, line: k.line }; }
    if (k.t === 'op' && k.v === '(') { this.p++; const e = this.parseExpr(); this.esperaOp(')', 'para fechar o parêntese'); return e; }
    if (k.t === 'id') {
      this.p++;
      if (this.ehOp('(')) {
        this.p++; const args = [];
        if (!this.ehOp(')')) { do { args.push(this.parseAssign()); } while (this.eatOp(',')); }
        this.esperaOp(')', `para fechar a chamada de ${k.v}(`);
        return { k: 'call', name: k.v, args, line: k.line };
      }
      return { k: 'var', name: k.v, line: k.line };
    }
    if (k.t === 'kw') throw new CErro(`Não dá para usar '${k.v}' aqui.`, k.line);
    throw new CErro(`Esperava um valor ou uma variável, mas encontrei ${this.mostra(k)}.`, k.line);
  }
}

/* ---------- Análise estática (para os requisitos de cada fase) ---------- */
function analisar(prog) {
  const f = { ifs: 0, ifElse: 0, elseIf: 0, fors: 0, whiles: 0, aninhados: 0, arraysDecl: 0, indexUses: 0, funcs: [] };
  const expr = (e) => {
    if (!e) return;
    switch (e.k) {
      case 'index': f.indexUses++; expr(e.idx); break;
      case 'bin': expr(e.l); expr(e.r); break;
      case 'un': expr(e.e); break;
      case 'assign': expr(e.target); expr(e.e); break;
      case 'incdec': expr(e.target); break;
      case 'call': e.args.forEach(expr); break;
    }
  };
  const stmt = (s, prof) => {
    if (!s) return;
    switch (s.k) {
      case 'block': s.body.forEach((x) => stmt(x, prof)); break;
      case 'decl': s.items.forEach((it) => { if (it.isArray) f.arraysDecl++; expr(it.init); expr(it.size); (it.lista || []).forEach(expr); }); break;
      case 'expr': expr(s.e); break;
      case 'if':
        f.ifs++; if (s.senao) { f.ifElse++; if (s.senao.k === 'if') f.elseIf++; }
        expr(s.c); stmt(s.entao, prof); stmt(s.senao, prof); break;
      case 'while': case 'dowhile': case 'for':
        if (s.k === 'for') f.fors++; else f.whiles++;
        if (prof > 0) f.aninhados++;
        if (s.k === 'for') { stmt(s.init, prof); expr(s.passo); }
        expr(s.c); stmt(s.corpo, prof + 1); break;
      case 'return': expr(s.e); break;
    }
  };
  for (const fn of prog.funcs.values()) {
    stmt(fn.body, 0);
    if (fn.nome !== 'main') f.funcs.push({ nome: fn.nome, ret: fn.ret, nparams: fn.params.length });
  }
  prog.globais.forEach((g) => stmt(g, 0));
  return f;
}

/* ---------- Interpretador ---------- */
class Escopo {
  constructor(pai) { this.pai = pai; this.vars = new Map(); }
  get(nome) { for (let s = this; s; s = s.pai) { const c = s.vars.get(nome); if (c) return c; } return null; }
  nomes() { const r = []; for (let s = this; s; s = s.pai) r.push(...s.vars.keys()); return r; }
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function sugestao(nome, cands) {
  const lim = nome.length <= 4 ? 1 : 2;
  let melhor = null, dm = lim + 1;
  for (const c of cands) { const d = lev(nome.toLowerCase(), c.toLowerCase()); if (d < dm) { dm = d; melhor = c; } }
  return melhor;
}

function criarInterprete(prog, opts) {
  const maxPassos = opts.maxPassos || 300000, maxProf = 200;
  let passos = 0, prof = 0;
  const chamadas = {};
  const global = new Escopo(null);
  const builtins = opts.builtins || {}, consts = opts.consts || {};

  const tick = (line) => {
    if (++passos > maxPassos) throw new CErro('Seu programa está demorando demais. Será que existe um laço que nunca termina?', line);
  };
  const num = (v, line) => {
    if (typeof v === 'number') return v;
    if (v === undefined) throw new CErro('Essa função é void: ela não devolve um valor para ser usado aqui.', line);
    if (v && v.vetor) throw new CErro(`'${v.nome}' é um vetor: use ${v.nome}[posição] para pegar um valor.`, line);
    throw new CErro('Textos só podem ser usados dentro do printf.', line);
  };
  const int32 = (x) => x | 0;

  function erroVar(nome, line, sc) {
    const s = sugestao(nome, [...sc.nomes(), ...Object.keys(consts)]);
    return new CErro(`A variável '${nome}' não foi declarada${s ? `. Você quis dizer '${s}'?` : ' (declare antes com int).'}`, line);
  }
  function celula(e, sc) {
    const c = sc.get(e.name);
    if (c) return c;
    if (e.name in consts) throw new CErro(`'${e.name}' é uma constante: seu valor não pode ser mudado.`, e.line);
    throw erroVar(e.name, e.line, sc);
  }
  function vetorDe(base, sc) {
    const c = sc.get(base.name);
    if (!c) throw erroVar(base.name, base.line, sc);
    if (!(c.v && c.v.vetor)) throw new CErro(`'${base.name}' não é um vetor, então não dá para usar [ ] nele.`, base.line);
    return c.v;
  }
  function posicao(e, sc) {
    const arr = vetorDe(e.base, sc);
    const i = num(ev(e.idx, sc), e.line);
    if (i < 0 || i >= arr.a.length)
      throw new CErro(`O vetor '${arr.nome}' tem ${arr.a.length} posições (de 0 a ${arr.a.length - 1}), mas o programa tentou usar a posição ${i}.`, e.line);
    return { arr, i };
  }

  function ev(e, sc) {
    switch (e.k) {
      case 'num': return e.v;
      case 'str': return e.v;
      case 'var': {
        const c = sc.get(e.name);
        if (c) return c.v;
        if (e.name in consts) return consts[e.name];
        if (builtins[e.name] || prog.funcs.has(e.name) || e.name === 'printf')
          throw new CErro(`'${e.name}' é uma função: para usá-la escreva ${e.name}() com parênteses.`, e.line);
        throw erroVar(e.name, e.line, sc);
      }
      case 'index': { const { arr, i } = posicao(e, sc); return arr.a[i]; }
      case 'un': {
        const v = num(ev(e.e, sc), e.line);
        return e.op === '-' ? int32(-v) : e.op === '+' ? v : (v === 0 ? 1 : 0);
      }
      case 'bin': {
        if (e.op === '&&') return num(ev(e.l, sc), e.line) !== 0 && num(ev(e.r, sc), e.line) !== 0 ? 1 : 0;
        if (e.op === '||') return num(ev(e.l, sc), e.line) !== 0 || num(ev(e.r, sc), e.line) !== 0 ? 1 : 0;
        const a = num(ev(e.l, sc), e.line), b = num(ev(e.r, sc), e.line);
        return conta(e.op, a, b, e.line);
      }
      case 'assign': {
        let ler, gravar;
        if (e.target.k === 'var') {
          const c = celula(e.target, sc);
          if (typeof c.v !== 'number') throw new CErro(`'${e.target.name}' é um vetor: use ${e.target.name}[posição] = valor.`, e.line);
          ler = () => c.v; gravar = (x) => { c.v = x; };
        } else {
          const { arr, i } = posicao(e.target, sc);
          ler = () => arr.a[i]; gravar = (x) => { arr.a[i] = x; };
        }
        let r = num(ev(e.e, sc), e.line);
        if (e.op !== '=') r = conta(e.op[0], ler(), r, e.line);
        gravar(r); return r;
      }
      case 'incdec': {
        let ler, gravar;
        if (e.target.k === 'var') {
          const c = celula(e.target, sc);
          if (typeof c.v !== 'number') throw new CErro(`'${e.target.name}' é um vetor: use ${e.target.name}[posição].`, e.line);
          ler = () => c.v; gravar = (x) => { c.v = x; };
        } else {
          const { arr, i } = posicao(e.target, sc);
          ler = () => arr.a[i]; gravar = (x) => { arr.a[i] = x; };
        }
        const antes = ler(), depois = int32(antes + (e.op === '++' ? 1 : -1));
        gravar(depois); return e.prefixo ? depois : antes;
      }
      case 'call': return chamar(e, sc);
    }
    throw new CErro('Expressão não suportada.', e.line);
  }
  function conta(op, a, b, line) {
    switch (op) {
      case '+': return int32(a + b);
      case '-': return int32(a - b);
      case '*': return Math.imul(a, b);
      case '/': if (b === 0) throw new CErro('Divisão por zero.', line); return int32(Math.trunc(a / b));
      case '%': if (b === 0) throw new CErro('Divisão por zero (resto de uma divisão por 0).', line); return int32(a % b);
      case '==': return a === b ? 1 : 0;
      case '!=': return a !== b ? 1 : 0;
      case '<': return a < b ? 1 : 0;
      case '>': return a > b ? 1 : 0;
      case '<=': return a <= b ? 1 : 0;
      case '>=': return a >= b ? 1 : 0;
    }
    throw new CErro('Operador não suportado: ' + op, line);
  }

  function printf(e, sc) {
    if (!e.args.length || e.args[0].k !== 'str') throw new CErro('O printf precisa começar com um texto entre aspas, como printf("oi\\n").', e.line);
    const fmt = e.args[0].v; let ai = 1, out = '';
    for (let i = 0; i < fmt.length; i++) {
      const c = fmt[i];
      if (c !== '%') { out += c; continue; }
      const d = fmt[i + 1];
      if (d === 'd' || d === 'i') {
        if (ai >= e.args.length) throw new CErro('Faltou um valor para o %d do printf.', e.line);
        out += String(num(ev(e.args[ai++], sc), e.line)); i++;
      } else if (d === '%') { out += '%'; i++; }
      else throw new CErro(`Neste jogo o printf só entende %d (número inteiro), mas encontrou %${d || ''}.`, e.line);
    }
    if (ai < e.args.length) throw new CErro('Sobraram valores no printf: cada %d usa um valor.', e.line);
    opts.say(out, e.line);
    return undefined;
  }

  function chamar(e, sc) {
    if (e.name === 'printf') return printf(e, sc);
    const f = prog.funcs.get(e.name);
    if (f) {
      const args = e.args.map((a) => ev(a, sc));
      if (args.length !== f.params.length)
        throw new CErro(`A função ${f.nome}() espera ${f.params.length} argumento(s), mas recebeu ${args.length}.`, e.line);
      return chamarUsuario(f, args, e.line);
    }
    const b = builtins[e.name];
    if (b) {
      const args = e.args.map((a) => num(ev(a, sc), e.line));
      if (args.length !== b.n) throw new CErro(`${e.name}() espera ${b.n} argumento(s), mas recebeu ${args.length}.`, e.line);
      try { return b.fn(args, e.line); }
      catch (err) { if (err && err.cerro && err.line == null) err.line = e.line; throw err; }
    }
    const s = sugestao(e.name, [...Object.keys(builtins), ...prog.funcs.keys(), 'printf']);
    throw new CErro(`A função '${e.name}' não existe${s ? `. Você quis dizer '${s}'?` : ' (crie uma função com esse nome ou confira a digitação).'}`, e.line);
  }

  function chamarUsuario(f, args, line) {
    if (++prof > maxProf) throw new CErro('Funções chamando umas às outras vezes demais (recursão sem fim?).', line);
    const sc = new Escopo(global);
    f.params.forEach((p, i) => {
      const a = args[i];
      if (p.isArray) {
        if (!(a && a.vetor)) throw new CErro(`O parâmetro '${p.nome}' de ${f.nome}() é um vetor: passe o nome de um vetor.`, line);
      } else num(a, line);
      sc.vars.set(p.nome, { v: a });
    });
    chamadas[f.nome] = (chamadas[f.nome] || 0) + 1;
    const r = exec(f.body, sc);
    prof--;
    if (r && (r.sig === 'break' || r.sig === 'continue')) throw new CErro(`'${r.sig}' só pode ser usado dentro de um laço.`, r.line);
    if (f.ret === 'void') return undefined;
    return r && r.sig === 'return' && r.v !== undefined ? r.v : 0;
  }

  function declarar(d, sc) {
    for (const it of d.items) {
      if (sc.vars.has(it.nome)) throw new CErro(`A variável '${it.nome}' já foi declarada neste bloco.`, it.line);
      if (it.isArray) {
        let tam = it.size ? num(ev(it.size, sc), it.line) : it.lista.length;
        if (!Number.isInteger(tam) || tam < 1 || tam > 1000) throw new CErro(`O tamanho do vetor '${it.nome}' precisa ser um número entre 1 e 1000.`, it.line);
        const a = new Array(tam).fill(0);
        if (it.lista) {
          if (it.lista.length > tam) throw new CErro(`Valores demais para o vetor '${it.nome}' (${tam} posições).`, it.line);
          it.lista.forEach((x, i) => { a[i] = num(ev(x, sc), it.line); });
        }
        sc.vars.set(it.nome, { v: { vetor: true, nome: it.nome, a } });
      } else {
        sc.vars.set(it.nome, { v: it.init ? num(ev(it.init, sc), it.line) : 0 });
      }
    }
  }
  const verdade = (e, sc) => num(ev(e, sc), e.line) !== 0;

  function exec(s, sc) {
    tick(s.line);
    switch (s.k) {
      case 'block': {
        const inner = new Escopo(sc);
        for (const x of s.body) { const r = exec(x, inner); if (r) return r; }
        return null;
      }
      case 'vazio': return null;
      case 'decl': declarar(s, sc); return null;
      case 'expr': ev(s.e, sc); return null;
      case 'if':
        if (verdade(s.c, sc)) return exec(s.entao, sc);
        return s.senao ? exec(s.senao, sc) : null;
      case 'while':
        while (verdade(s.c, sc)) {
          tick(s.line);
          const r = exec(s.corpo, sc);
          if (r) { if (r.sig === 'break') break; if (r.sig === 'continue') continue; return r; }
        }
        return null;
      case 'dowhile':
        do {
          tick(s.line);
          const r = exec(s.corpo, sc);
          if (r) { if (r.sig === 'break') break; if (r.sig === 'continue') continue; return r; }
        } while (verdade(s.c, sc));
        return null;
      case 'for': {
        const ls = new Escopo(sc);
        if (s.init) exec(s.init, ls);
        while (s.c ? verdade(s.c, ls) : true) {
          tick(s.line);
          const r = exec(s.corpo, ls);
          if (r) { if (r.sig === 'break') break; if (r.sig !== 'continue') return r; }
          if (s.passo) ev(s.passo, ls);
        }
        return null;
      }
      case 'return': return { sig: 'return', v: s.e ? ev(s.e, sc) : undefined, line: s.line };
      case 'break': return { sig: 'break', line: s.line };
      case 'continue': return { sig: 'continue', line: s.line };
    }
    throw new CErro('Instrução não suportada.', s.line);
  }

  return {
    run() {
      for (const g of prog.globais) declarar(g, global);
      const m = prog.funcs.get('main');
      if (!m) throw new CErro('Não encontrei a função main(). Todo programa em C começa por ela: int main() { ... }', 1);
      chamarUsuario(m, [], 1);
      return { chamadas, passos };
    },
  };
}

/* ---------- Mundo do jogo ---------- */
const T = { VAZIO: 0, BROTO: 1, MADURO: 2, PEDRA: 3 };
const CONSTS = { CIMA: 0, DIREITA: 1, BAIXO: 2, ESQUERDA: 3, VAZIO: 0, BROTO: 1, MADURO: 2, PEDRA: 3 };
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const NOME_DIR = ['CIMA', 'DIREITA', 'BAIXO', 'ESQUERDA'];
const NOME_TERRENO = ['terra vazia', 'um broto', 'uma abóbora madura', 'uma pedra'];
const LIMITE_EVENTOS = 3000;

function criarMundo(spec) {
  return {
    w: spec.w, h: spec.h,
    x: spec.start ? spec.start[0] : 0, y: spec.start ? spec.start[1] : 0,
    tiles: spec.tiles.map((t) => ({ t: t.t, t0: t.t, n: t.n || 0, molhado: false, feitas: [] })),
    entregas: [], saidas: [], colheitas: 0,
  };
}

function criarBuiltins(m, trace) {
  const tile = () => m.tiles[m.y * m.w + m.x];
  const ev = (o) => {
    if (trace.length >= LIMITE_EVENTOS) throw new CErro('Seu programa fez ações demais (mais de ' + LIMITE_EVENTOS + '). Confira se algum laço está repetindo sem parar.');
    trace.push(o);
  };
  const dirOk = (d) => { if (d < 0 || d > 3) throw new CErro(`Direção inválida (${d}). Use CIMA, DIREITA, BAIXO ou ESQUERDA.`); };
  const podeIr = (d) => { const nx = m.x + DX[d], ny = m.y + DY[d]; return nx >= 0 && ny >= 0 && nx < m.w && ny < m.h; };
  const acao = (nome) => ({
    n: 0,
    fn: (_, line) => {
      const t = tile();
      if (nome === 'plantar' && t.t !== T.VAZIO) throw new CErro(`plantar() só funciona em terra vazia, mas aqui tem ${NOME_TERRENO[t.t]}.`);
      if (nome === 'regar' && t.t !== T.BROTO) throw new CErro(`regar() só funciona em um broto, mas aqui tem ${NOME_TERRENO[t.t]}.`);
      if (nome === 'regar' && t.molhado) throw new CErro('Este broto já foi regado.');
      if (nome === 'colher' && t.t !== T.MADURO) throw new CErro(`colher() só funciona em abóbora madura, mas aqui tem ${NOME_TERRENO[t.t]}.`);
      if (nome === 'plantar') t.t = T.BROTO;
      if (nome === 'regar') t.molhado = true;
      if (nome === 'colher') { t.t = T.VAZIO; m.colheitas++; }
      t.feitas.push(nome);
      ev({ k: 'acao', a: nome, x: m.x, y: m.y, t: t.t, molhado: t.molhado, line });
    },
  });
  return {
    mover: {
      n: 1,
      fn: ([d], line) => {
        dirOk(d);
        if (!podeIr(d)) throw new CErro(`O fazendeiro bateu na cerca! Ele estava em (${m.x}, ${m.y}) e tentou ir para ${NOME_DIR[d]}.`);
        m.x += DX[d]; m.y += DY[d];
        ev({ k: 'mover', x: m.x, y: m.y, d, line });
      },
    },
    plantar: acao('plantar'), regar: acao('regar'), colher: acao('colher'),
    terreno: { n: 0, fn: () => tile().t },
    contagem: { n: 0, fn: () => tile().n },
    pode_mover: { n: 1, fn: ([d]) => { dirOk(d); return podeIr(d) ? 1 : 0; } },
    largura: { n: 0, fn: () => m.w },
    altura: { n: 0, fn: () => m.h },
    posicao_x: { n: 0, fn: () => m.x },
    posicao_y: { n: 0, fn: () => m.y },
    entregar: { n: 1, fn: ([v], line) => { m.entregas.push(v); ev({ k: 'entregar', n: v, line }); } },
  };
}

function criarRng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
  f.pick = (arr) => arr[f.int(0, arr.length - 1)];
  f.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = f.int(0, i); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  return f;
}

/* ---------- Execução ---------- */
function compilar(codigo) {
  const prog = new Parser(lexer(codigo)).parsePrograma();
  return { prog, ast: analisar(prog) };
}

function rodar(comp, spec) {
  const trace = [], mundo = criarMundo(spec);
  let erro = null, chamadas = {};
  try {
    const it = criarInterprete(comp.prog, {
      builtins: criarBuiltins(mundo, trace), consts: CONSTS, maxPassos: 300000,
      say: (txt, line) => { mundo.saidas.push(txt); trace.push({ k: 'say', text: txt, line }); },
    });
    chamadas = it.run().chamadas;
  } catch (e) {
    if (e && e.cerro) erro = { msg: e.message, line: e.line };
    else erro = { msg: 'Erro interno do jogo: ' + (e && e.message), line: null };
  }
  return { mundo, trace, erro, chamadas };
}

/* Avalia o código de um aluno numa fase, em 3 mundos (1 animado + 2 de teste). */
function avaliarFase(fase, codigo, sementes) {
  let comp;
  try { comp = compilar(codigo); }
  catch (e) {
    if (e && e.cerro) return { compErro: { msg: e.message, line: e.line } };
    throw e;
  }
  const mundos = sementes.map((s, k) => {
    const spec = fase.gerar(criarRng(s), k);
    const run = rodar(comp, spec);
    const metas = fase.metas(run.mundo, run);
    const ok = !run.erro && metas.every((x) => x.ok);
    return { k, spec, run, metas, ok };
  });
  const info = { a: comp.ast, calls: mundos[0].run.chamadas };
  const reqs = fase.reqs.map((r) => ({ texto: r.texto, ok: !!r.teste(info) }));
  const aprovado = mundos.every((x) => x.ok) && reqs.every((r) => r.ok);
  let exibir = mundos.findIndex((x) => !x.ok);
  if (exibir < 0) exibir = 0;
  return { mundos, reqs, aprovado, exibir };
}

if (typeof module !== 'undefined') {
  module.exports = { CErro, lexer, Parser, compilar, rodar, avaliarFase, criarRng, criarMundo, T, CONSTS, NOME_TERRENO };
}
