# Roça em C

Jogo educativo no estilo *The Farmer Was Replaced* para ensinar lógica de programação em C em sala de aula.
O aluno escreve C de verdade num editor e um fazendeiro em pixel art executa o código numa horta.

## Fases

1. `if` simples
2. `if` / `else`
3. `else if` encadeado
4. `for`
5. `while`
6. laços aninhados
7. função `void` sem parâmetros
8. função com parâmetros
9. função com retorno
10. vetor (ler e somar)
11. vetor (achar o maior valor)

Cada tentativa roda em 3 fazendas diferentes (1 animada e 2 de teste) e a fase exige o conceito ensinado,
conferido na árvore sintática do código. Cada fase traz um gabarito recolhido para o professor.

## Rodar localmente

É um site estático, sem build. Abra `index.html` no navegador ou use um servidor local:

```sh
npm start        # serve a pasta em http://localhost:3000
npm test         # testa os 11 gabaritos em dezenas de fazendas aleatórias
```

## Deploy

Basta publicar a pasta como site estático (precisam ir `index.html`, `css/` e `js/`).

- **GitHub Pages:** suba o repositório para o GitHub, em *Settings → Pages* escolha *GitHub Actions* como fonte.
  O workflow `.github/workflows/pages.yml` roda os testes e publica a cada push na branch `main`.
- **Netlify / Vercel / Cloudflare Pages:** importe o repositório. Sem comando de build; diretório de saída: raiz (`/`).
- **Servidor próprio:** copie `index.html`, `css/` e `js/` para qualquer pasta servida por HTTP.

As fontes (Pixelify Sans, Atkinson Hyperlegible, JetBrains Mono) vêm do Google Fonts. Sem internet o jogo funciona com fontes do sistema.

## Estrutura

```
index.html        página
css/style.css     estilos (tema claro e escuro)
js/engine.js      léxico, parser e interpretador do subconjunto de C, mundo do jogo
js/levels.js      as 11 fases: textos, geradores de fazenda, metas, requisitos e gabaritos
js/ui.js          campo em pixel art, editor, execução animada, progresso (localStorage)
test/test.js      testes dos gabaritos e das mensagens de erro
```

## Adicionar ou editar uma fase

Edite o array `FASES` em `js/levels.js`: cada fase define `gerar` (a fazenda), `metas` (o que conferir no resultado),
`reqs` (conceito exigido), `starter` e `solucao`. Rode `npm test`: o teste exige que o gabarito passe em todas as
fazendas sorteadas e que o código inicial não passe sozinho.

## Linguagem suportada

`int`, `void`, `if`/`else`, `while`, `do-while`, `for`, `break`, `continue`, `return`, funções (com protótipo e
parâmetro vetor), vetores `int v[N]`, `printf` só com `%d`. Variáveis começam com 0.
Comandos do jogo: `mover`, `terreno`, `colher`, `plantar`, `regar`, `pode_mover`, `largura`, `altura`, `contagem`,
`entregar`, `posicao_x`, `posicao_y`.
