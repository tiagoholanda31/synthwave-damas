/**
 * SYNTHWAVE DAMAS - UI & INTERACTION ENGINE v3.0
 * - Arrastar e soltar com "fantasma" fixo na tela: acompanha o cursor mesmo com o tabuleiro inclinado
 * - Animação de lances em coordenadas do tabuleiro (corretas em 3D) e por salto nas capturas múltiplas
 * - Jogo completo pelo teclado (setas + Enter) com rótulos acessíveis em cada casa
 * - Barra de vantagem pela heurística da IA, contagem para empate, lista de lances em pares
 * - Proteção contra corrida: desfazer/reiniciar durante o cálculo da IA descarta o lance antigo
 */

const SynthStore = {
    get(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : value;
        } catch (_) {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch (_) {}
    },
    getJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (_) {
            return fallback;
        }
    }
};
window.SynthStore = SynthStore;

// Nome de cada lado por tema: a cor da peça muda, o nome acompanha
const THEME_SIDE_LABELS = {
    outrun: { cyan: 'Ciano', magenta: 'Magenta' },
    cyberpunk: { cyan: 'Verde', magenta: 'Âmbar' },
    laser: { cyan: 'Azul', magenta: 'Carmim' }
};
const DIFFICULTY_LABEL = { novice: 'Novato', tactical: 'Tático', master: 'Mestre' };
const XP_PER_LEVEL = 150;
const RANKS = [
    'Iniciado Neon', 'Piloto Synth', 'Hacker Retrô', 'Estrategista Cyber',
    'Comandante Laser', 'Arquiteto da Matrix', 'Grão-Mestre Synthwave'
];
const REASON_TEXT = {
    'peças eliminadas': 'todas as peças adversárias foram capturadas',
    'sem movimentos válidos': 'o adversário ficou sem lances',
    '20 lances de damas sem captura': '20 lances de cada lado só com damas, sem captura'
};
// Mesmo motivo, do ponto de vista de quem perdeu
const LOSS_REASON_TEXT = {
    'peças eliminadas': 'todas as suas peças foram capturadas',
    'sem movimentos válidos': 'você ficou sem lances'
};

class SynthwaveUI {
    constructor(engine, ai, fx, audio, options = {}) {
        this.engine = engine;
        this.ai = ai;
        this.fx = fx;
        this.audio = audio;

        this.boardEl = document.getElementById('checkers-board');
        this.boardWrapper = document.getElementById('board-wrapper');
        this.arenaEl = document.querySelector('.arena');
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

        this.gameMode = options.mode || 'pve';
        this.sideLabels = THEME_SIDE_LABELS[options.theme] || THEME_SIDE_LABELS.outrun;
        this.userSide = PLAYER_CYAN;
        this.is3D = options.view3d !== false;

        this.selectedCoord = null;
        this.validMovesForSelected = [];
        this.isAnimating = false;
        this.animationDone = Promise.resolve();
        this.matchToken = 0;
        this.aiThinking = false;
        this.gameOverState = null;
        this.outcome = null;
        this.mustCapture = false;
        this.dragState = null;
        this.suppressClickUntil = 0;
        this.dealUntil = 0;
        this.combatLog = [];
        this.elapsedMs = 0;
        this.timerInterval = null;
        this.timerRunningSince = 0;
        this.toastTimer = null;
        this.xpToastTimer = null;
        this.lastLockedNotice = 0;
        this.pipSignature = {};

        // Substituído pelo gerenciador de diálogos do app.js
        this.dialogs = {
            open: (id) => document.getElementById(id)?.classList.add('open'),
            close: (id) => document.getElementById(id)?.classList.remove('open')
        };

        this.xp = parseInt(SynthStore.get('synth_damas_xp', '0'), 10) || 0;
        this.streak = parseInt(SynthStore.get('synth_damas_streak', '0'), 10) || 0;
        this.totalWins = parseInt(SynthStore.get('synth_damas_wins', '0'), 10) || 0;

        this.boardWrapper.classList.toggle('perspective-3d', this.is3D);
        this.initDOM();
        this.initParallax();
        this.initPointerEvents();
        this.initKeyboard();
        this.fx.refreshPalette();
        this.startMatchTimer();
        this.renderBoard({ deal: true });
        this.renderFeed();
        this.updateHUD();
        this.updateXPDisplay();
    }

    // =========================================================================
    // MONTAGEM
    // =========================================================================

    initDOM() {
        this.boardEl.innerHTML = '';
        this.cells = [];
        for (let r = 0; r < 8; r++) {
            const row = [];
            for (let c = 0; c < 8; c++) {
                const cell = document.createElement('div');
                cell.className = `cell ${(r + c) % 2 === 1 ? 'dark-cell' : 'light-cell'}`;
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.tabIndex = (r === 5 && c === 0) ? 0 : -1;
                this.boardEl.appendChild(cell);
                row.push(cell);
            }
            this.cells.push(row);
        }
    }

    /**
     * Inclinação sutil acompanhando o cursor. O laço só roda enquanto há movimento.
     */
    initParallax() {
        const wrap = this.boardWrapper;
        const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
        let tx = 0, ty = 0, cx = 0, cy = 0, running = false;

        const step = () => {
            cx += (tx - cx) * 0.08;
            cy += (ty - cy) * 0.08;
            wrap.style.setProperty('--tilt-dx', `${cx.toFixed(3)}deg`);
            wrap.style.setProperty('--tilt-dy', `${cy.toFixed(3)}deg`);
            if (Math.abs(tx - cx) > 0.005 || Math.abs(ty - cy) > 0.005) {
                requestAnimationFrame(step);
            } else {
                running = false;
            }
        };
        const kick = () => {
            if (!running) {
                running = true;
                requestAnimationFrame(step);
            }
        };

        this.arenaEl.addEventListener('pointermove', (e) => {
            if (!this.is3D || !finePointer.matches || this.reducedMotion.matches) return;
            if (this.dragState && this.dragState.isDragging) return;
            const rect = wrap.getBoundingClientRect();
            tx = ((e.clientX - (rect.left + rect.width / 2)) / window.innerWidth) * 5;
            ty = ((e.clientY - (rect.top + rect.height / 2)) / window.innerHeight) * -4;
            kick();
        });
        this.arenaEl.addEventListener('pointerleave', () => {
            tx = 0;
            ty = 0;
            kick();
        });
        this.resetTilt = () => {
            tx = 0;
            ty = 0;
            kick();
        };
    }

