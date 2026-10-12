const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../js/engine.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/../js/levels.js', 'utf8')
  .replace("if (typeof module !== 'undefined') module.exports = { FASES, DOCS };", '') +
  '\nreturn { avaliarFase, compilar, rodar, criarRng, FASES, lexer, DOCS };';
const E = new Function('module', src)({});
let falhas = 0;
const ok = (c, m) => { if (!c) { falhas++; console.log('FALHA:', m); } };

for (const f of E.FASES) {
  // gabarito passa em 3 mundos padrão e em 60 sementes aleatórias
  const base = [f.seed, f.seed * 1000 + 97, f.seed * 1000 + 194];
  let av = E.avaliarFase(f, f.solucao, base);
  ok(!av.compErro, `fase ${f.id} gabarito não compila: ${JSON.stringify(av.compErro)}`);
  if (!av.compErro) {
    ok(av.aprovado, `fase ${f.id} gabarito reprovado: ` + JSON.stringify({ reqs: av.reqs, m: av.mundos.map((x) => ({ e: x.run.erro, metas: x.metas })) }));
    for (let s = 1; s <= 60; s++) {
      av = E.avaliarFase(f, f.solucao, [s * 31 + f.id, s * 17, s * 5 + 3]);
      if (!av.aprovado) { ok(false, `fase ${f.id} gabarito falhou na semente ${s}: ` + JSON.stringify(av.mundos.map((x) => ({ e: x.run.erro, metas: x.metas })))); break; }
    }
  }
  // código inicial não pode passar
  av = E.avaliarFase(f, f.starter, base);
  ok(av.compErro || !av.aprovado, `fase ${f.id}: o código inicial já passa!`);
  const r = av.compErro ? av.compErro.msg : (av.mundos[0].run.erro ? 'ERRO: ' + av.mundos[0].run.erro.msg : 'sem erro, metas: ' + av.mundos[0].metas.map((x) => x.texto).join(' | '));
  console.log(`fase ${f.id} (${f.curto}) ok=${!falhas}  starter ->`, r);
}

// trapaças que devem falhar
const f5 = E.FASES[4];
const hard = `int main() { ${'if (terreno()==VAZIO){plantar();}else if(terreno()==BROTO){regar();}else if(terreno()==MADURO){colher();} mover(DIREITA);'.repeat(7)} return 0; }`;
let av = E.avaliarFase(f5, hard, [f5.seed, 5, 6]);
ok(!av.aprovado, 'fase 5: código com tamanho fixo não deveria passar');
console.log('fase 5 trapaça ->', av.mundos.map((x) => x.run.erro ? x.run.erro.msg : 'sem erro / ' + x.metas.map((m) => m.texto).join(';')));

// fase 3 com if soltos deve falhar na meta
const f3 = E.FASES[2];
const soltos = `int main(){ for(int i=0;i<6;i++){ if(terreno()==VAZIO){plantar();} if(terreno()==BROTO){regar();} if(terreno()==MADURO){colher();} if(i<5){mover(DIREITA);} } return 0; }`;
av = E.avaliarFase(f3, soltos, [f3.seed, 5, 6]);
ok(!av.aprovado, 'fase 3: if soltos não deveriam passar');
console.log('fase 3 if soltos ->', av.mundos[0].metas.map((m) => m.texto), av.reqs);

// erros amigáveis
const casos = {
  'ponto e vírgula': 'int main() {\n  colher()\n  mover(DIREITA);\n}',
  'variável': 'int main() {\n  int total = 0;\n  totl = 3;\n}',
  'função': 'int main() {\n  colhe();\n}',
  'vetor': 'int main() {\n  int v[3];\n  v[3] = 1;\n}',
  'chave': 'int main() {\n  colher();\n',
  'laço infinito': 'int main() {\n  while (1) { }\n}',
  'cerca': 'int main() {\n  mover(CIMA);\n}',
  'sem main': 'void x() {}',
  'tipo': 'int main() {\n  integer x = 3;\n}',
  'printf': 'int main() {\n  int x = 4;\n  printf("x vale %d\\n", x);\n  return 0;\n}',
  'dividir': 'int main() { int a = 5 / 0; }',
  'sem parênteses': 'int main() { colher; }',
};
for (const [nome, cod] of Object.entries(casos)) {
  try {
    const c = E.compilar(cod);
    const r = E.rodar(c, { w: 3, h: 1, tiles: [{ t: 2 }, { t: 2 }, { t: 2 }] });
    console.log(nome.padEnd(16), '->', r.erro ? `L${r.erro.line}: ${r.erro.msg}` : 'ok; saída=' + JSON.stringify(r.mundo.saidas));
  } catch (e) { console.log(nome.padEnd(16), '-> (compilação)', `L${e.line}: ${e.message}`); }
}

// aritmética e sintaxe misc
const m = E.rodar(E.compilar(`int g = 3; int f(int a, int b) { return a * b + g; }
int soma(int v[], int n) { int s = 0; for (int i = 0; i < n; i++) s += v[i]; return s; }
int main() { int v[4] = {1,2,3}; int i = 0; do { i++; } while (i < 5);
 printf("%d %d %d %d %d\\n", f(2,3), -7 / 2, -7 % 3, soma(v, 4), i); if (i == 5 && !0) printf("ok\\n"); return 0; }`),
  { w: 1, h: 1, tiles: [{ t: 0 }] });
console.log('misc ->', JSON.stringify(m.mundo.saidas), m.erro);
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);
