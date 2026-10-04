/**
 * SYNTHWAVE DAMAS - SENIOR UX/UI RENDER & INTERACTION ENGINE v2.6
 * Features:
 * - Fluid Pointer Drag & Drop with tactile snap and click fallback
 * - Real-time holographic laser trajectory arcs & targeting reticles
 * - Dynamic 3D gyro perspective / mouse parallax
 * - Outer holographic coordinate rails with reactive cell highlighting
 * - Live match clock & material dominance telemetry (+/- advantage badge)
 * - Complete combat log (Feed Tático) with algebraic notation
 * - Luxury Post-Match Performance Telemetry Modal with board inspection mode
 * - Haptic vibration feedback for mobile & tactile touchpads
 */

class SynthwaveUI {
    constructor(engine, ai, fx, audio) {
        this.engine = engine;
        this.ai = ai;
        this.fx = fx;
        this.audio = audio;

        this.boardEl = document.getElementById('checkers-board');
        this.boardWrapper = document.getElementById('board-wrapper');
        this.arenaContainer = document.querySelector('.arena-container');

        this.selectedCoord = null;
        this.validMovesForSelected = [];
        this.isAnimating = false;
        this.is3D = true;
        this.gameMode = 'pve'; // 'pve', 'pvp', 'eve'
        this.userSide = PLAYER_CYAN;

        // Pointer Drag & Drop State
        this.dragState = null;

        // Telemetry & Match Stats
        this.matchStartTime = Date.now();
        this.timerInterval = null;
        this.combatLog = [];
        this.maxComboMatch = 1;
        this.totalCapturesMatch = 0;

        // Player XP & Gamification State (persisted in LocalStorage)
        this.xp = parseInt(localStorage.getItem('synth_damas_xp') || '0', 10);
        this.streak = parseInt(localStorage.getItem('synth_damas_streak') || '0', 10);
        this.totalWins = parseInt(localStorage.getItem('synth_damas_wins') || '0', 10);

        this.initDOM();
        this.initParallax();
        this.initGlobalPointerEvents();
        this.startMatchTimer();
        this.renderBoard();
        this.updateHUD();
        this.updateXPDisplay();
    }