    initPointerEvents() {
        this.boardEl.addEventListener('pointerdown', (e) => {
            const pieceEl = e.target.closest('.piece');
            if (!pieceEl || e.button !== 0) return;
            this.onPiecePointerDown(e, Number(pieceEl.dataset.row), Number(pieceEl.dataset.col), pieceEl);
        });

        this.boardEl.addEventListener('click', (e) => {
            if (performance.now() < this.suppressClickUntil) return;
            const cell = e.target.closest('.cell');
            if (!cell) return;
            this.activateCell(Number(cell.dataset.row), Number(cell.dataset.col));
        });

        this.boardEl.addEventListener('pointerover', (e) => {
            const piece = e.target.closest('.piece');
            if (!piece || piece.contains(e.relatedTarget) || (this.dragState && this.dragState.isDragging)) return;
            if (piece.classList.contains('is-movable')) {
                this.highlightRails(Number(piece.dataset.row), Number(piece.dataset.col));
                this.audio.playHover();
            }
        });

        this.boardEl.addEventListener('pointerout', (e) => {
            const piece = e.target.closest('.piece');
            if (!piece || piece.contains(e.relatedTarget)) return;
            if (this.selectedCoord) {
                this.highlightRails(this.selectedCoord.r, this.selectedCoord.c);
            } else {
                this.clearRailsHighlight();
            }
        });

        window.addEventListener('pointermove', (e) => this.onPointerMove(e));
        window.addEventListener('pointerup', (e) => this.onPointerUp(e, false));
        window.addEventListener('pointercancel', (e) => this.onPointerUp(e, true));
    }

    initKeyboard() {
        const dirs = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        this.boardEl.addEventListener('keydown', (e) => {
            const cell = e.target.closest('.cell');
            if (!cell) return;
            const r = Number(cell.dataset.row);
            const c = Number(cell.dataset.col);
            if (dirs[e.key]) {
                e.preventDefault();
                const [dr, dc] = dirs[e.key];
                this.focusCell(Math.max(0, Math.min(7, r + dr)), Math.max(0, Math.min(7, c + dc)));
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.activateCell(r, c);
            }
        });
    }

    focusCell(r, c) {
        this.boardEl.querySelectorAll('.cell[tabindex="0"]').forEach(el => { el.tabIndex = -1; });
        const cell = this.getCellElement(r, c);
        if (!cell) return;
        cell.tabIndex = 0;
        cell.focus({ preventScroll: true });
        if (!this.selectedCoord) this.highlightRails(r, c);
    }

    // =========================================================================
    // UTILITÁRIOS
    // =========================================================================

    getCellElement(r, c) {
        return (this.cells[r] && this.cells[r][c]) || null;
    }

    getPieceEl(r, c) {
        const cell = this.getCellElement(r, c);
        return cell ? cell.querySelector('.piece') : null;
    }

    cellCenter(r, c) {
        const rect = this.getCellElement(r, c).getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    toAlgebraic(r, c) {
        return `${String.fromCharCode(97 + c)}${8 - r}`;
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    nextFrame() {
        return new Promise(resolve => requestAnimationFrame(() => resolve()));
    }

    vibrate(pattern) {
        try {
            const toggle = document.getElementById('toggle-haptic');
            if (toggle && !toggle.checked) return;
            if (navigator.vibrate) navigator.vibrate(pattern);
        } catch (_) {}
    }

    isHumanSide(player) {
        if (this.gameMode === 'eve') return false;
        if (this.gameMode === 'pvp') return true;
        return player === this.userSide;
    }

    isAIControlled(player) {
        return !this.isHumanSide(player);
    }

    isTurnLocked() {
        return this.isAIControlled(this.engine.turn);
    }

    isGameInProgress() {
        // Um lance em animação ainda não entrou no motor, mas já conta como partida em andamento
        return (this.engine.moveCount > 0 || this.isAnimating) && !this.gameOverState;
    }

    sideName(side) {
        if (this.gameMode === 'pve') return side === this.userSide ? 'Você' : 'IA';
        return this.sideLabels[side];
    }

    highlightRails(r, c) {
        this.clearRailsHighlight();
        document.querySelectorAll(`#coord-rail-top [data-file="${c}"], #coord-rail-bottom [data-file="${c}"], #coord-rail-left [data-rank="${r}"], #coord-rail-right [data-rank="${r}"]`)
            .forEach(el => el.classList.add('active-coord'));
    }

    clearRailsHighlight() {
        document.querySelectorAll('.coord-rail .active-coord').forEach(el => el.classList.remove('active-coord'));
    }

    // =========================================================================
    // RENDERIZAÇÃO DO TABULEIRO
    // =========================================================================

    renderBoard({ deal = false } = {}) {
        this.boardEl.querySelectorAll('.piece').forEach(el => el.remove());
        const animateDeal = deal && !this.reducedMotion.matches;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const data = this.engine.board[r][c];
                if (!data) continue;
                const pieceEl = this.createPieceElement(data, r, c);
                if (animateDeal) {
                    const order = data.player === PLAYER_MAGENTA ? (r * 8 + c) : ((7 - r) * 8 + (7 - c));
                    pieceEl.classList.add('deal');
                    pieceEl.style.setProperty('--deal-delay', `${Math.floor(order / 2) * 30}ms`);
                }
                this.cells[r][c].appendChild(pieceEl);
            }
        }
        if (animateDeal) this.dealUntil = performance.now() + 900;

        this.boardEl.querySelectorAll('.last-from, .last-to').forEach(el => {
            el.classList.remove('last-from', 'last-to', 'last-by-cyan', 'last-by-magenta');
        });
        const lm = this.engine.lastMove;
        if (lm) {
            const mover = this.engine.board[lm.to.r][lm.to.c];
            const tone = mover ? `last-by-${mover.player}` : 'last-by-cyan';
            this.getCellElement(lm.from.r, lm.from.c).classList.add('last-from', tone);
            this.getCellElement(lm.to.r, lm.to.c).classList.add('last-to', tone);
        }

        this.refreshPieceStates();
        this.updateCellLabels();
    }

