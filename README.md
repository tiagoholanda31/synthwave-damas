# 🕹️ DAMAS SYNTHWAVE — Cyber Neon Edition

Um jogo de Damas de última geração com estética **Synthwave / Outrun dos anos 80**, visual premium em **Neon Glow**, perspectiva **3D com profundidade cibernética**, efeitos de áudio sintetizados via **Web Audio API** e inteligência artificial tática avançada com as **Regras Oficiais Brasileiras (Dama Voadora e Lei da Maioria)**.

---

## ✨ Destaques Visuais & Experiência UX/UI

- **Estética Synthwave & Neon Glow**: Paleta autêntica *Outrun* com tons Cyan Elétrico (`#00f0ff`), Magenta Laser (`#ff007f`), Dourado Solar e Roxo Profundo.
- **Ambiente Cyberpunk Animado**: Horizonte retrô com Sol Neon listrado, grade wireframe com perspectiva 3D infinita e filtro CRT scanline suave.
- **Peças Holográficas em 3D**: Discos de energia com anéis concêntricos pulsantes, coroas holográficas animadas para Damas e iluminação dinâmica.
- **Perspectiva Alternável 3D / 2D**: Alterne entre a visão inclinada em 3D futurista e a visão clássica 2D zenital com um único clique.
- **Efeitos de Partículas & Impacto Suave**:
  - Explosões de estilhaços de luz neon ao capturar peças.
  - Ondas de choque circulares e rastro de luz.
  - Tremor de tela (*screen shake*) dinâmico para impactos arcade.
  - Textos flutuantes de combos (`⚡ COMBO DUPLO X2!`, `🔥 ULTRA COMBO X3!`).
  - Efeito estelar ascendente ao coroar uma Dama.
- **Sintetizador de Áudio Procedural 80s (Zero dependências externas)**:
  - Sons analógicos sintetizados em tempo real via Web Audio API (lasers de seleção, sub-graves de movimento, estalo de caixa/snare e fanfarras de vitória).
  - Trilha sonora Synthwave procedural com linha de baixo arpejada, bumbo 4-on-the-floor e leads analógicos.

---

## 🧠 Inteligência Artificial & Regras de Jogo

- **Regras Oficiais Brasileiras (8x8)**:
  - Peças comuns movem-se para frente e **capturam para frente e para trás**.
  - **Dama Voadora**: Move-se por qualquer distância livre nas 4 diagonais e captura a longa distância.
  - **Lei da Maioria**: Obrigatório escolher a jogada que captura o maior número de peças.
  - Suporte opcional a Regras Casuais nas configurações.
- **3 Níveis de IA com Minimax & Alpha-Beta**:
  - 🟢 **Novato**: IA casual para jogadores iniciantes.
  - 🟡 **Tático**: IA equilibrada que calcula 3 lances à frente com heurísticas de controle de centro.
  - 🔴 **Cyber Mestre**: Minimax avançado com poda Alpha-Beta e avaliação tática de damas, colunas vulneráveis e avanço de linhas.
- **3 Modos de Jogo**:
  - **Jogador vs Synth-IA** (PvE)
  - **2 Jogadores Local** (Pass & Play)
  - **IA vs IA** (Modo Espectador Cyber)

---

## 🏆 Sistema de Gamificação & Engajamento

- **Níveis & Ranks Cibernéticos**: Ganhe XP ao jogar, capturar peças, formar damas e vencer partidas. Desbloqueie patentes:
  - *Iniciado Neon* ➔ *Piloto Synth* ➔ *Hacker Retro* ➔ *Cyber Estrategista* ➔ *Comandante Laser* ➔ *Grande Mestre Synthwave*.
  - Progresso persistido localmente via `LocalStorage`.
- **Barra de Domínio de Energia**: Visualização contínua do equilíbrio de forças entre os jogadores.
- **Comandos Rápidos**:
  - ↩️ **Desfazer (Undo)**: Reverta jogadas a qualquer momento.
  - 💡 **Dica Tática**: Solicite a melhor jogada avaliada pelo motor cibernético.
  - 🔄 **Nova Partida**: Reinicie o combate imediatamente.

---

## ⌨️ Atalhos de Teclado (Hotkeys)

| Tecla | Ação |
| :--- | :--- |
| `Z` | Desfazer última jogada (*Undo*) |
| `H` | Exibir Dica Tática (*Hint*) |
| `M` | Ligar / Desligar Trilha Sonora Synthwave |
| `R` | Reiniciar Partida (*Restart*) |

---

## 🚀 Como Jogar

Você pode abrir diretamente o arquivo no seu navegador preferido sem precisar instalar nada!

1. Dê um duplo-clique no arquivo **`index.html`**;
2. Ou execute **`start.bat`** (no Windows) para iniciar instantaneamente no navegador;
3. O jogo funciona 100% offline, sem necessidade de servidores ou pacotes externos.
