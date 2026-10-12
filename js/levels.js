'use strict';
/* ============================================================
   Roça em C — as 11 fases.
   Cada fase tem: texto, gerador de mundo, metas, requisitos
   de conceito (checados na árvore do código) e gabarito.
   ============================================================ */

const DOCS = {
  mover: ['mover(DIREITA)', 'Anda um terreno para CIMA, DIREITA, BAIXO ou ESQUERDA. Bater na cerca é erro.'],
  terreno: ['terreno()', 'Devolve o que há aqui: VAZIO, BROTO, MADURO ou PEDRA.'],
  colher: ['colher()', 'Colhe a abóbora do terreno atual. Só funciona se estiver MADURA.'],
  plantar: ['plantar()', 'Planta uma semente. Só funciona em terra VAZIA.'],
  regar: ['regar()', 'Rega o broto do terreno atual. Só funciona em um BROTO.'],
  pode_mover: ['pode_mover(DIREITA)', 'Devolve 1 se existe terreno nessa direção, ou 0 se tem cerca.'],
  largura: ['largura()', 'Quantos terrenos a fazenda tem de um lado ao outro.'],
  altura: ['altura()', 'Quantos terrenos a fazenda tem de cima a baixo.'],
  contagem: ['contagem()', 'Quantas abóboras existem no terreno atual (de 1 a 9).'],
  entregar: ['entregar(n)', 'Entrega o número n ao celeiro.'],
  printf: ['printf("x = %d\\n", x)', 'Escreve na saída do programa. %d mostra um número inteiro.'],
};

const ind = (s, n) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');
const V = T.VAZIO, B = T.BROTO, M = T.MADURO, P = T.PEDRA;

/* ---------- helpers de mundo ---------- */
function linhaDeTiles(tipos, ns) { return tipos.map((t, i) => ({ t, n: ns ? ns[i] : (t === M ? 1 : 0) })); }
function sortearTipos(r, qtd, obrigatorios) {
  const arr = [...obrigatorios];
  while (arr.length < qtd) arr.push(r.pick([V, B, M, P]));
  return r.shuffle(arr);
}
function metasProcessar(acoes) {
  return (m) => {
    let esp = 0, ok = 0, extras = 0;
    for (const t of m.tiles) {
      const e = acoes[t.t0];
      if (e) { esp++; if (t.feitas.length === 1 && t.feitas[0] === e) ok++; else if (t.feitas.length) extras++; }
      else if (t.feitas.length) extras++;
    }
    return [
      { ok: ok === esp, texto: `Terrenos tratados do jeito certo: ${ok} de ${esp}` },
      { ok: extras === 0, texto: extras === 0 ? 'Nenhuma ação errada ou repetida' : `${extras} terreno(s) receberam uma ação errada ou repetida` },
    ];
  };
}
function metasEntrega(esperado, intacto) {
  return (m) => {
    const esp = esperado(m), r = [{
      ok: m.entregas.length === 1 && m.entregas[0] === esp,
      texto: `Valor entregue ao celeiro: ${m.entregas.length ? m.entregas.join(', ') : 'nada'} (o correto era ${esp})`,
    }];
    if (m.entregas.length > 1) r.push({ ok: false, texto: 'Entregue o valor uma única vez' });
    if (intacto) r.push({ ok: m.tiles.every((t) => t.feitas.length === 0), texto: 'Os terrenos ficaram como estavam' });
    return r;
  };
}

/* ---------- gabaritos ---------- */
const CADEIA = `if (terreno() == VAZIO) {
    plantar();
} else if (terreno() == BROTO) {
    regar();
} else if (terreno() == MADURO) {
    colher();
}`;
const COLHE = `if (terreno() == MADURO) {
    colher();
}`;
const REGA_OU_COLHE = `if (terreno() == MADURO) {
    colher();
} else {
    regar();
}`;
const repetir = (bloco, n) => 'int main() {\n' +
  Array.from({ length: n }, (_, i) => ind(bloco, 4) + (i < n - 1 ? '\n    mover(DIREITA);' : '')).join('\n\n') +
  '\n\n    return 0;\n}\n';