    createPieceElement(data, r, c) {
        const piece = document.createElement('div');
        piece.className = `piece ${data.player}-piece${data.isKing ? ' is-king' : ''}`;
        piece.dataset.row = r;
        piece.dataset.col = c;
        piece.innerHTML = data.isKing
            ? '<span class="piece-cap"></span><svg class="piece-crown" aria-hidden="true"><use href="#i-crown-solid"/></svg>'
            : '<span class="piece-cap"></span>';
        return piece;
    }

    /**
     * Marca peças jogáveis, bloqueadas e com captura obrigatória.
     */
    refreshPieceStates() {
        const locked = this.isTurnLocked() || !!this.gameOverState;
        this.boardEl.classList.toggle('locked', locked);
        this.boardEl.dataset.turn = this.engine.turn;

        const legal = this.gameOverState ? [] : this.engine.getAllLegalMoves(this.engine.turn);
        const movable = new Set(legal.map(m => `${m.from.r},${m.from.c}`));
        this.mustCapture = legal.some(m => m.capturedPieces.length > 0);

        this.boardEl.querySelectorAll('.piece').forEach(el => {
            const key = `${el.dataset.row},${el.dataset.col}`;
            const own = el.classList.contains(`${this.engine.turn}-piece`);
            const canMove = movable.has(key);
            el.classList.toggle('is-movable', !locked && canMove);
            el.classList.toggle('is-blocked', !locked && own && !canMove);
            el.classList.toggle('must-capture', !locked && this.mustCapture && canMove);
        });
    }

