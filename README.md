# Damas Synthwave

Damas com as regras oficiais brasileiras, IA com minimax e poda alfa-beta, e estética synthwave. Roda direto no navegador, sem build e sem dependências.

## Como jogar

1. Dê um duplo clique em `index.html`, ou rode `start.bat` no Windows.
2. Clique numa peça para ver os destinos, ou arraste direto.
3. Teclado também funciona: `Tab` entra no tabuleiro, as setas movem o foco e `Enter` seleciona e joga.

Sem internet, o jogo continua funcionando. As fontes caem para as do sistema e os ícones vêm embutidos.

## Regras

- Tabuleiro 8×8, 12 pedras por lado, jogo nas casas escuras.
- A pedra anda uma casa na diagonal para frente e captura para frente e para trás.
- Captura é obrigatória. Pela lei da maioria, vale a sequência que tira mais peças (a regra casual desliga a lei da maioria).
- Ao chegar à última linha, a pedra vira dama voadora: anda e captura a qualquer distância nas quatro diagonais.
- Empate depois de 20 lances de cada lado só com damas, sem captura e sem mover pedra. O painel avisa quando a contagem começa.

## Modos e IA

- Contra a IA, 2 jogadores no mesmo aparelho, ou IA contra IA.
- Novato escolhe lances ao acaso entre os permitidos. Tático calcula 3 lances à frente. Mestre calcula 5, com poda alfa-beta.
- Desfazer contra a IA sempre volta até a sua vez, inclusive depois de uma derrota.

## Interface

| Área | O que mostra |
| :--- | :--- |
| Barra superior | De quem é a vez, aviso de captura obrigatória, IA pensando, atalho para o resultado no fim |
| Coluna esquerda | Os dois jogadores com peças restantes e damas, barra de vantagem, tempo, lances e modo |
| Coluna direita | Lances em pares numerados (`c3–d4`, `d4×b6`), capturas por lado e maior combo |
| Dock | Desfazer, dica, nova partida, lances e regras |

Em telas menores o layout empilha: oponente acima do tabuleiro, você abaixo e a lista de lances vira gaveta.

A barra de vantagem usa a mesma avaliação da IA (material, com dama valendo 3,2 pedras, mais posição).

## Atalhos

| Tecla | Ação |
| :--- | :--- |
| `Z` | Desfazer |
| `H` | Dica |
| `R` | Nova partida (pede confirmação se houver jogo em andamento) |
| `L` | Lances |
| `M` | Trilha sonora |
| `V` | Alternar tabuleiro 3D e 2D |
| `Esc` | Fecha painéis e cancela a seleção |

## Sistema de design

- Tipografia: Unbounded para marca e números grandes, Geist para a interface, Geist Mono para relógio, coordenadas e notação.
- Cores em variáveis CSS (`css/style.css`, seção 1). Três temas: Outrun, Cyberpunk e Laser. Os nomes dos lados acompanham o tema (Ciano e Magenta, Verde e Âmbar, Azul e Carmim).
- O neon fica reservado para estado: vez, seleção, captura. O resto é material: peças de laca com bisel, dama empilhada com coroa dourada sobre medalhão escuro, moldura de metal anodizado.
- Respeita `prefers-reduced-motion`, tem foco visível em todos os controles e rótulos acessíveis em cada casa do tabuleiro.
- Ajustes (modo, dificuldade, regras, tema, 3D, som) ficam salvos no navegador.

## Ícones

Os ícones são do [Phosphor Icons](https://phosphoricons.com) (licença MIT), nos pesos duotone, fill e bold. Eles ficam embutidos como sprite SVG em `js/icons.js`, o que permite gradiente dourado na coroa e funciona abrindo o arquivo direto do disco.

Para trocar ou adicionar ícones, edite a lista em `tools/build-icons.py` e rode:

```
python tools/build-icons.py
```

## Estrutura

| Arquivo | Papel |
| :--- | :--- |
| `js/engine.js` | Regras, lances legais, lei da maioria, empate |
| `js/ai.js` | Minimax com poda alfa-beta e heurística de avaliação |
| `js/ui.js` | Tabuleiro, arrastar e soltar, animações, HUD, lista de lances, fim de partida |
| `js/fx.js` | Canvas de efeitos: trajetórias de captura, explosões, coroação, fogos |
| `js/audio.js` | Efeitos e trilha sintetizados com Web Audio API |
| `js/app.js` | Inicialização, ajustes, diálogos, atalhos |
| `js/icons.js` | Sprite de ícones gerado |