const GRADE_MAIN = (chamada) => `int main() {
    int sentido = DIREITA;
    for (int linha = 0; linha < altura(); linha++) {
        for (int coluna = 0; coluna < largura(); coluna++) {
${ind(chamada, 12)}
            if (coluna < largura() - 1) {
                mover(sentido);
            }
        }
        if (linha < altura() - 1) {
            mover(BAIXO);
        }
        if (sentido == DIREITA) {
            sentido = ESQUERDA;
        } else {
            sentido = DIREITA;
        }
    }
    return 0;
}
`;

function gerarGrade(r, k, tam) {
  let w, h;
  if (k === 1) [w, h] = tam.k1; else if (k === 2) [w, h] = tam.k2; else { w = r.int(...tam.w); h = r.int(...tam.h); }
  return { w, h, tiles: linhaDeTiles(sortearTipos(r, w * h, [V, B, M, P])) };
}

/* ---------- fases ---------- */
const FASES = [
  {
    id: 1, curto: 'if', conceito: 'Desvio condicional simples', nome: 'Primeira colheita', seed: 101,
    historia: 'A fileira tem 6 terrenos. Algumas abóboras já estão maduras e outras ainda são brotos. Passe por todos os terrenos e colha só as maduras.',
    objetivos: ['Colher todas as abóboras maduras', 'Deixar os brotos em paz'],
    aprenda: 'Um if executa um bloco somente quando a condição é verdadeira. Quando é falsa, o programa pula o bloco e segue em frente.',
    exemplo: `if (terreno() == MADURO) {
    colher();
}`,
    nota: 'Dois sinais de igual (==) comparam valores. Um só (=) guarda um valor numa variável.',
    tools: ['mover', 'terreno', 'colher'],
    dica: 'Você começa em cima do primeiro terreno. Para cada terreno: primeiro olhe (if), depois ande. Depois do último terreno não existe outro para onde ir. Repetir o mesmo trecho 6 vezes dá trabalho. Na fase 4 isso melhora.',
    gerar(r) { const k = r.int(2, 4), t = Array(6).fill(B); r.shuffle([0, 1, 2, 3, 4, 5]).slice(0, k).forEach((i) => { t[i] = M; }); return { w: 6, h: 1, tiles: linhaDeTiles(t) }; },
    metas: metasProcessar({ [M]: 'colher' }),
    reqs: [{ texto: 'Usar um if', teste: (i) => i.a.ifs >= 1 }],
    starter: `#include <roca.h>

int main() {
    // Você começa em cima do primeiro terreno.
    // Se a abóbora estiver madura, colha!
    if (terreno() == MADURO) {
        colher();
    }
    mover(DIREITA);

    // Repita para os próximos terrenos...

    return 0;
}
`,
    solucao: repetir(COLHE, 6),
  },
  {
    id: 2, curto: 'if / else', conceito: 'Desvio condicional com senão', nome: 'Regar ou colher', seed: 202,
    historia: 'Agora os brotos também precisam de cuidado. Colha o que está maduro. Todo o resto, que são os brotos, precisa ser regado.',
    objetivos: ['Colher as abóboras maduras', 'Regar todos os brotos'],
    aprenda: 'O else ("senão") é o caminho alternativo: roda quando a condição do if é falsa. Cada terreno recebe um caminho ou o outro, nunca os dois.',
    exemplo: `if (terreno() == MADURO) {
    colher();
} else {
    regar();
}`,
    nota: 'Se o terreno não está maduro, o programa cai no else. Aqui só existem dois tipos de terreno, então basta uma pergunta.',
    tools: ['mover', 'terreno', 'colher', 'regar'],
    dica: 'A pergunta é só uma: está maduro? Se sim, colha. Se não, rega.',
    gerar(r) { const k = r.int(2, 3), t = Array(5).fill(B); r.shuffle([0, 1, 2, 3, 4]).slice(0, k).forEach((i) => { t[i] = M; }); return { w: 5, h: 1, tiles: linhaDeTiles(t) }; },
    metas: metasProcessar({ [M]: 'colher', [B]: 'regar' }),
    reqs: [{ texto: 'Usar if com else', teste: (i) => i.a.ifElse >= 1 }],
    starter: `int main() {
    // Trate o terreno atual: colher se estiver maduro, regar se não.
    if (terreno() == MADURO) {
        colher();
    } else {
        regar();
    }
    mover(DIREITA);

    // Continue com os outros 4 terrenos...

    return 0;
}
`,
    solucao: repetir(REGA_OU_COLHE, 5),
  },
  {
    id: 3, curto: 'else if', conceito: 'Desvio condicional encadeado', nome: 'Terreno por terreno', seed: 303,
    historia: 'Agora tem de tudo: terra vazia, brotos, abóboras maduras e pedras. Plante na terra vazia, regue os brotos, colha as maduras e não faça nada nas pedras.',
    objetivos: ['Plantar na terra vazia', 'Regar os brotos', 'Colher as abóboras maduras', 'Não fazer nada nas pedras'],
    aprenda: 'Com else if você testa várias condições em sequência. O programa para na primeira que for verdadeira e ignora as outras.',
    exemplo: `if (terreno() == VAZIO) {
    plantar();
} else if (terreno() == BROTO) {
    regar();
} else if (terreno() == MADURO) {
    colher();
}`,
    nota: 'Vários if soltos em vez de else if podem dar mais de uma ação no mesmo terreno (planta e depois rega, por exemplo). Isso conta como erro.',
    tools: ['mover', 'terreno', 'plantar', 'regar', 'colher'],
    dica: 'Pedra não precisa de nenhuma ação: o encadeamento simplesmente termina sem entrar em nenhum bloco. Se ficar longo de copiar, a próxima fase resolve.',
    gerar(r) { return { w: 6, h: 1, tiles: linhaDeTiles(sortearTipos(r, 6, [V, B, M, P])) }; },
    metas: metasProcessar({ [V]: 'plantar', [B]: 'regar', [M]: 'colher' }),
    reqs: [{ texto: 'Usar pelo menos dois else if', teste: (i) => i.a.elseIf >= 2 }],
    starter: `int main() {
    // Trate o terreno atual com if / else if / else if.
    // As pedras ficam sem nenhuma ação.

    mover(DIREITA);

    return 0;
}
`,
    solucao: repetir(CADEIA, 6),
  },
  {
    id: 4, curto: 'for', conceito: 'Estrutura de repetição: for', nome: 'Fileira longa', seed: 404,
    historia: 'A fileira agora tem 10 terrenos. Chega de copiar e colar: use um laço for para repetir o tratamento de cada terreno.',
    objetivos: ['Tratar os 10 terrenos (plantar, regar, colher)', 'Não bater na cerca'],
    aprenda: 'O for repete um bloco um número definido de vezes. Ele tem três partes: onde começa, até quando continua e o que muda a cada volta.',
    exemplo: `for (int i = 0; i < 4; i++) {
    mover(DIREITA);
}`,
    nota: 'Esse laço roda 4 vezes (i vale 0, 1, 2 e 3). Com 10 terrenos, quantas vezes o fazendeiro pode andar sem bater na cerca?',
    tools: ['mover', 'terreno', 'plantar', 'regar', 'colher', 'printf'],
    dica: 'Há 10 terrenos, mas só 9 passos entre eles. Duas saídas: andar só 9 vezes e tratar o último terreno depois do laço, ou rodar 10 vezes e andar apenas quando i < 9.',
    gerar(r) { return { w: 10, h: 1, tiles: linhaDeTiles(sortearTipos(r, 10, [V, B, M, P])) }; },
    metas: metasProcessar({ [V]: 'plantar', [B]: 'regar', [M]: 'colher' }),
    reqs: [{ texto: 'Usar um laço for', teste: (i) => i.a.fors >= 1 }],
    starter: `int main() {
    for (int i = 0; i < 10; i++) {
        // trate o terreno atual (if / else if)

        mover(DIREITA);
    }
    return 0;
}
`,
    solucao: `int main() {
    for (int i = 0; i < 10; i++) {
${ind(CADEIA, 8)}
        if (i < 9) {
            mover(DIREITA);
        }
    }
    return 0;
}
`,
  },
  {
    id: 5, curto: 'while', conceito: 'Estrutura de repetição: while', nome: 'Tamanho desconhecido', seed: 505,
    historia: 'Esta fazenda tem um tamanho que você não sabe de antemão, e ele muda a cada teste. Use um laço while que anda enquanto ainda houver terreno pela frente.',
    objetivos: ['Tratar todos os terrenos, qualquer que seja o tamanho da fileira', 'Não bater na cerca'],
    aprenda: 'O while repete enquanto a condição for verdadeira. É a escolha certa quando você não sabe quantas voltas serão necessárias.',
    exemplo: `while (pode_mover(DIREITA)) {
    mover(DIREITA);
}`,
    nota: 'pode_mover(DIREITA) devolve 1 enquanto existe terreno à direita. Na cerca devolve 0 e o laço termina, mas o último terreno ainda não foi tratado.',
    tools: ['mover', 'pode_mover', 'terreno', 'plantar', 'regar', 'colher'],
    dica: 'Dentro do laço: trate o terreno e depois ande. Quando o laço acabar, o fazendeiro está no último terreno, que ainda precisa ser tratado.',
    gerar(r, k) { const w = k === 1 ? 5 : k === 2 ? 13 : r.int(7, 12); return { w, h: 1, tiles: linhaDeTiles(sortearTipos(r, w, [V, B, M, P])) }; },
    metas: metasProcessar({ [V]: 'plantar', [B]: 'regar', [M]: 'colher' }),
    reqs: [{ texto: 'Usar um laço while', teste: (i) => i.a.whiles >= 1 }],
    starter: `int main() {
    while (pode_mover(DIREITA)) {
        // trate o terreno atual

        mover(DIREITA);
    }
    // E o terreno onde o laço terminou?

    return 0;
}
`,
    solucao: `int main() {
    while (pode_mover(DIREITA)) {
${ind(CADEIA, 8)}
        mover(DIREITA);
    }
${ind(CADEIA, 4)}
    return 0;
}
`,
  },
  {
    id: 6, curto: 'laços aninhados', conceito: 'Laços dentro de laços', nome: 'Campo inteiro', seed: 606,
    historia: 'A fazenda agora tem várias fileiras. Use um laço dentro de outro: o de fora cuida das linhas e o de dentro cuida das colunas.',
    objetivos: ['Tratar todos os terrenos do campo', 'Funcionar para qualquer tamanho de campo'],
    aprenda: 'Quando um laço fica dentro de outro, o de dentro roda inteiro a cada volta do de fora. É o jeito de percorrer uma tabela linha por linha.',
    exemplo: `for (int linha = 0; linha < 3; linha++) {
    for (int coluna = 0; coluna < 4; coluna++) {
        printf("linha %d, coluna %d\\n", linha, coluna);
    }
}`,
    nota: 'O campo muda de tamanho a cada teste. largura() e altura() dizem quantas colunas e linhas ele tem.',
    tools: ['mover', 'largura', 'altura', 'terreno', 'plantar', 'regar', 'colher', 'printf'],
    dica: 'Ao terminar uma linha o fazendeiro está na ponta. Ele pode voltar até o começo da linha, ou descer e andar no sentido contrário (ESQUERDA) na linha seguinte.',
    gerar(r, k) { return gerarGrade(r, k, { k1: [3, 4], k2: [6, 3], w: [4, 6], h: [3, 4] }); },
    metas: metasProcessar({ [V]: 'plantar', [B]: 'regar', [M]: 'colher' }),
    reqs: [{ texto: 'Usar um laço dentro de outro laço', teste: (i) => i.a.aninhados >= 1 }],
    starter: `int main() {
    for (int linha = 0; linha < altura(); linha++) {
        for (int coluna = 0; coluna < largura(); coluna++) {
            // trate o terreno atual

            // ande para o lado (cuidado com a cerca!)
        }
        // desça para a próxima linha
    }
    return 0;
}
`,
    solucao: GRADE_MAIN(CADEIA),
  },
  {
    id: 7, curto: 'função void', conceito: 'Função sem parâmetros e sem retorno', nome: 'Hora de organizar', seed: 707,
    historia: 'O código da fase anterior ficou comprido. Crie uma função tratar() que cuida de UM terreno e chame ela de dentro dos laços. O main já está pronto: falta escrever a função.',
    objetivos: ['Criar a função tratar()', 'Tratar todos os terrenos do campo'],
    aprenda: 'Uma função dá nome a um pedaço de código. "void" quer dizer que ela não devolve valor, e os parênteses vazios dizem que ela não recebe nada.',
    exemplo: `void cumprimentar() {
    printf("Bom dia, roça!\\n");
}

int main() {
    cumprimentar();
    cumprimentar();
    return 0;
}`,
    nota: 'Em C, escreva a função antes do main. Rode o programa como está para ver o erro que aparece quando a função não existe.',
    tools: ['mover', 'terreno', 'plantar', 'regar', 'colher', 'printf'],
    dica: 'Dentro de tratar() vai o encadeamento de if / else if que você já escreveu. Nenhum laço entra nela, porque ela trata um terreno só.',
    gerar(r, k) { return gerarGrade(r, k, { k1: [4, 3], k2: [5, 4], w: [4, 5], h: [3, 4] }); },
    metas: metasProcessar({ [V]: 'plantar', [B]: 'regar', [M]: 'colher' }),
    reqs: [{ texto: 'Criar e chamar uma função void sem parâmetros', teste: (i) => i.a.funcs.some((f) => f.ret === 'void' && f.nparams === 0 && (i.calls[f.nome] || 0) > 0) }],
    starter: `// Escreva a função tratar() aqui, antes do main.

${GRADE_MAIN('tratar();')}`,
    solucao: `void tratar() {
${ind(CADEIA, 4)}
}

${GRADE_MAIN('tratar();')}`,
  },
  {
    id: 8, curto: 'parâmetros', conceito: 'Função com parâmetros', nome: 'Abóboras de canto', seed: 808,
    historia: 'Quatro abóboras gigantes cresceram nos cantos da fazenda, que é quadrada e muda de tamanho. Escreva uma função andar(direcao, passos) para percorrer as bordas sem repetir código.',
    objetivos: ['Colher as 4 abóboras dos cantos', 'Usar a função andar() mais de uma vez'],
    aprenda: 'Parâmetros são valores que a função recebe quando é chamada. Cada chamada pode usar valores diferentes, e o mesmo código serve para todas.',
    exemplo: `void gritar(int vezes) {
    for (int i = 0; i < vezes; i++) {
        printf("Ei!\\n");
    }
}

// gritar(3);   escreve "Ei!" três vezes
// gritar(1);   escreve "Ei!" uma vez`,
    nota: 'Os parâmetros vão dentro dos parênteses, cada um com seu tipo: void andar(int direcao, int passos). Um lado da fazenda tem largura() terrenos, então um canto fica a largura() - 1 passos do outro.',
    tools: ['mover', 'largura', 'colher', 'printf'],
    dica: 'Comece em um canto, colha, ande até o próximo canto, colha, e assim por diante. Cada trecho é uma chamada de andar() com a direção e o número de passos.',
    gerar(r, k) {
      const n = k === 1 ? 5 : k === 2 ? 9 : r.int(6, 8);
      const t = Array(n * n).fill(V);
      [0, n - 1, n * (n - 1), n * n - 1].forEach((i) => { t[i] = M; });
      return { w: n, h: n, tiles: linhaDeTiles(t) };
    },
    metas: metasProcessar({ [M]: 'colher' }),
    reqs: [{ texto: 'Criar uma função com parâmetros e chamá-la 2 vezes ou mais', teste: (i) => i.a.funcs.some((f) => f.nparams >= 1 && (i.calls[f.nome] || 0) >= 2) }],
    starter: `// Escreva aqui a função andar(), que recebe a direção
// e quantos passos dar.

int main() {
    colher();
    // ande até o próximo canto, colha, e continue...
    return 0;
}
`,
    solucao: `void andar(int direcao, int passos) {
    for (int i = 0; i < passos; i++) {
        mover(direcao);
    }
}

int main() {
    int lado = largura() - 1;
    colher();
    andar(DIREITA, lado);
    colher();
    andar(BAIXO, lado);
    colher();
    andar(ESQUERDA, lado);
    colher();
    return 0;
}
`,
  },
  {
    id: 9, curto: 'return', conceito: 'Função com retorno', nome: 'Contagem do celeiro', seed: 909,
    historia: 'O celeiro quer saber quantas abóboras estão maduras na fileira, sem que você colha nenhuma. Escreva uma função que conta e devolve o resultado com return, e entregue esse número.',
    objetivos: ['Contar as abóboras maduras da fileira', 'Entregar o número ao celeiro uma única vez', 'Não mexer nos terrenos'],
    aprenda: 'Uma função com retorno devolve um valor para quem a chamou, usando return. Esse valor pode ser guardado numa variável ou usado direto.',
    exemplo: `int dobro(int x) {
    return x * 2;
}

int main() {
    int d = dobro(21);
    printf("%d\\n", d);
    return 0;
}`,
    nota: 'O tipo antes do nome (int) diz o que a função devolve. Uma função void não tem return com valor.',
    tools: ['mover', 'largura', 'terreno', 'entregar', 'printf'],
    dica: 'Use uma variável total que começa em 0 e aumenta em 1 a cada abóbora madura. No fim da função, return total.',
    gerar(r, k) { const w = k === 1 ? 6 : k === 2 ? 12 : r.int(7, 11); return { w, h: 1, tiles: linhaDeTiles(sortearTipos(r, w, [M, M])) }; },
    metas: metasEntrega((m) => m.tiles.filter((t) => t.t0 === M).length, true),
    reqs: [{ texto: 'Criar e chamar uma função int que usa return', teste: (i) => i.a.funcs.some((f) => f.ret === 'int' && (i.calls[f.nome] || 0) > 0) }],
    starter: `int contar_maduros(int quantidade) {
    int total = 0;
    // percorra os terrenos e some 1 a cada abóbora madura

    return total;
}

int main() {
    int maduras = contar_maduros(largura());
    entregar(maduras);
    return 0;
}
`,
    solucao: `int contar_maduros(int quantidade) {
    int total = 0;
    for (int i = 0; i < quantidade; i++) {
        if (terreno() == MADURO) {
            total++;
        }
        if (i < quantidade - 1) {
            mover(DIREITA);
        }
    }
    return total;
}

int main() {
    int maduras = contar_maduros(largura());
    entregar(maduras);
    return 0;
}
`,
  },
  {
    id: 10, curto: 'vetor', conceito: 'Vetores (arrays)', nome: 'Caderno de colheita', seed: 1010, indices: true,
    historia: 'Cada terreno tem uma quantidade de abóboras, escrita no número do canto. Anote as 8 quantidades em um vetor enquanto anda. Depois some tudo e entregue o total ao celeiro.',
    objetivos: ['Guardar a contagem de cada terreno em um vetor', 'Somar os valores do vetor', 'Entregar o total ao celeiro'],
    aprenda: 'Um vetor guarda vários valores do mesmo tipo, cada um em uma posição numerada a partir do zero. int notas[3] cria notas[0], notas[1] e notas[2].',
    exemplo: `int notas[3];
notas[0] = 7;
notas[1] = 9;
notas[2] = 6;
printf("%d\\n", notas[1]);   // escreve 9`,
    nota: 'Usar notas[3] em um vetor de 3 posições é erro: o último índice é sempre tamanho - 1. A fileira tem 8 terrenos, então o vetor vai de [0] a [7].',
    tools: ['mover', 'contagem', 'entregar', 'printf'],
    dica: 'Um laço de 0 a 7 serve para os dois trabalhos: no primeiro, colheita[i] = contagem() e depois ande. No segundo, some colheita[i] em uma variável total. Não ande depois do último terreno.',
    gerar(r) { const ns = Array.from({ length: 8 }, () => r.int(1, 9)); return { w: 8, h: 1, tiles: linhaDeTiles(Array(8).fill(M), ns) }; },
    metas: metasEntrega((m) => m.tiles.reduce((a, t) => a + t.n, 0), false),
    reqs: [{ texto: 'Declarar um vetor e usar suas posições com índice', teste: (i) => i.a.arraysDecl >= 1 && i.a.indexUses >= 2 }],
    starter: `int main() {
    int colheita[8];   // posições de colheita[0] até colheita[7]

    for (int i = 0; i < 8; i++) {
        // guarde contagem() em colheita[i]
        // depois ande para a direita (menos no último terreno)
    }

    int total = 0;
    // some todos os valores do vetor em total

    entregar(total);
    return 0;
}
`,
    solucao: `int main() {
    int colheita[8];

    for (int i = 0; i < 8; i++) {
        colheita[i] = contagem();
        if (i < 7) {
            mover(DIREITA);
        }
    }

    int total = 0;
    for (int i = 0; i < 8; i++) {
        total = total + colheita[i];
    }

    entregar(total);
    return 0;
}
`,
  },
  {
    id: 11, curto: 'maior valor', conceito: 'Vetores: busca do maior valor', nome: 'Maior produção', seed: 1111, indices: true,
    historia: 'O celeiro só tem espaço para uma carga. Descubra qual terreno tem mais abóboras e colha somente ele.',
    objetivos: ['Anotar as contagens em um vetor', 'Descobrir o índice do maior valor', 'Voltar até esse terreno e colher só ele'],
    aprenda: 'Para achar o maior valor de um vetor, guarde o índice do melhor valor visto até agora e compare cada posição com ele.',
    exemplo: `int melhor = 0;   // índice do maior valor até agora
for (int i = 1; i < 8; i++) {
    if (v[i] > v[melhor]) {
        melhor = i;
    }
}`,
    nota: 'Ao final da leitura o fazendeiro está no terreno 7. Para chegar ao terreno de índice melhor, ele precisa voltar (7 - melhor) passos para a ESQUERDA.',
    tools: ['mover', 'contagem', 'colher', 'printf'],
    dica: 'Três etapas, uma de cada vez: 1) ler tudo para o vetor, 2) achar o índice do maior, 3) andar de volta e colher. Teste cada etapa com printf se precisar.',
    gerar(r) {
      let ns, max;
      do { ns = Array.from({ length: 8 }, () => r.int(1, 9)); max = Math.max(...ns); } while (ns.filter((x) => x === max).length !== 1);
      return { w: 8, h: 1, tiles: linhaDeTiles(Array(8).fill(M), ns) };
    },
    metas: (m) => {
      const max = Math.max(...m.tiles.map((t) => t.n)), idx = m.tiles.findIndex((t) => t.n === max);
      const certo = m.tiles[idx].feitas.length === 1 && m.tiles[idx].feitas[0] === 'colher';
      const outros = m.tiles.filter((t, i) => i !== idx && t.feitas.length > 0).length;
      return [
        { ok: certo, texto: `Colher o terreno com mais abóboras (era o de índice ${idx}, com ${max})` },
        { ok: outros === 0, texto: outros === 0 ? 'Nenhum outro terreno foi colhido' : `${outros} outro(s) terreno(s) foram colhidos sem precisar` },
      ];
    },
    reqs: [{ texto: 'Declarar um vetor e usar suas posições com índice', teste: (i) => i.a.arraysDecl >= 1 && i.a.indexUses >= 2 }],
    starter: `int main() {
    int colheita[8];

    // 1) ande pela fileira anotando as contagens no vetor

    // 2) descubra o índice do maior valor

    // 3) volte até esse terreno e colha

    return 0;
}
`,
    solucao: `int main() {
    int colheita[8];

    for (int i = 0; i < 8; i++) {
        colheita[i] = contagem();
        if (i < 7) {
            mover(DIREITA);
        }
    }

    int melhor = 0;
    for (int i = 1; i < 8; i++) {
        if (colheita[i] > colheita[melhor]) {
            melhor = i;
        }
    }

    for (int i = 7; i > melhor; i--) {
        mover(ESQUERDA);
    }
    colher();

    return 0;
}
`,
  },
];

if (typeof module !== 'undefined') module.exports = { FASES, DOCS };