    updateCellLabels() {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const cell = this.cells[r][c];
                const data = this.engine.board[r][c];
                let label = this.toAlgebraic(r, c);
                if (data) {
                    label += `, ${data.isKing ? 'dama' : 'pedra'} ${this.sideLabels[data.player].toLowerCase()}`;
                } else {
                    label += (r + c) % 2 === 1 ? ', vazia' : ', casa clara';
                }
                if (this.selectedCoord && this.selectedCoord.r === r && this.selectedCoord.c === c) label += ', selecionada';
                if (cell.classList.contains('is-target')) label += ', destino possível';
                cell.setAttribute('aria-label', label);
            }
        }
    }

    // =========================================================================
    // INTERAÇÃO: PONTEIRO
    // =========================================================================

    onPiecePointerDown(e, r, c, pieceEl) {
        if (this.isAnimating || this.gameOverState || this.isTurnLocked()) return;
        const data = this.engine.board[r][c];
        if (!data || data.player !== this.engine.turn) return;

        const moves = this.engine.getLegalMovesForPiece(r, c);
        if (moves.length === 0) {
            this.suppressClickUntil = performance.now() + 400;
            this.rejectPiece(pieceEl);
            return;
        }

        e.preventDefault();
        this.suppressClickUntil = Infinity;
        const wasSelected = !!(this.selectedCoord && this.selectedCoord.r === r && this.selectedCoord.c === c);
        if (!wasSelected) {
            this.selectPiece(r, c, moves);
            this.audio.playSelect();
            this.vibrate([12]);
        }

        this.dragState = {
            pieceEl,
            r,
            c,
            startX: e.clientX,
            startY: e.clientY,
            pointerId: e.pointerId,
            isDragging: false,
            wasSelected,
            ghost: null,
            overCell: null
        };
    }

    onPointerMove(e) {
        const d = this.dragState;
        if (!d || e.pointerId !== d.pointerId) return;

        if (!d.isDragging) {
            if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
            this.beginDrag(d);
        }

        d.ghost.style.transform = `translate3d(${e.clientX - d.size / 2}px, ${e.clientY - d.size / 2}px, 0) scale(1.08)`;

        const cell = this.cellFromPoint(e.clientX, e.clientY);
        const target = cell && this.moveForCell(cell) ? cell : null;
        if (target !== d.overCell) {
            if (d.overCell) d.overCell.classList.remove('drag-over');
            if (target) target.classList.add('drag-over');
            d.overCell = target;
        }
    }

    beginDrag(d) {
        d.isDragging = true;
        const rect = d.pieceEl.getBoundingClientRect();
        d.size = rect.width;
        d.originX = rect.left + rect.width / 2;
        d.originY = rect.top + rect.height / 2;

        const ghost = d.pieceEl.cloneNode(true);
        ghost.classList.remove('selected', 'must-capture', 'is-movable', 'deal');
        ghost.classList.add('drag-ghost');
        ghost.style.width = `${d.size}px`;
        ghost.style.height = `${d.size}px`;
        ghost.setAttribute('aria-hidden', 'true');
        document.body.appendChild(ghost);
        d.ghost = ghost;

        d.pieceEl.classList.add('drag-source');
        document.body.style.cursor = 'grabbing';
        this.vibrate([8]);
    }

    onPointerUp(e, cancelled) {
        const d = this.dragState;
        if (!d || e.pointerId !== d.pointerId) return;
        this.dragState = null;
        this.suppressClickUntil = performance.now() + 80;
        document.body.style.cursor = '';

        if (!d.isDragging) {
            if (d.wasSelected) this.clearSelection();
            return;
        }

        if (d.overCell) d.overCell.classList.remove('drag-over');
        const cell = cancelled ? null : this.cellFromPoint(e.clientX, e.clientY);
        const move = cell ? this.moveForCell(cell) : null;

        if (move) {
            d.ghost.remove();
            d.pieceEl.classList.remove('drag-source');
            this.audio.playDrop();
            this.vibrate([18]);
            this.playMove(move, { dropped: true });
            return;
        }

        const ghost = d.ghost;
        ghost.classList.add('snap-back');
        ghost.style.transform = `translate3d(${d.originX - d.size / 2}px, ${d.originY - d.size / 2}px, 0) scale(1)`;
        setTimeout(() => {
            ghost.remove();
            d.pieceEl.classList.remove('drag-source');
        }, 230);
    }

    cellFromPoint(x, y) {
        const el = document.elementFromPoint(x, y);
        const cell = el && el.closest ? el.closest('.cell') : null;
        return cell && this.boardEl.contains(cell) ? cell : null;
    }

    moveForCell(cell) {
        const r = Number(cell.dataset.row);
        const c = Number(cell.dataset.col);
        return this.validMovesForSelected.find(m => m.to.r === r && m.to.c === c) || null;
    }

    /**
     * Clique ou Enter numa casa.
     */
    activateCell(r, c) {
        if (this.isAnimating || this.gameOverState) return;
        if (this.isTurnLocked()) {
            if (this.gameMode === 'pve' && performance.now() - this.lastLockedNotice > 2500) {
                this.lastLockedNotice = performance.now();
                this.showToast('A Synth-IA está jogando. Aguarde a sua vez.', 'info', 'cpu');
            }
            return;
        }

        if (this.selectedCoord) {
            const move = this.validMovesForSelected.find(m => m.to.r === r && m.to.c === c);
            if (move) {
                this.audio.playDrop();
                this.playMove(move);
                return;
            }
        }

        const data = this.engine.board[r][c];
        if (data && data.player === this.engine.turn) {
            if (this.selectedCoord && this.selectedCoord.r === r && this.selectedCoord.c === c) {
                this.clearSelection();
                return;
            }
            const moves = this.engine.getLegalMovesForPiece(r, c);
            if (moves.length === 0) {
                this.rejectPiece(this.getPieceEl(r, c));
                return;
            }
            this.selectPiece(r, c, moves);
            this.audio.playSelect();
            return;
        }

        this.clearSelection();
    }

    rejectPiece(pieceEl) {
        this.audio.playInvalid();
        this.vibrate([30, 40, 30]);
        if (pieceEl && !this.reducedMotion.matches) {
            pieceEl.animate(
                [{ rotate: '0deg' }, { rotate: '-9deg' }, { rotate: '7deg' }, { rotate: '-4deg' }, { rotate: '0deg' }],
                { duration: 320, easing: 'ease-out' }
            );
        }
        if (this.mustCapture) {
            this.showToast('Captura obrigatória: jogue com uma peça destacada em dourado.', 'warn', 'warning');
        } else {
            this.showToast('Esta peça não tem lances livres agora.', 'warn', 'warning');
        }
    }

    /**
     * Seleciona uma peça e mostra destinos, vítimas e o caminho das capturas.
     */
    selectPiece(r, c, moves, { hint = false } = {}) {
        this.clearSelection();
        this.selectedCoord = { r, c };
        this.validMovesForSelected = moves;
        this.highlightRails(r, c);

        const pieceEl = this.getPieceEl(r, c);
        if (pieceEl) pieceEl.classList.add('selected');

        const victims = new Set();
        for (const m of moves) {
            const cell = this.getCellElement(m.to.r, m.to.c);
            if (cell && !cell.querySelector('.move-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = 'move-indicator'
                    + (m.capturedPieces.length ? ' capture-indicator' : '')
                    + (hint ? ' hint-indicator' : '');
                cell.appendChild(indicator);
                cell.classList.add('is-target');
            }
            m.capturedPieces.forEach(p => victims.add(`${p.r},${p.c}`));
        }
        victims.forEach(key => {
            const [vr, vc] = key.split(',').map(Number);
            const victim = this.getPieceEl(vr, vc);
            if (victim) victim.classList.add('target-victim');
        });

        // Linhas só onde o caminho importa: capturas e dicas
        const routed = moves.filter(m => hint || m.capturedPieces.length > 0);
        if (routed.length) {
            const tone = this.engine.board[r][c].player === PLAYER_CYAN ? 'p1' : 'p2';
            this.fx.setTrajectoryProvider(() => {
                const cache = new Map();
                const center = (p) => {
                    const key = p.r * 8 + p.c;
                    if (!cache.has(key)) cache.set(key, this.cellCenter(p.r, p.c));
                    return cache.get(key);
                };
                return routed.map(m => ({
                    points: m.path.map(center),
                    isCapture: m.capturedPieces.length > 0,
                    isHint: hint,
                    color: this.fx.color(tone)
                }));
            });
        }

        this.updateCellLabels();
    }

    clearSelection() {
        this.selectedCoord = null;
        this.validMovesForSelected = [];
        this.clearRailsHighlight();
        this.fx.clearTrajectories();
        this.boardEl.querySelectorAll('.piece.selected, .piece.target-victim').forEach(el => {
            el.classList.remove('selected', 'target-victim');
        });
        this.boardEl.querySelectorAll('.move-indicator').forEach(el => el.remove());
        this.boardEl.querySelectorAll('.cell.is-target').forEach(el => el.classList.remove('is-target'));
        this.updateCellLabels();
    }

    // =========================================================================
    // EXECUÇÃO DE LANCES
    // =========================================================================

    async playMove(move, { dropped = false } = {}) {
        const token = this.matchToken;
        let release;
        this.isAnimating = true;
        this.animationDone = new Promise(resolve => { release = resolve; });

        try {
            this.clearSelection();
            const movingPlayer = this.engine.turn;
            const pieceEl = this.getPieceEl(move.from.r, move.from.c);

            if (dropped) {
                await this.animateDrop(pieceEl, move, token);
            } else {
                await this.animateTrajectory(pieceEl, move, token);
            }
            if (token !== this.matchToken) return;

            const toCenter = this.cellCenter(move.to.r, move.to.c);
            const result = this.engine.executeMove(move);
            this.afterMoveFeedback(movingPlayer, result, toCenter);
            this.recordMove(movingPlayer, move, result);
            this.renderBoard();
            this.updateHUD();

            if (result.gameOver.over) {
                this.handleGameOver(result.gameOver);
                return;
            }
        } finally {
            this.isAnimating = false;
            release();
        }

        if (token === this.matchToken) this.checkAITurn();
    }

    /**
     * Desliza a peça casa a casa usando offsets do tabuleiro (espaço local),
     * o que mantém a animação correta com o tabuleiro inclinado em 3D.
     */
    async animateTrajectory(pieceEl, move, token) {
        if (!pieceEl) return;
        const path = move.path;
        const tone = pieceEl.classList.contains('cyan-piece') ? 'p1' : 'p2';
        const isCapture = move.capturedPieces.length > 0;
        pieceEl.style.zIndex = '8';

        for (let i = 1; i < path.length; i++) {
            const a = path[i - 1];
            const b = path[i];
            const fromCell = this.getCellElement(a.r, a.c);
            const toCell = this.getCellElement(b.r, b.c);
            const dx = toCell.offsetLeft - fromCell.offsetLeft;
            const dy = toCell.offsetTop - fromCell.offsetTop;
            const dist = Math.abs(b.r - a.r);
            const duration = this.reducedMotion.matches ? 0 : Math.min(190 + dist * 45, 460);

            const fromCenter = this.cellCenter(a.r, a.c);
            this.fx.addMotionTrail(fromCenter.x, fromCenter.y, tone);

            if (duration > 0) {
                const peak = isCapture ? 1.2 : 1.1;
                const anim = pieceEl.animate([
                    { transform: 'translate(0, 0) scale(1)' },
                    { transform: `translate(${dx / 2}px, ${dy / 2}px) scale(${peak})`, offset: 0.5 },
                    { transform: `translate(${dx}px, ${dy}px) scale(1)` }
                ], { duration, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' });
                try {
                    await anim.finished;
                } catch (_) {}
                if (token !== this.matchToken) {
                    pieceEl.remove();
                    return;
                }
                toCell.appendChild(pieceEl);
                anim.cancel();
            } else {
                toCell.appendChild(pieceEl);
            }
            pieceEl.dataset.row = b.r;
            pieceEl.dataset.col = b.c;

            const victim = this.findVictimOnSegment(a, b, move.capturedPieces);
            if (victim) this.explodeVictim(victim);
        }
        pieceEl.style.zIndex = '';
    }

    /**
     * Peça solta pelo arrastar: já está no destino, só detonamos as vítimas em sequência.
     */
    async animateDrop(pieceEl, move, token) {
        if (!pieceEl) return;
        const dest = this.getCellElement(move.to.r, move.to.c);
        dest.appendChild(pieceEl);
        pieceEl.dataset.row = move.to.r;
        pieceEl.dataset.col = move.to.c;
        if (!this.reducedMotion.matches) {
            pieceEl.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
        }
        for (const victim of move.capturedPieces) {
            await this.wait(this.reducedMotion.matches ? 0 : 95);
            if (token !== this.matchToken) return;
            this.explodeVictim(victim);
        }
        if (move.capturedPieces.length) await this.wait(120);
    }

    findVictimOnSegment(a, b, captured) {
        const dr = Math.sign(b.r - a.r);
        const dc = Math.sign(b.c - a.c);
        let r = a.r + dr;
        let c = a.c + dc;
        while (r !== b.r && c !== b.c) {
            const hit = captured.find(p => p.r === r && p.c === c);
            if (hit) return hit;
            r += dr;
            c += dc;
        }
        return null;
    }

    explodeVictim(victim) {
        const data = this.engine.board[victim.r][victim.c];
        const tone = data && data.player === PLAYER_CYAN ? 'p1' : 'p2';
        const center = this.cellCenter(victim.r, victim.c);
        this.fx.triggerCaptureExplosion(center.x, center.y, tone);
        const el = this.getPieceEl(victim.r, victim.c);
        if (el) el.classList.add('captured-out');
    }

    afterMoveFeedback(movingPlayer, result, toCenter) {
        const earnsXP = this.gameMode === 'pve' && movingPlayer === this.userSide;
        const tone = movingPlayer === PLAYER_CYAN ? 'p1' : 'p2';

        if (result.wasCapture) {
            const n = result.comboCount;
            this.audio.playCapture(n);
            this.fx.screenShake(2 + n * 1.5, 160 + n * 40);
            this.vibrate(n > 1 ? [40, 30, 70] : [35]);
            const label = n > 1 ? `Combo ×${n}` : 'Captura';
            this.fx.showFloatingText(label, toCenter.x, toCenter.y - 30, n > 1 ? 'gold' : tone, n > 1 ? 22 : 18);
            if (earnsXP) this.addXP(20 * n, n > 1 ? `Combo ×${n}` : 'Captura');
        } else {
            this.audio.playMove();
            if (earnsXP) this.addXP(5);
        }

        if (result.isKingPromotion) {
            this.audio.playCrown();
            this.fx.triggerCrownBurst(toCenter.x, toCenter.y);
            this.vibrate([30, 30, 60]);
            if (earnsXP) this.addXP(50, 'Dama coroada');
        }
    }

    async checkAITurn() {
        if (this.gameOverState || this.aiThinking) return;
        if (!this.isAIControlled(this.engine.turn)) return;
        if (this.engine.isGameOver().over) return;

        const token = this.matchToken;
        this.aiThinking = true;
        this.updateHUD();

        let move = null;
        try {
            const settle = this.dealUntil - performance.now();
            if (settle > 0) await this.wait(settle);
            await this.nextFrame();
            if (token === this.matchToken) {
                move = await this.ai.getBestMove(this.engine, this.engine.turn);
            }
        } finally {
            if (token === this.matchToken) this.aiThinking = false;
        }

        if (token !== this.matchToken || !move) {
            this.updateHUD();
            return;
        }
        this.updateHUD();
        await this.playMove(move);
    }

    // =========================================================================
    // LISTA DE LANCES
    // =========================================================================

    recordMove(player, move, result) {
        this.combatLog.push({
            player,
            from: this.toAlgebraic(move.from.r, move.from.c),
            to: this.toAlgebraic(move.to.r, move.to.c),
            capture: result.wasCapture,
            combo: result.comboCount,
            crowned: result.isKingPromotion
        });
        this.renderFeed();
    }

    maxComboFor(side) {
        return this.combatLog.reduce((best, p) => (p.player === side && p.capture ? Math.max(best, p.combo) : best), 0);
    }

    renderFeed() {
        const list = document.getElementById('history-moves-list');
        const empty = document.getElementById('history-empty');
        const log = this.combatLog;
        const lastIndex = log.length - 1;

        const ply = (p, i) => {
            if (!p) return '<span></span>';
            const sep = p.capture ? '×' : '–';
            const badge = p.combo > 1 ? `<span class="ply-badge">×${p.combo}</span>` : '';
            const crown = p.crowned ? '<svg class="icon" aria-label="coroou"><use href="#i-crown-solid"/></svg>' : '';
            return `<span class="ply side-${p.player}${i === lastIndex ? ' is-last' : ''}">${p.from}${sep}${p.to}${badge}${crown}</span>`;
        };

        const rows = [];
        for (let i = 0; i < log.length; i += 2) {
            rows.push(`<li class="feed-row"><span class="feed-no">${i / 2 + 1}.</span>${ply(log[i], i)}${ply(log[i + 1], i + 1)}</li>`);
        }
        list.innerHTML = rows.join('');
        empty.hidden = log.length > 0;
        list.scrollTop = list.scrollHeight;

        document.getElementById('history-total-moves').textContent = log.length;
        document.getElementById('history-captures').innerHTML =
            `<span class="tone-cyan">${this.engine.capturedStats.cyan}</span><span class="feed-sep">·</span><span class="tone-magenta">${this.engine.capturedStats.magenta}</span>`;
        const best = Math.max(this.maxComboFor(PLAYER_CYAN), this.maxComboFor(PLAYER_MAGENTA));
        document.getElementById('history-max-combo').textContent = best > 0 ? `×${best}` : '—';
    }

    // =========================================================================
    // HUD
    // =========================================================================

    updateHUD() {
        const over = !!this.gameOverState;
        const isCyan = this.engine.turn === PLAYER_CYAN;
        document.getElementById('panel-cyan').classList.toggle('active-turn', !over && isCyan);
        document.getElementById('panel-magenta').classList.toggle('active-turn', !over && !isCyan);

        for (const side of [PLAYER_CYAN, PLAYER_MAGENTA]) {
            const count = this.engine.countPieces(side);
            document.getElementById(`${side}-pieces-count`).textContent = count.total;
            document.getElementById(`${side}-kings-count`).textContent = count.kings;
            this.renderPips(side, count);
        }

        this.updateTurnStatus();
        this.updateEval();
        this.updateIdentities();

        document.getElementById('move-counter').textContent = this.engine.moveCount;
        document.getElementById('current-mode-tag').textContent =
            { pve: 'Contra IA', pvp: '2 jogadores', eve: 'IA vs IA' }[this.gameMode];

        const drawWatch = document.getElementById('draw-watch');
        const quiet = this.engine.quietKingPlies || 0;
        if (!over && quiet >= 6) {
            const left = Math.ceil((DRAW_QUIET_KING_PLIES - quiet) / 2);
            document.getElementById('draw-watch-text').textContent = `Empate em ${left} ${left === 1 ? 'lance' : 'lances'} sem captura`;
            drawWatch.hidden = false;
        } else {
            drawWatch.hidden = true;
        }

        document.getElementById('btn-undo').disabled = this.engine.history.length === 0 || this.gameMode === 'eve';
        document.getElementById('btn-hint').disabled = over || this.isTurnLocked();
    }

    renderPips(side, count) {
        const kings = count.kings;
        const men = count.total - kings;
        const lost = Math.max(0, 12 - count.total);
        const signature = `${kings}/${men}/${lost}`;
        if (this.pipSignature[side] === signature) return;
        this.pipSignature[side] = signature;
        document.getElementById(`pips-${side}`).innerHTML =
            '<span class="pip king"></span>'.repeat(kings)
            + '<span class="pip"></span>'.repeat(men)
            + '<span class="pip lost"></span>'.repeat(lost);
    }

    updateTurnStatus() {
        const el = document.getElementById('turn-status');
        const label = document.getElementById('turn-label');
        const sub = document.getElementById('turn-sub');
        const turn = this.engine.turn;
        el.classList.remove('side-cyan', 'side-magenta', 'is-thinking', 'is-alert', 'is-over');

        if (this.gameOverState) {
            el.classList.add('is-over');
            label.textContent = 'Partida encerrada';
            sub.textContent = this.outcome ? this.outcome.short : '';
            return;
        }

        el.classList.add(turn === PLAYER_CYAN ? 'side-cyan' : 'side-magenta');
        if (this.isAIControlled(turn)) {
            el.classList.add('is-thinking');
            label.textContent = this.gameMode === 'eve' ? `IA ${this.sideLabels[turn]}` : 'Synth-IA';
            sub.textContent = this.mustCapture ? 'Captura obrigatória' : `Pensando · ${DIFFICULTY_LABEL[this.ai.difficulty]}`;
        } else {
            label.textContent = this.gameMode === 'pve' ? 'Sua vez' : `Vez do ${this.sideLabels[turn]}`;
            if (this.mustCapture) {
                el.classList.add('is-alert');
                sub.textContent = 'Captura obrigatória';
            } else {
                sub.textContent = this.gameMode === 'pve'
                    ? `Peças ${this.sideLabels[turn].toLowerCase()}`
                    : (turn === PLAYER_CYAN ? 'Jogador 1' : 'Jogador 2');
            }
        }
    }

    /**
     * Vantagem pela mesma heurística da IA: material (dama = 3,2 pedras) e posição.
     */
    updateEval() {
        const fill = document.getElementById('dominance-bar-fill');
        const meter = document.getElementById('eval-meter');
        const value = document.getElementById('eval-value');
        let pct = 50;
        let text = 'Equilíbrio';
        let lead = null;

        if (this.gameOverState) {
            const w = this.gameOverState.winner;
            pct = w === PLAYER_CYAN ? 100 : (w === PLAYER_MAGENTA ? 0 : 50);
            lead = w;
            text = w ? `${this.sideName(w)} venceu` : 'Empate';
        } else {
            const score = this.ai.evaluateBoard(this.engine.board, PLAYER_CYAN);
            pct = 50 + 50 * Math.tanh(score / 450);
            const pawns = score / 100;
            if (Math.abs(pawns) >= 0.25) {
                lead = pawns > 0 ? PLAYER_CYAN : PLAYER_MAGENTA;
                text = `${this.sideName(lead)} +${Math.abs(pawns).toFixed(1)}`;
            }
        }

        fill.style.width = `${pct.toFixed(1)}%`;
        meter.setAttribute('aria-label', `Vantagem das peças ${this.sideLabels.cyan.toLowerCase()}`);
        meter.setAttribute('aria-valuenow', Math.round(pct));
        meter.setAttribute('aria-valuetext', text);
        value.textContent = text;
        value.className = `eval-value${lead ? ` lead-${lead}` : ''}`;
    }

    updateIdentities() {
        const diff = DIFFICULTY_LABEL[this.ai.difficulty];
        const ids = {
            pve: { cyan: ['Você', this.sideLabels.cyan, 'user'], magenta: ['Synth-IA', diff, 'cpu'] },
            pvp: { cyan: ['Jogador 1', this.sideLabels.cyan, 'user'], magenta: ['Jogador 2', this.sideLabels.magenta, 'user'] },
            eve: { cyan: ['IA Ciano', diff, 'robot'], magenta: ['IA Magenta', diff, 'cpu'] }
        }[this.gameMode];

        for (const side of [PLAYER_CYAN, PLAYER_MAGENTA]) {
            const [name, role, icon] = ids[side];
            document.getElementById(`${side}-player-title`).textContent = name;
            document.getElementById(`${side}-player-role`).textContent = role;
            document.getElementById(`avatar-${side}`).setAttribute('href', `#i-${icon}`);
            document.getElementById(`panel-${side}`).setAttribute('aria-label', `${name}, peças ${this.sideLabels[side].toLowerCase()}`);
        }
    }

    // =========================================================================
    // RELÓGIO
    // =========================================================================

    startMatchTimer() {
        this.pauseTimer();
        this.elapsedMs = 0;
        this.resumeTimer();
    }

    resumeTimer() {
        if (this.timerInterval) return;
        this.timerRunningSince = Date.now();
        this.timerInterval = setInterval(() => this.renderTimer(), 1000);
        this.renderTimer();
    }

    pauseTimer() {
        if (!this.timerInterval) return;
        this.elapsedMs += Date.now() - this.timerRunningSince;
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.renderTimer();
    }

    getElapsedMs() {
        return this.elapsedMs + (this.timerInterval ? Date.now() - this.timerRunningSince : 0);
    }

    formatTime(ms) {
        const total = Math.floor(ms / 1000);
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }

    renderTimer() {
        document.getElementById('match-timer-display').textContent = this.formatTime(this.getElapsedMs());
    }

    // =========================================================================
    // PROGRESSÃO
    // =========================================================================

    addXP(amount, reason = '') {
        this.xp += amount;
        SynthStore.set('synth_damas_xp', this.xp);
        this.updateXPDisplay();
        if (!reason) return;
        const toast = document.getElementById('xp-toast');
        document.getElementById('xp-toast-text').textContent = `+${amount} XP · ${reason}`;
        toast.classList.add('show');
        clearTimeout(this.xpToastTimer);
        this.xpToastTimer = setTimeout(() => toast.classList.remove('show'), 1700);
    }

    updateXPDisplay() {
        const level = Math.floor(this.xp / XP_PER_LEVEL) + 1;
        const inLevel = this.xp % XP_PER_LEVEL;
        document.getElementById('player-xp-val').textContent = `Nível ${level} · ${inLevel}/${XP_PER_LEVEL} XP`;
        document.getElementById('player-rank-title').textContent = RANKS[Math.min(level - 1, RANKS.length - 1)];
        document.getElementById('player-xp-bar').style.width = `${(inLevel / XP_PER_LEVEL) * 100}%`;
        document.getElementById('stat-total-wins').textContent = this.totalWins;
        document.getElementById('stat-streak').textContent = this.streak;
        document.getElementById('stat-level').textContent = level;
    }

    // =========================================================================
    // FIM DE PARTIDA
    // =========================================================================

    describeOutcome(result) {
        const winner = result.winner;
        const reason = REASON_TEXT[result.reason] || result.reason;
        if (!winner) {
            return { kind: 'draw', tag: 'Empate', title: 'Empate', desc: `A partida terminou empatada: ${reason}.`, emblem: 'handshake', short: 'Empate' };
        }
        if (this.gameMode === 'pve') {
            const diff = DIFFICULTY_LABEL[this.ai.difficulty];
            return winner === this.userSide
                ? { kind: 'win', tag: 'Vitória', title: 'Você venceu', desc: `Você superou a Synth-IA no nível ${diff}: ${reason}.`, emblem: 'trophy', short: 'Você venceu' }
                : { kind: 'loss', tag: 'Derrota', title: 'A Synth-IA venceu', desc: `A IA no nível ${diff} levou a melhor: ${LOSS_REASON_TEXT[result.reason] || reason}. Desfazer (Z) volta o último lance.`, emblem: 'skull', short: 'A IA venceu' };
        }
        if (this.gameMode === 'pvp') {
            const name = winner === PLAYER_CYAN ? 'Jogador 1' : 'Jogador 2';
            return { kind: 'win', tag: 'Fim de partida', title: `${name} venceu`, desc: `As peças ${this.sideLabels[winner].toLowerCase()} venceram: ${reason}.`, emblem: 'trophy', short: `${name} venceu` };
        }
        return { kind: 'win', tag: 'IA vs IA', title: `IA ${this.sideLabels[winner]} venceu`, desc: `As peças ${this.sideLabels[winner].toLowerCase()} venceram: ${reason}.`, emblem: 'robot', short: `IA ${this.sideLabels[winner]} venceu` };
    }

    handleGameOver(result) {
        const token = this.matchToken;
        this.gameOverState = result;
        this.outcome = this.describeOutcome(result);
        this.pauseTimer();
        this.clearSelection();

        let xpGain = null;
        if (this.gameMode === 'pve') {
            if (this.outcome.kind === 'win') {
                xpGain = 250;
                this.totalWins++;
                this.streak++;
            } else {
                xpGain = this.outcome.kind === 'draw' ? 100 : 50;
                if (this.outcome.kind === 'loss') this.streak = 0;
            }
            SynthStore.set('synth_damas_wins', this.totalWins);
            SynthStore.set('synth_damas_streak', this.streak);
            this.addXP(xpGain);
        }

        if (this.outcome.kind === 'loss') {
            this.audio.playDefeat();
            this.vibrate([150, 80, 250]);
        } else if (this.outcome.kind === 'draw') {
            this.audio.playCrown();
        } else {
            this.audio.playVictory();
            this.fx.triggerVictoryFireworks();
            this.vibrate([100, 50, 100, 50, 200]);
        }

        // Estatísticas do ponto de vista de quem joga (ou do vencedor, sem humano)
        const side = this.gameMode === 'pve' ? this.userSide : (result.winner || PLAYER_CYAN);
        const combo = this.maxComboFor(side);
        document.getElementById('stat-match-time').textContent = this.formatTime(this.getElapsedMs());
        document.getElementById('stat-match-moves').textContent = this.engine.moveCount;
        document.getElementById('stat-match-captures').textContent = this.engine.capturedStats[side];
        document.getElementById('stat-match-combo').textContent = combo > 0 ? `×${combo}` : '—';
        document.getElementById('stat-match-kings').textContent = this.engine.kingsCreated[side];
        document.getElementById('stat-match-xp').textContent = xpGain === null ? '—' : `+${xpGain}`;

        document.getElementById('game-over-card').dataset.outcome = this.outcome.kind;
        document.getElementById('game-over-emblem').setAttribute('href', `#i-${this.outcome.emblem}`);
        document.getElementById('game-over-tag').textContent = this.outcome.tag;
        document.getElementById('game-over-title').textContent = this.outcome.title;
        document.getElementById('game-over-desc').textContent = this.outcome.desc;

        this.renderBoard();
        this.updateHUD();

        // Pausa curta para a última captura ser vista antes do resultado
        setTimeout(() => {
            if (token === this.matchToken && this.gameOverState) this.openResults();
        }, this.reducedMotion.matches ? 0 : 750);
    }

    openResults() {
        this.hideReviewBanner();
        this.dialogs.open('game-over-modal', {
            onClose: () => {
                if (this.gameOverState) this.showReviewBanner();
            }
        });
    }

    showReviewBanner() {
        document.getElementById('btn-review-results').hidden = false;
    }

    hideReviewBanner() {
        document.getElementById('btn-review-results').hidden = true;
    }

    // =========================================================================
    // COMANDOS
    // =========================================================================

    set3D(on) {
        this.is3D = on;
        this.boardWrapper.classList.add('view-switching');
        this.boardWrapper.classList.toggle('perspective-3d', on);
        if (!on && this.resetTilt) this.resetTilt();
        clearTimeout(this.viewSwitchTimer);
        this.viewSwitchTimer = setTimeout(() => this.boardWrapper.classList.remove('view-switching'), 650);
        return on;
    }

    toggle3D() {
        return this.set3D(!this.is3D);
    }

    onThemeChange(theme) {
        this.sideLabels = THEME_SIDE_LABELS[theme] || THEME_SIDE_LABELS.outrun;
        this.fx.refreshPalette();
        this.updateHUD();
        this.updateCellLabels();
    }

    showHint() {
        if (this.isAnimating || this.gameOverState || this.isTurnLocked()) return;
        const best = this.ai.getMinimaxMove(this.engine, this.engine.turn, 3);
        if (!best) return;
        this.selectPiece(best.from.r, best.from.c, [best], { hint: true });
        const sep = best.capturedPieces.length ? '×' : '–';
        this.showToast(`Dica: ${this.toAlgebraic(best.from.r, best.from.c)}${sep}${this.toAlgebraic(best.to.r, best.to.c)}`, 'warn', 'hint');
        this.audio.playSelect();
    }

    undoMove() {
        if (this.isAnimating || this.gameMode === 'eve' || this.engine.history.length === 0) return false;
        this.matchToken++;
        this.aiThinking = false;

        if (this.gameOverState) {
            this.gameOverState = null;
            this.outcome = null;
            this.dialogs.close('game-over-modal');
            this.hideReviewBanner();
            this.resumeTimer();
        }

        this.engine.undoMove();
        // Contra a IA, volta até ser a sua vez de novo
        if (this.gameMode === 'pve') {
            while (this.engine.turn !== this.userSide && this.engine.history.length > 0) {
                this.engine.undoMove();
            }
        }
        this.combatLog.length = this.engine.moveCount;

        this.clearSelection();
        this.renderFeed();
        this.renderBoard();
        this.updateHUD();
        this.audio.playMove();
        this.showToast('Lance desfeito', 'info', 'undo');
        this.checkAITurn();
        return true;
    }

    async restartGame() {
        this.matchToken++;
        this.aiThinking = false;
        if (this.dragState && this.dragState.ghost) this.dragState.ghost.remove();
        this.dragState = null;
        await this.animationDone;

        this.gameOverState = null;
        this.outcome = null;
        this.hideReviewBanner();
        this.dialogs.close('game-over-modal');
        this.clearSelection();
        this.engine.initBoard();
        this.combatLog = [];
        this.startMatchTimer();
        this.renderBoard({ deal: true });
        this.renderFeed();
        this.updateHUD();
        this.audio.playMove();
        this.checkAITurn();
    }

    showToast(message, tone = 'info', icon = 'info') {
        const toast = document.getElementById('game-toast');
        toast.dataset.tone = tone;
        document.getElementById('game-toast-icon').setAttribute('href', `#i-${icon}`);
        document.getElementById('game-toast-text').textContent = message;
        toast.classList.add('show');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
    }
}

window.SynthwaveUI = SynthwaveUI;
