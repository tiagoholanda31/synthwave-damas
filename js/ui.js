/**
 * SYNTHWAVE DAMAS - UI & RENDER ENGINE
 * Manages 3D/2D board rendering, smooth piece animations, selection,
 * gestures/clicks, HUD gauges, XP progression, and gamification feedback.
 */

class SynthwaveUI {
    constructor(engine, ai, fx, audio) {
        this.engine = engine;
        this.ai = ai;
        this.fx = fx;
        this.audio = audio;

        this.boardEl = document.getElementById('checkers-board');
        this.boardWrapper = document.getElementById('board-wrapper');

        this.selectedCoord = null;
        this.validMovesForSelected = [];
        this.isAnimating = false;
        this.is3D = true;
        this.gameMode = 'pve'; // 'pve', 'pvp', 'eve'
        this.userSide = PLAYER_CYAN;

        // Player XP & Gamification State (persisted in LocalStorage)
        this.xp = parseInt(localStorage.getItem('synth_damas_xp') || '0', 10);
        this.streak = parseInt(localStorage.getItem('synth_damas_streak') || '0', 10);
        this.totalWins = parseInt(localStorage.getItem('synth_damas_wins') || '0', 10);

        this.initDOM();
        this.renderBoard();
        this.updateHUD();
        this.updateXPDisplay();
    }