    initDOM() {
        this.boardEl.innerHTML = '';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const cell = document.createElement('div');
                cell.className = `cell ${(r + c) % 2 === 1 ? 'dark-cell' : 'light-cell'}`;
                cell.dataset.row = r;
                cell.dataset.col = c;

                cell.addEventListener('click', (e) => this.onCellClick(r, c, e));
                this.boardEl.appendChild(cell);
            }
        }
    }

    /**
     * Smooth 3D gyro table parallax tracking cursor coordinates
     */
    initParallax() {
        if (!this.arenaContainer || !this.boardWrapper) return;

        let targetTiltX = 0;
        let targetTiltY = 0;
        let currentTiltX = 0;
        let currentTiltY = 0;
        let isHovered = false;

        const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

        const updateTilt = () => {
            if (this.is3D && isHovered) {
                currentTiltX = lerp(currentTiltX, targetTiltX, 0.1);
                currentTiltY = lerp(currentTiltY, targetTiltY, 0.1);
                this.boardWrapper.style.transform = `perspective(1050px) rotateX(${25 + currentTiltY}deg) rotateY(${currentTiltX}deg) scale(0.98)`;
            } else if (this.is3D) {
                currentTiltX = lerp(currentTiltX, 0, 0.08);
                currentTiltY = lerp(currentTiltY, 0, 0.08);
                if (Math.abs(currentTiltX) > 0.01 || Math.abs(currentTiltY) > 0.01) {
                    this.boardWrapper.style.transform = `perspective(1050px) rotateX(${25 + currentTiltY}deg) rotateY(${currentTiltX}deg) scale(0.98)`;
                } else {
                    this.boardWrapper.style.transform = '';
                }
            }
            requestAnimationFrame(updateTilt);
        };
        requestAnimationFrame(updateTilt);

        this.arenaContainer.addEventListener('mousemove', (e) => {
            if (!this.is3D) return;
            isHovered = true;
            const rect = this.boardWrapper.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            targetTiltX = ((e.clientX - centerX) / (window.innerWidth / 2)) * 6;
            targetTiltY = ((e.clientY - centerY) / (window.innerHeight / 2)) * -5;
        });

        this.arenaContainer.addEventListener('mouseleave', () => {
            isHovered = false;
            targetTiltX = 0;
            targetTiltY = 0;
        });
    }

    /**
     * Real-time match clock
     */
    startMatchTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.matchStartTime = Date.now();
        const timerEl = document.getElementById('match-timer-display');

        this.timerInterval = setInterval(() => {
            if (!timerEl) return;
            const elapsed = Math.floor((Date.now() - this.matchStartTime) / 1000);
            const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const s = String(elapsed % 60).padStart(2, '0');
            timerEl.textContent = `${m}:${s}`;
        }, 1000);
    }

    /**
     * Haptic feedback helper
     */
    vibrate(pattern = [30]) {
        try {
            const toggle = document.getElementById('toggle-haptic');
            if (toggle && !toggle.checked) return;
            if (navigator.vibrate) {
                navigator.vibrate(pattern);
            }
        } catch (_) {}
    }

    /**
     * Converts board row/col to standard algebraic notation (e.g. 5,2 -> C3)
     */
    toAlgebraic(r, c) {
        const file = String.fromCharCode(65 + c);
        const rank = 8 - r;
        return `${file}${rank}`;
    }

    /**
     * Outer coordinate rails lighting
     */
    highlightRails(r, c) {
        this.clearRailsHighlight();
        document.querySelectorAll(`#coord-rail-top [data-file="${c}"], #coord-rail-bottom [data-file="${c}"]`)
            .forEach(el => el.classList.add('active-coord'));
        document.querySelectorAll(`#coord-rail-left [data-rank="${r}"], #coord-rail-right [data-rank="${r}"]`)
            .forEach(el => el.classList.add('active-coord'));
    }

    clearRailsHighlight() {
        document.querySelectorAll('.active-coord').forEach(el => el.classList.remove('active-coord'));
    }

    /**
     * Renders all pieces on board
     */
    renderBoard() {
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

        // Highlight last move
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

        // Core and rotating Sci-Fi ring
        const core = document.createElement('div');
        core.className = 'piece-core';

        const ring = document.createElement('div');
        ring.className = 'piece-ring';

        piece.appendChild(core);
        piece.appendChild(ring);

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

        // Hover micro-interactions & Coordinate rail glow
        piece.addEventListener('mouseenter', () => {
            if (this.isAnimating || this.dragState) return;
            if (data.player === this.engine.turn && !this.isTurnLocked()) {
                this.highlightRails(r, c);
                this.audio.playHover();
            }
        });

        piece.addEventListener('mouseleave', () => {
            if (!this.dragState && (!this.selectedCoord || this.selectedCoord.r !== r || this.selectedCoord.c !== c)) {
                this.clearRailsHighlight();
            }
        });

        // Pointer Drag & Drop Listener
        piece.addEventListener('pointerdown', (e) => this.onPiecePointerDown(e, r, c, piece));

        return piece;
    }

    getCellElement(r, c) {
        return this.boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    }

    isTurnLocked() {
        if (this.gameMode === 'eve') return true;
        if (this.gameMode === 'pve' && this.engine.turn !== this.userSide) return true;
        return false;
    }

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

    // =========================================================================
    // POINTER DRAG & DROP ENGINE
    // =========================================================================

    initGlobalPointerEvents() {
        window.addEventListener('pointermove', (e) => this.onGlobalPointerMove(e));
        window.addEventListener('pointerup', (e) => this.onGlobalPointerUp(e));
        window.addEventListener('pointercancel', (e) => this.onGlobalPointerUp(e));
    }

    onPiecePointerDown(e, r, c, pieceEl) {
        if (this.isAnimating || this.isTurnLocked()) return;

        const pieceData = this.engine.board[r][c];
        if (!pieceData || pieceData.player !== this.engine.turn) return;

        // Check legal moves for this piece
        const legalMoves = this.engine.getLegalMovesForPiece(r, c);
        if (legalMoves.length === 0) {
            this.audio.playInvalid();
            this.showWarningToast('Captura obrigatória com outra peça!');
            this.vibrate([40, 40]);
            return;
        }

        // Initialize drag candidate
        this.dragState = {
            pieceEl,
            startR: r,
            startC: c,
            startX: e.clientX,
            startY: e.clientY,
            pointerId: e.pointerId,
            isDragging: false,
            initialRect: pieceEl.getBoundingClientRect()
        };

        // Select piece immediately
        this.selectPiece(r, c, legalMoves);
        this.audio.playSelect();
        this.vibrate([20]);

        try {
            pieceEl.setPointerCapture(e.pointerId);
        } catch (_) {}
    }

    onGlobalPointerMove(e) {
        if (!this.dragState) return;

        const dx = e.clientX - this.dragState.startX;
        const dy = e.clientY - this.dragState.startY;

        // Check if movement exceeded drag threshold
        if (!this.dragState.isDragging && Math.hypot(dx, dy) > 8) {
            this.dragState.isDragging = true;
            this.dragState.pieceEl.classList.add('is-dragging');
            this.vibrate([15]);
        }

        if (this.dragState.isDragging) {
            this.dragState.pieceEl.style.transform = `translate3d(${dx}px, ${dy}px, 35px) scale(1.18)`;

            // Detect cell underneath pointer
            const hoveredEl = document.elementFromPoint(e.clientX, e.clientY);
            const targetCell = hoveredEl ? hoveredEl.closest('.cell') : null;

            document.querySelectorAll('.drag-over-valid').forEach(el => el.classList.remove('drag-over-valid'));

            if (targetCell) {
                const tr = parseInt(targetCell.dataset.row, 10);
                const tc = parseInt(targetCell.dataset.col, 10);
                const isValidDest = this.validMovesForSelected.some(m => m.to.r === tr && m.to.c === tc);
                if (isValidDest) {
                    targetCell.classList.add('drag-over-valid');
                }
            }
        }
    }

    async onGlobalPointerUp(e) {
        if (!this.dragState) return;

        const { pieceEl, startR, startC, isDragging, pointerId } = this.dragState;

        try {
            pieceEl.releasePointerCapture(pointerId);
        } catch (_) {}

        if (isDragging) {
            // Find drop target
            const hoveredEl = document.elementFromPoint(e.clientX, e.clientY);
            const targetCell = hoveredEl ? hoveredEl.closest('.cell') : null;

            document.querySelectorAll('.drag-over-valid').forEach(el => el.classList.remove('drag-over-valid'));

            let moveExecuted = false;
            if (targetCell) {
                const tr = parseInt(targetCell.dataset.row, 10);
                const tc = parseInt(targetCell.dataset.col, 10);
                const matchedMove = this.validMovesForSelected.find(m => m.to.r === tr && m.to.c === tc);

                if (matchedMove) {
                    moveExecuted = true;
                    pieceEl.classList.remove('is-dragging');
                    pieceEl.style.transform = '';
                    this.clearSelection();
                    this.dragState = null;
                    this.audio.playDrop();
                    this.vibrate([25]);
                    await this.executeUserMove(matchedMove);
                    return;
                }
            }

            if (!moveExecuted) {
                // Spring snap back to origin cell
                pieceEl.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
                pieceEl.style.transform = '';
                setTimeout(() => {
                    pieceEl.classList.remove('is-dragging');
                    pieceEl.style.transition = '';
                }, 240);
            }
        }

        this.dragState = null;
    }

    /**
     * Cell click handler (Click-to-Move fallback)
     */
    async onCellClick(r, c, event) {
        if (this.isAnimating || this.isTurnLocked()) return;

        // Case 1: Clicked on a valid destination
        if (this.selectedCoord) {
            const matchedMove = this.validMovesForSelected.find(m => m.to.r === r && m.to.c === c);
            if (matchedMove) {
                this.clearSelection();
                this.audio.playDrop();
                await this.executeUserMove(matchedMove);
                return;
            }
        }

        // Case 2: Clicked on own piece
        const clickedPiece = this.engine.board[r][c];
        if (clickedPiece && clickedPiece.player === this.engine.turn) {
            const pieceMoves = this.engine.getLegalMovesForPiece(r, c);
            if (pieceMoves.length === 0) {
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

    /**
     * Selects piece and projects holographic laser trajectory arcs on canvas
     */
    selectPiece(r, c, moves) {
        this.clearSelection();
        this.selectedCoord = { r, c };
        this.validMovesForSelected = moves;
        this.highlightRails(r, c);

        const cell = this.getCellElement(r, c);
        const piece = cell ? cell.querySelector('.piece') : null;
        if (piece) piece.classList.add('selected');

        const trajectories = [];
        const fromCell = this.getCellElement(r, c);
        const r1 = fromCell ? fromCell.getBoundingClientRect() : null;

        moves.forEach(m => {
            const destCell = this.getCellElement(m.to.r, m.to.c);
            if (destCell) {
                const indicator = document.createElement('div');
                indicator.className = `move-indicator ${m.capturedPieces.length > 0 ? 'capture-indicator' : ''}`;
                indicator.dataset.toR = m.to.r;
                indicator.dataset.toC = m.to.c;

                const dot = document.createElement('div');
                dot.className = 'indicator-dot';
                indicator.appendChild(dot);
                destCell.appendChild(indicator);

                // Trajectory beam calculation
                if (r1) {
                    const r2 = destCell.getBoundingClientRect();
                    trajectories.push({
                        fromX: r1.left + r1.width / 2,
                        fromY: r1.top + r1.height / 2,
                        toX: r2.left + r2.width / 2,
                        toY: r2.top + r2.height / 2,
                        isCapture: m.capturedPieces.length > 0
                    });
                }
            }

            // Target victim crosshairs
            m.capturedPieces.forEach(cap => {
                const capCell = this.getCellElement(cap.r, cap.c);
                const capPiece = capCell ? capCell.querySelector('.piece') : null;
                if (capPiece) capPiece.classList.add('target-victim');
            });
        });

        // Send trajectories to visual fx engine
        if (this.fx && this.fx.setTrajectories) {
            this.fx.setTrajectories(trajectories);
        }
    }

    clearSelection() {
        this.selectedCoord = null;
        this.validMovesForSelected = [];
        this.clearRailsHighlight();
        if (this.fx && this.fx.clearTrajectories) {
            this.fx.clearTrajectories();
        }
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
        const movingPlayer = this.engine.turn;
        const result = this.engine.executeMove(move);

        this.totalMovesMatch++;

        // Sound & FX feedback
        if (result.wasCapture) {
            this.totalCapturesMatch += result.comboCount;
            if (result.comboCount > this.maxComboMatch) {
                this.maxComboMatch = result.comboCount;
            }

            this.audio.playCapture(result.comboCount);
            this.fx.screenShake(4 + result.comboCount * 3, 200 + result.comboCount * 50);
            this.vibrate([60, 40, 100]);

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
            this.vibrate([40, 40, 80]);
        }

        // Record into Combat Feed
        this.recordMoveInCombatLog(movingPlayer, move, result);

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

            // Check captured victim on this hop
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

    /**
     * Records moves into the Slide-in Combat Log
     */
    recordMoveInCombatLog(player, move, result) {
        const fromAlg = this.toAlgebraic(move.from.r, move.from.c);
        const toAlg = this.toAlgebraic(move.to.r, move.to.c);
        const isCapture = result.wasCapture;
        const notation = isCapture 
            ? `${fromAlg} ✕ ${toAlg}${result.comboCount > 1 ? ` [x${result.comboCount}]` : ''}`
            : `${fromAlg} → ${toAlg}`;
        const crowned = result.isKingPromotion ? ' 👑' : '';

        const chip = document.createElement('div');
        chip.className = `history-chip chip-${player}`;
        chip.innerHTML = `
            <span class="chip-index">#${this.engine.moveCount}</span>
            <span class="chip-player-tag">${player === PLAYER_CYAN ? 'CYAN' : 'MAGENTA'}</span>
            <span class="chip-notation">${notation}${crowned}</span>
        `;

        const movesList = document.getElementById('history-moves-list');
        if (movesList) {
            const emptyNotice = movesList.querySelector('.history-empty');
            if (emptyNotice) emptyNotice.remove();
            movesList.prepend(chip);
        }

        const totalMovesEl = document.getElementById('history-total-moves');
        if (totalMovesEl) totalMovesEl.textContent = this.engine.moveCount;

        const maxComboEl = document.getElementById('history-max-combo');
        if (maxComboEl) maxComboEl.textContent = `x${this.maxComboMatch}`;
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
     * Updates HUD player turn, scores, counters, dominance bar and material balance tag.
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

        // Dominance Bar
        const dominanceBar = document.getElementById('dominance-bar-fill');
        if (dominanceBar) {
            const total = cyanCount.total + magentaCount.total;
            const cyanRatio = total > 0 ? (cyanCount.total / total) * 100 : 50;
            dominanceBar.style.width = `${cyanRatio}%`;
        }

        // Material Balance Tag
        const materialTag = document.getElementById('material-balance-tag');
        if (materialTag) {
            const diff = cyanCount.total - magentaCount.total;
            if (diff > 0) {
                materialTag.textContent = `+${diff} CYAN`;
                materialTag.className = 'telemetry-item balance-tag balance-cyan';
            } else if (diff < 0) {
                materialTag.textContent = `+${Math.abs(diff)} MAG`;
                materialTag.className = 'telemetry-item balance-tag balance-magenta';
            } else {
                materialTag.textContent = '= BAL';
                materialTag.className = 'telemetry-item balance-tag balance-even';
            }
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

    /**
     * Post-Match Report with full gameplay telemetry
     */
    handleGameOver(result) {
        const isCyanWinner = result.winner === PLAYER_CYAN;
        const userWon = (this.userSide === result.winner);

        const elapsedSec = Math.floor((Date.now() - this.matchStartTime) / 1000);
        const m = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
        const s = String(elapsedSec % 60).padStart(2, '0');
        const formattedTime = `${m}:${s}`;

        if (userWon) {
            this.audio.playVictory();
            this.fx.triggerVictoryFireworks();
            this.totalWins++;
            this.streak++;
            this.addXP(250, '🏆 Vitória Épica');
            localStorage.setItem('synth_damas_wins', this.totalWins.toString());
            localStorage.setItem('synth_damas_streak', this.streak.toString());
            this.vibrate([100, 50, 100, 50, 200]);
        } else {
            this.audio.playDefeat();
            this.streak = 0;
            localStorage.setItem('synth_damas_streak', '0');
            this.vibrate([150, 80, 250]);
        }

        const modal = document.getElementById('game-over-modal');
        const title = document.getElementById('game-over-title');
        const desc = document.getElementById('game-over-desc');
        const tag = document.getElementById('game-over-tag');
        const emblem = document.getElementById('game-over-emblem');

        if (title) {
            title.textContent = userWon ? 'VITÓRIA GLORIOSA!' : 'DERROTA NO CIBERESPAÇO';
            title.className = `modal-title ${userWon ? 'win-title' : 'lose-title'}`;
        }
        if (tag) {
            tag.textContent = userWon ? 'DOMÍNIO DA MATRIX' : 'SISTEMA COMPROMETIDO';
        }
        if (emblem) {
            emblem.textContent = userWon ? '👑' : '💀';
        }
        if (desc) {
            const winnerName = isCyanWinner ? 'NEON CYAN' : 'SYNTH MAGENTA';
            desc.textContent = `${winnerName} venceu a disputa por ${result.reason}!`;
        }

        // Populate Match Performance Telemetry Grid
        const statTime = document.getElementById('stat-match-time');
        const statMoves = document.getElementById('stat-match-moves');
        const statCaptures = document.getElementById('stat-match-captures');
        const statCombo = document.getElementById('stat-match-combo');
        const statKings = document.getElementById('stat-match-kings');
        const statXP = document.getElementById('stat-match-xp');

        if (statTime) statTime.textContent = formattedTime;
        if (statMoves) statMoves.textContent = this.engine.moveCount;
        if (statCaptures) statCaptures.textContent = this.totalCapturesMatch;
        if (statCombo) statCombo.textContent = `x${this.maxComboMatch}`;
        if (statKings) statKings.textContent = this.engine.kingsCreated[PLAYER_CYAN];
        if (statXP) statXP.textContent = userWon ? '+250 XP' : '+50 XP';

        if (modal) modal.classList.add('open');
    }

    toggle3D() {
        this.is3D = !this.is3D;
        if (this.boardWrapper) {
            if (this.is3D) {
                this.boardWrapper.classList.add('perspective-3d');
            } else {
                this.boardWrapper.classList.remove('perspective-3d');
                this.boardWrapper.style.transform = '';
            }
        }
        return this.is3D;
    }

    showHint() {
        if (this.isAnimating) return;
        const moves = this.engine.getAllLegalMoves(this.engine.turn);
        if (moves.length === 0) return;

        const bestMove = this.ai.getMinimaxMove(this.engine, this.engine.turn, 2);
        if (!bestMove) return;

        this.selectPiece(bestMove.from.r, bestMove.from.c, [bestMove]);
        this.showWarningToast('💡 Dica tática calculada pela Matrix!');
        this.audio.playSelect();
    }

    undoMove() {
        if (this.isAnimating) return;
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
        this.showWarningToast('↩️ Lance desfeito com sucesso');
    }

    restartGame() {
        this.clearSelection();
        this.engine.initBoard();
        this.maxComboMatch = 1;
        this.totalCapturesMatch = 0;
        this.startMatchTimer();

        // Reset combat log
        const movesList = document.getElementById('history-moves-list');
        if (movesList) {
            movesList.innerHTML = '<div class="history-empty">Nenhum lance executado ainda. Mova uma peça para registrar o feed.</div>';
        }
        const totalMovesEl = document.getElementById('history-total-moves');
        if (totalMovesEl) totalMovesEl.textContent = '0';
        const maxComboEl = document.getElementById('history-max-combo');
        if (maxComboEl) maxComboEl.textContent = '--';

        this.renderBoard();
        this.updateHUD();

        const modal = document.getElementById('game-over-modal');
        if (modal) modal.classList.remove('open');
        this.audio.playMove();
        this.showWarningToast('⚡ Nova disputa tática iniciada!');

        this.checkAITurn();
    }

    showWarningToast(msg) {
        const toast = document.getElementById('game-toast');
        if (toast) {
            toast.textContent = msg;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2200);
        }
    }
}

window.SynthwaveUI = SynthwaveUI;