    initDOM() {
        // Build 8x8 grid cells
        this.boardEl.innerHTML = '';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const cell = document.createElement('div');
                cell.className = `cell ${(r + c) % 2 === 1 ? 'dark-cell' : 'light-cell'}`;
                cell.dataset.row = r;
                cell.dataset.col = c;

                // Subtle coordinate labels on borders
                if (c === 0) {
                    const rankLabel = document.createElement('span');
                    rankLabel.className = 'coord-label rank-label';
                    rankLabel.textContent = 8 - r;
                    cell.appendChild(rankLabel);
                }
                if (r === 7) {
                    const fileLabel = document.createElement('span');
                    fileLabel.className = 'coord-label file-label';
                    fileLabel.textContent = String.fromCharCode(65 + c);
                    cell.appendChild(fileLabel);
                }

                cell.addEventListener('click', (e) => this.onCellClick(r, c, e));
                this.boardEl.appendChild(cell);
            }
        }
    }

    /**
     * Re-renders pieces and clears temporary highlights.
     */
    renderBoard() {
        // Clear old pieces and indicators
        document.querySelectorAll('.piece, .move-indicator, .capture-target').forEach(el => el.remove());

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const pieceData = this.engine.board[r][c];
                if (pieceData) {
                    const pieceEl = this.createPieceElement(pieceData, r, c);
                    const cell = this.getCellElement(r, c);
                    if (cell) cell.appendChild(pieceEl);
                }
            }
        }

        // Highlight last move if present
        document.querySelectorAll('.last-move-cell').forEach(el => el.classList.remove('last-move-cell'));
        if (this.engine.lastMove) {
            const fromCell = this.getCellElement(this.engine.lastMove.from.r, this.engine.lastMove.from.c);
            const toCell = this.getCellElement(this.engine.lastMove.to.r, this.engine.lastMove.to.c);
            if (fromCell) fromCell.classList.add('last-move-cell');
            if (toCell) toCell.classList.add('last-move-cell');
        }

        this.highlightMandatoryPieces();
    }

    createPieceElement(data, r, c) {
        const piece = document.createElement('div');
        piece.className = `piece ${data.player}-piece ${data.isKing ? 'is-king' : ''}`;
        piece.dataset.row = r;
        piece.dataset.col = c;

        // Inner glowing cyber ring and core
        const core = document.createElement('div');
        core.className = 'piece-core';

        const ring = document.createElement('div');
        ring.className = 'piece-ring';

        piece.appendChild(core);
        piece.appendChild(ring);

        // Crown icon if King
        if (data.isKing) {
            const crown = document.createElement('div');
            crown.className = 'piece-crown';
            crown.innerHTML = `
                <svg viewBox="0 0 24 24" class="crown-svg">
                    <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V17H19V19Z" fill="currentColor"/>
                </svg>
            `;
            piece.appendChild(crown);
        }

        return piece;
    }

    getCellElement(r, c) {
        return this.boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    }

    /**
     * Highlights pieces that MUST capture this turn (Mandatory capture / Law of Majority)
     */
    highlightMandatoryPieces() {
        document.querySelectorAll('.must-capture-glow').forEach(el => el.classList.remove('must-capture-glow'));
        const legalMoves = this.engine.getAllLegalMoves(this.engine.turn);
        const captureMoves = legalMoves.filter(m => m.capturedPieces.length > 0);

        if (captureMoves.length > 0) {
            const pieceCoords = new Set(captureMoves.map(m => `${m.from.r},${m.from.c}`));
            pieceCoords.forEach(coord => {
                const [r, c] = coord.split(',').map(Number);
                const cell = this.getCellElement(r, c);
                const piece = cell ? cell.querySelector('.piece') : null;
                if (piece) piece.classList.add('must-capture-glow');
            });
        }
    }

    /**
     * Cell click handler
     */
    async onCellClick(r, c, event) {
        if (this.isAnimating) return;

        // Disallow human clicks during AI turn in PvE or during EvE
        if (this.gameMode === 'eve') return;
        if (this.gameMode === 'pve' && this.engine.turn !== this.userSide) return;

        const cell = this.getCellElement(r, c);
        const clickedPiece = this.engine.board[r][c];

        // Case 1: Clicked on a destination of a valid move
        if (this.selectedCoord) {
            const matchedMove = this.validMovesForSelected.find(m => m.to.r === r && m.to.c === c);
            if (matchedMove) {
                this.clearSelection();
                await this.executeUserMove(matchedMove);
                return;
            }
        }

        // Case 2: Clicked on own piece to select
        if (clickedPiece && clickedPiece.player === this.engine.turn) {
            const pieceMoves = this.engine.getLegalMovesForPiece(r, c);
            if (pieceMoves.length === 0) {
                // Illegal selection (e.g. other piece has mandatory capture)
                this.audio.playInvalid();
                this.showWarningToast('Captura obrigatória com outra peça!');
                return;
            }

            this.selectPiece(r, c, pieceMoves);
            this.audio.playSelect();
            return;
        }

        // Case 3: Clicked elsewhere
        this.clearSelection();
    }

    selectPiece(r, c, moves) {
        this.clearSelection();
        this.selectedCoord = { r, c };
        this.validMovesForSelected = moves;

        const cell = this.getCellElement(r, c);
        const piece = cell ? cell.querySelector('.piece') : null;
        if (piece) piece.classList.add('selected');

        // Draw valid move indicators & capture highlights
        moves.forEach(m => {
            const destCell = this.getCellElement(m.to.r, m.to.c);
            if (destCell) {
                const indicator = document.createElement('div');
                indicator.className = `move-indicator ${m.capturedPieces.length > 0 ? 'capture-indicator' : ''}`;
                indicator.dataset.toR = m.to.r;
                indicator.dataset.toC = m.to.c;

                // Pulsing dot
                const dot = document.createElement('div');
                dot.className = 'indicator-dot';
                indicator.appendChild(dot);

                destCell.appendChild(indicator);
            }

            // Highlight captured victims along the trajectory
            m.capturedPieces.forEach(cap => {
                const capCell = this.getCellElement(cap.r, cap.c);
                const capPiece = capCell ? capCell.querySelector('.piece') : null;
                if (capPiece) capPiece.classList.add('target-victim');
            });
        });
    }

    clearSelection() {
        this.selectedCoord = null;
        this.validMovesForSelected = [];
        document.querySelectorAll('.piece.selected').forEach(el => el.classList.remove('selected'));
        document.querySelectorAll('.target-victim').forEach(el => el.classList.remove('target-victim'));
        document.querySelectorAll('.move-indicator').forEach(el => el.remove());
    }

    /**
     * Executes move with fluid multi-step animations, sound triggers, and camera juice.
     */
    async executeUserMove(move) {
        this.isAnimating = true;

        const fromCell = this.getCellElement(move.from.r, move.from.c);
        const pieceEl = fromCell ? fromCell.querySelector('.piece') : null;

        // Perform smooth path glide
        await this.animatePieceTrajectory(pieceEl, move);

        // Commit move in engine
        const result = this.engine.executeMove(move);

        // Sound & FX feedback
        if (result.wasCapture) {
            this.audio.playCapture(result.comboCount);
            this.fx.screenShake(4 + result.comboCount * 3, 200 + result.comboCount * 50);

            // Floating combo banner
            const toCell = this.getCellElement(move.to.r, move.to.c);
            const rect = toCell.getBoundingClientRect();
            const comboText = result.comboCount > 2 ? `🔥 ULTRA COMBO X${result.comboCount}!` :
                              (result.comboCount === 2 ? `⚡ COMBO DUPLO X2!` : `💥 CAPTURA!`);
            this.fx.showFloatingText(comboText, rect.left + rect.width / 2, rect.top, '#00f0ff', 24);

            // Award XP
            this.addXP(20 * result.comboCount, `Captura x${result.comboCount}`);
        } else {
            this.audio.playMove();
            this.addXP(5, 'Movimento Tático');
        }

        if (result.isKingPromotion) {
            this.audio.playCrown();
            const toCell = this.getCellElement(move.to.r, move.to.c);
            const rect = toCell.getBoundingClientRect();
            this.fx.triggerCrownBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
            this.addXP(50, '👑 Coroamento de Dama');
        }

        this.renderBoard();
        this.updateHUD();

        // Check victory / defeat
        if (result.gameOver.over) {
            this.handleGameOver(result.gameOver);
            this.isAnimating = false;
            return;
        }

        this.isAnimating = false;

        // Trigger AI turn if needed
        this.checkAITurn();
    }

    /**
     * Animates piece through waypoints with jump arc physics
     */
    async animatePieceTrajectory(pieceEl, move) {
        if (!pieceEl) return;

        const path = move.path;
        if (path.length <= 1) return;

        for (let i = 1; i < path.length; i++) {
            const currentStep = path[i];
            const prevStep = path[i - 1];

            const currentCell = this.getCellElement(prevStep.r, prevStep.c);
            const targetCell = this.getCellElement(currentStep.r, currentStep.c);

            const r1 = currentCell.getBoundingClientRect();
            const r2 = targetCell.getBoundingClientRect();

            const dx = r2.left - r1.left;
            const dy = r2.top - r1.top;

            // Trigger leap elevation
            pieceEl.classList.add('is-leaping');
            pieceEl.style.transition = 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)';
            pieceEl.style.transform = `translate3d(${dx}px, ${dy}px, 20px) scale(1.15)`;

            const pieceColor = pieceEl.classList.contains('cyan-piece') ? '#00f0ff' : '#ff007f';
            this.fx.addMotionTrail(r1.left + r1.width / 2, r1.top + r1.height / 2, pieceColor);
            this.fx.addMotionTrail(r2.left + r2.width / 2, r2.top + r2.height / 2, pieceColor);

            await new Promise(r => setTimeout(r, 220));

            // Check if this hop captured a piece (supports both 1-step jumps and flying king jumps)
            const stepDirR = Math.sign(currentStep.r - prevStep.r);
            const stepDirC = Math.sign(currentStep.c - prevStep.c);
            let victim = null;
            let checkR = prevStep.r + stepDirR;
            let checkC = prevStep.c + stepDirC;

            while (checkR !== currentStep.r && checkC !== currentStep.c && this.engine.isValidCoord(checkR, checkC)) {
                const found = move.capturedPieces.find(p => p.r === checkR && p.c === checkC);
                if (found) {
                    victim = found;
                    break;
                }
                checkR += stepDirR;
                checkC += stepDirC;
            }

            if (victim) {
                const victimCell = this.getCellElement(victim.r, victim.c);
                if (victimCell) {
                    const victimRect = victimCell.getBoundingClientRect();
                    const color = this.engine.board[victim.r][victim.c]?.player === PLAYER_CYAN ? '#00f0ff' : '#ff007f';
                    this.fx.triggerCaptureExplosion(victimRect.left + victimRect.width / 2, victimRect.top + victimRect.height / 2, color);
                    const vPiece = victimCell.querySelector('.piece');
                    if (vPiece) vPiece.style.opacity = '0';
                }
            }

            pieceEl.style.transition = 'none';
            pieceEl.style.transform = '';
            pieceEl.classList.remove('is-leaping');
            targetCell.appendChild(pieceEl);
        }
    }

    async checkAITurn() {
        if (this.engine.isGameOver().over) return;

        const isAITurn = (this.gameMode === 'pve' && this.engine.turn !== this.userSide) ||
                         (this.gameMode === 'eve');

        if (!isAITurn) return;

        this.setAITurnIndicator(true);

        try {
            const aiMove = await this.ai.getBestMove(this.engine, this.engine.turn);
            if (aiMove) {
                await this.executeUserMove(aiMove);
            }
        } finally {
            this.setAITurnIndicator(false);
        }
    }

    setAITurnIndicator(isThinking) {
        const hudIndicator = document.getElementById('ai-thinking-badge');
        if (hudIndicator) {
            hudIndicator.style.display = isThinking ? 'inline-flex' : 'none';
        }
    }

    /**
     * Updates HUD player turn, scores, counters and material dominance gauge.
     */
    updateHUD() {
        const turnBadge = document.getElementById('turn-badge');
        const isCyanTurn = this.engine.turn === PLAYER_CYAN;

        const cyanCard = document.getElementById('player-card-cyan');
        const magentaCard = document.getElementById('player-card-magenta');
        if (cyanCard) cyanCard.classList.toggle('active-turn', isCyanTurn);
        if (magentaCard) magentaCard.classList.toggle('active-turn', !isCyanTurn);

        if (turnBadge) {
            let label = '';
            if (this.gameMode === 'pve') {
                label = isCyanTurn ? 'SEU TURNO' : 'TURNO DA IA';
            } else if (this.gameMode === 'pvp') {
                label = isCyanTurn ? 'TURNO: CYAN' : 'TURNO: MAGENTA';
            } else {
                label = isCyanTurn ? 'IA CYAN' : 'IA MAGENTA';
            }
            turnBadge.textContent = label;
            turnBadge.className = `turn-badge ${isCyanTurn ? 'turn-cyan' : 'turn-magenta'}`;
        }

        const cyanCount = this.engine.countPieces(PLAYER_CYAN);
        const magentaCount = this.engine.countPieces(PLAYER_MAGENTA);

        const cyanScoreEl = document.getElementById('cyan-pieces-count');
        const magentaScoreEl = document.getElementById('magenta-pieces-count');
        const cyanKingsEl = document.getElementById('cyan-kings-count');
        const magentaKingsEl = document.getElementById('magenta-kings-count');

        if (cyanScoreEl) cyanScoreEl.textContent = cyanCount.total;
        if (magentaScoreEl) magentaScoreEl.textContent = magentaCount.total;
        if (cyanKingsEl) cyanKingsEl.textContent = cyanCount.kings;
        if (magentaKingsEl) magentaKingsEl.textContent = magentaCount.kings;

        // Update Dominance Bar
        const dominanceBar = document.getElementById('dominance-bar-fill');
        if (dominanceBar) {
            const total = cyanCount.total + magentaCount.total;
            const cyanRatio = total > 0 ? (cyanCount.total / total) * 100 : 50;
            dominanceBar.style.width = `${cyanRatio}%`;
        }

        // Move counter
        const moveCountEl = document.getElementById('move-counter');
        if (moveCountEl) moveCountEl.textContent = this.engine.moveCount;

        // Mode Tag & Titles
        const modeTag = document.getElementById('current-mode-tag');
        if (modeTag) {
            if (this.gameMode === 'pve') modeTag.textContent = 'PVE TÁTICO';
            else if (this.gameMode === 'pvp') modeTag.textContent = 'PVP PASS&PLAY';
            else modeTag.textContent = 'ESPECTADOR IA';
        }

        const magentaTitle = document.getElementById('magenta-player-title');
        if (magentaTitle) {
            magentaTitle.textContent = this.gameMode === 'pvp' ? 'PLAYER 2' : 'SYNTH-IA';
        }
    }

    /**
     * XP and Cyber Level Gamification
     */
    addXP(amount, reason = '') {
        this.xp += amount;
        localStorage.setItem('synth_damas_xp', this.xp.toString());
        this.updateXPDisplay();

        if (reason) {
            const xpToast = document.getElementById('xp-toast');
            if (xpToast) {
                xpToast.textContent = `+${amount} XP [${reason}]`;
                xpToast.classList.add('show');
                setTimeout(() => xpToast.classList.remove('show'), 1500);
            }
        }
    }

    updateXPDisplay() {
        const xpText = document.getElementById('player-xp-val');
        const rankText = document.getElementById('player-rank-title');
        const xpBar = document.getElementById('player-xp-bar');

        const level = Math.floor(this.xp / 150) + 1;
        const currentLevelXP = this.xp % 150;
        const progressPct = (currentLevelXP / 150) * 100;

        const ranks = [
            'Iniciado Neon', 'Piloto Synth', 'Hacker Retro', 'Cyber Estrategista',
            'Comandante Laser', 'Arquiteto da Matrix', 'Grande Mestre Synthwave'
        ];
        const rankTitle = ranks[Math.min(level - 1, ranks.length - 1)];

        if (xpText) xpText.textContent = `Nível ${level} (${currentLevelXP}/150 XP)`;
        if (rankText) rankText.textContent = rankTitle;
        if (xpBar) xpBar.style.width = `${progressPct}%`;
    }

    handleGameOver(result) {
        const isCyanWinner = result.winner === PLAYER_CYAN;
        const userWon = (this.userSide === result.winner);

        if (userWon) {
            this.audio.playVictory();
            this.totalWins++;
            this.streak++;
            this.addXP(250, '🏆 Vitória Épica');
            localStorage.setItem('synth_damas_wins', this.totalWins.toString());
            localStorage.setItem('synth_damas_streak', this.streak.toString());
        } else {
            this.audio.playDefeat();
            this.streak = 0;
            localStorage.setItem('synth_damas_streak', '0');
        }

        const modal = document.getElementById('game-over-modal');
        const title = document.getElementById('game-over-title');
        const desc = document.getElementById('game-over-desc');

        if (title) {
            title.textContent = userWon ? 'VITÓRIA GLORIOSA!' : 'DERROTA NO CIBERESPAÇO';
            title.className = `modal-title ${userWon ? 'win-title' : 'lose-title'}`;
        }
        if (desc) {
            const winnerName = isCyanWinner ? 'NEON CYAN' : 'SYNTH MAGENTA';
            desc.textContent = `${winnerName} venceu a partida por ${result.reason}!`;
        }

        if (modal) modal.classList.add('open');
    }

    toggle3D() {
        this.is3D = !this.is3D;
        if (this.boardWrapper) {
            if (this.is3D) {
                this.boardWrapper.classList.add('perspective-3d');
            } else {
                this.boardWrapper.classList.remove('perspective-3d');
            }
        }
        return this.is3D;
    }

    showHint() {
        if (this.isAnimating) return;
        const moves = this.engine.getAllLegalMoves(this.engine.turn);
        if (moves.length === 0) return;

        // Choose best move via AI evaluation
        const bestMove = this.ai.getMinimaxMove(this.engine, this.engine.turn, 2);
        if (!bestMove) return;

        this.selectPiece(bestMove.from.r, bestMove.from.c, [bestMove]);
        this.showWarningToast('💡 Dica tática sugerida pelo Synth-AI!');
        this.audio.playSelect();
    }

    undoMove() {
        if (this.isAnimating) return;
        // In PvE, undo two moves (player and AI) to return to player turn
        if (this.gameMode === 'pve') {
            if (this.engine.history.length >= 2) {
                this.engine.undoMove();
                this.engine.undoMove();
            } else if (this.engine.history.length === 1) {
                this.engine.undoMove();
            }
        } else {
            this.engine.undoMove();
        }

        this.clearSelection();
        this.renderBoard();
        this.updateHUD();
        this.audio.playMove();
        this.showWarningToast('↩️ Movimento desfeito');
    }

    restartGame() {
        this.clearSelection();
        this.engine.initBoard();
        this.renderBoard();
        this.updateHUD();
        const modal = document.getElementById('game-over-modal');
        if (modal) modal.classList.remove('open');
        this.audio.playMove();
        this.showWarningToast('⚡ Nova partida iniciada!');

        // Check if AI plays first
        this.checkAITurn();
    }

    showWarningToast(msg) {
        const toast = document.getElementById('game-toast');
        if (toast) {
            toast.textContent = msg;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
        }
    }
}

window.SynthwaveUI = SynthwaveUI;
