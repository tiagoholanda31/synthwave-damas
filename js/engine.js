/**
 * SYNTHWAVE DAMAS - CORE RULES ENGINE
 * Implements Brazilian Official Rules (8x8 board, flying kings, backward captures for men,
 * mandatory capture & law of majority) with support for Casual/Standard mode.
 */

const PLAYER_CYAN = 'cyan';       // Usually Player 1 (bottom, moves up: row decreasing)
const PLAYER_MAGENTA = 'magenta'; // Usually Player 2 / AI (top, moves down: row increasing)

// Empate: 20 lances de cada lado (40 meios-lances) só com damas, sem captura e sem mover pedra.
const DRAW_QUIET_KING_PLIES = 40;

class CheckersEngine {
    constructor(ruleMode = 'brazilian') {
        this.ruleMode = ruleMode; // 'brazilian' (flying kings, back captures, majority rule) or 'casual'
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        this.turn = PLAYER_CYAN;
        this.history = [];
        this.capturedStats = { cyan: 0, magenta: 0 };
        this.kingsCreated = { cyan: 0, magenta: 0 };
        this.lastMove = null;
        this.moveCount = 0;
        this.quietKingPlies = 0;
        this.initBoard();
    }

    initBoard() {
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                // Playable on dark squares (r + c is odd)
                if ((r + c) % 2 === 1) {
                    if (r < 3) {
                        this.board[r][c] = { player: PLAYER_MAGENTA, isKing: false };
                    } else if (r > 4) {
                        this.board[r][c] = { player: PLAYER_CYAN, isKing: false };
                    }
                }
            }
        }
        this.turn = PLAYER_CYAN;
        this.history = [];
        this.capturedStats = { cyan: 0, magenta: 0 };
        this.kingsCreated = { cyan: 0, magenta: 0 };
        this.lastMove = null;
        this.moveCount = 0;
        this.quietKingPlies = 0;
    }

    clone() {
        const cloned = new CheckersEngine(this.ruleMode);
        cloned.board = this.board.map(row => row.map(cell => cell ? { ...cell } : null));
        cloned.turn = this.turn;
        cloned.capturedStats = { ...this.capturedStats };
        cloned.kingsCreated = { ...this.kingsCreated };
        cloned.lastMove = this.lastMove ? JSON.parse(JSON.stringify(this.lastMove)) : null;
        cloned.moveCount = this.moveCount;
        cloned.quietKingPlies = this.quietKingPlies;
        return cloned;
    }

    getOpponent(player) {
        return player === PLAYER_CYAN ? PLAYER_MAGENTA : PLAYER_CYAN;
    }

    isValidCoord(r, c) {
        return r >= 0 && r < 8 && c >= 0 && c < 8;
    }

    /**
     * Finds all legal moves for current player.
     * Respects mandatory capture and Law of Majority (maximum pieces captured).
     */
    getAllLegalMoves(player = this.turn) {
        const allCaptures = [];
        const allSimpleMoves = [];

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.player === player) {
                    const captures = this.getCapturesForPiece(r, c);
                    if (captures.length > 0) {
                        allCaptures.push(...captures);
                    } else {
                        const simples = this.getSimpleMovesForPiece(r, c);
                        allSimpleMoves.push(...simples);
                    }
                }
            }
        }

        // If captures exist, mandatory capture applies
        if (allCaptures.length > 0) {
            if (this.ruleMode === 'brazilian') {
                // Law of Majority: only moves capturing the maximum number of pieces are valid
                const maxCaptures = Math.max(...allCaptures.map(m => m.capturedPieces.length));
                return allCaptures.filter(m => m.capturedPieces.length === maxCaptures);
            }
            return allCaptures;
        }

        return allSimpleMoves;
    }

    /**
     * Gets legal moves for a specific piece, considering global capture obligations.
     */
    getLegalMovesForPiece(r, c) {
        const piece = this.board[r][c];
        if (!piece || piece.player !== this.turn) return [];

        const allMoves = this.getAllLegalMoves(this.turn);
        return allMoves.filter(m => m.from.r === r && m.from.c === c);
    }

    /**
     * Simple (non-capture) diagonal moves
     */
    getSimpleMovesForPiece(r, c) {
        const piece = this.board[r][c];
        if (!piece) return [];
        const moves = [];

        if (piece.isKing) {
            // Flying King: moves any distance diagonally until blocked
            const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
            for (const [dr, dc] of dirs) {
                let step = 1;
                while (true) {
                    const nr = r + dr * step;
                    const nc = c + dc * step;
                    if (!this.isValidCoord(nr, nc) || this.board[nr][nc] !== null) break;
                    moves.push({
                        from: { r, c },
                        to: { r: nr, c: nc },
                        path: [{ r, c }, { r: nr, c: nc }],
                        capturedPieces: [],
                        isKingPromotion: false
                    });
                    step++;
                }
            }
        } else {
            // Normal piece: moves 1 step forward diagonally
            const dir = piece.player === PLAYER_CYAN ? -1 : 1;
            const dirs = [[dir, -1], [dir, 1]];
            for (const [dr, dc] of dirs) {
                const nr = r + dr;
                const nc = c + dc;
                if (this.isValidCoord(nr, nc) && this.board[nr][nc] === null) {
                    const willPromote = (piece.player === PLAYER_CYAN && nr === 0) ||
                                        (piece.player === PLAYER_MAGENTA && nr === 7);
                    moves.push({
                        from: { r, c },
                        to: { r: nr, c: nc },
                        path: [{ r, c }, { r: nr, c: nc }],
                        capturedPieces: [],
                        isKingPromotion: willPromote
                    });
                }
            }
        }
        return moves;
    }

    /**
     * Recursive search for all capture sequences (chains) for a piece.
     */
    getCapturesForPiece(startR, startC) {
        const piece = this.board[startR][startC];
        if (!piece) return [];

        const completedPaths = [];
        const simulatedBoard = this.board.map(row => row.map(cell => cell ? { ...cell } : null));

        const explore = (curR, curC, currentPath, capturedSoFar, isCurrentlyKing) => {
            const capturesFromHere = [];
            const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

            if (isCurrentlyKing) {
                // Flying King Captures:
                // Scan in each diagonal direction. Can jump over 1 opponent piece at any distance,
                // and land on any free square after that piece until the next blocked square.
                for (const [dr, dc] of dirs) {
                    let step = 1;
                    let oppPiece = null;
                    let oppPos = null;

                    while (true) {
                        const tr = curR + dr * step;
                        const tc = curC + dc * step;
                        if (!this.isValidCoord(tr, tc)) break;

                        const cell = simulatedBoard[tr][tc];
                        if (cell !== null) {
                            if (cell.player !== piece.player && !capturedSoFar.some(p => p.r === tr && p.c === tc)) {
                                if (oppPiece === null) {
                                    oppPiece = cell;
                                    oppPos = { r: tr, c: tc };
                                } else {
                                    // Second piece in diagonal, cannot jump two pieces together
                                    break;
                                }
                            } else {
                                // Friendly piece or already captured piece blocking path
                                break;
                            }
                        } else {
                            // Empty square
                            if (oppPiece !== null) {
                                // Valid landing square after jumping opponent piece
                                capturesFromHere.push({
                                    landing: { r: tr, c: tc },
                                    captured: oppPos,
                                    becameKing: isCurrentlyKing
                                });
                            }
                        }
                        step++;
                    }
                }
            } else {
                // Normal piece captures (Brazilian rules: forwards AND backwards!)
                for (const [dr, dc] of dirs) {
                    const midR = curR + dr;
                    const midC = curC + dc;
                    const landR = curR + dr * 2;
                    const landC = curC + dc * 2;

                    if (this.isValidCoord(landR, landC)) {
                        const midCell = simulatedBoard[midR][midC];
                        const landCell = simulatedBoard[landR][landC];

                        if (midCell && midCell.player !== piece.player &&
                            !capturedSoFar.some(p => p.r === midR && p.c === midC) &&
                            landCell === null) {

                            const willPromote = (piece.player === PLAYER_CYAN && landR === 0) ||
                                                (piece.player === PLAYER_MAGENTA && landR === 7);

                            capturesFromHere.push({
                                landing: { r: landR, c: landC },
                                captured: { r: midR, c: midC },
                                becameKing: isCurrentlyKing || willPromote
                            });
                        }
                    }
                }
            }

            if (capturesFromHere.length === 0) {
                // End of this capture chain
                if (capturedSoFar.length > 0) {
                    completedPaths.push({
                        from: { r: startR, c: startC },
                        to: { r: curR, c: curC },
                        path: [...currentPath],
                        capturedPieces: [...capturedSoFar],
                        isKingPromotion: isCurrentlyKing && !piece.isKing
                    });
                }
                return;
            }

            // Continue recursion on next jumps
            for (const next of capturesFromHere) {
                // Temporarily apply jump on simulated board
                const originalLanding = simulatedBoard[next.landing.r][next.landing.c];
                simulatedBoard[next.landing.r][next.landing.c] = {
                    player: piece.player,
                    isKing: next.becameKing
                };
                simulatedBoard[curR][curC] = null;

                explore(
                    next.landing.r,
                    next.landing.c,
                    [...currentPath, next.landing],
                    [...capturedSoFar, next.captured],
                    next.becameKing
                );

                // Revert simulation
                simulatedBoard[curR][curC] = {
                    player: piece.player,
                    isKing: isCurrentlyKing
                };
                simulatedBoard[next.landing.r][next.landing.c] = originalLanding;
            }
        };

        explore(startR, startC, [{ r: startR, c: startC }], [], piece.isKing);

        // Deduplicate paths ending in same destination with same captures
        return completedPaths;
    }

    /**
     * Executes a move on the board.
     * Records state for Undo capability and updates turn/counters.
     */
    executeMove(move) {
        // Save history snapshot
        this.history.push({
            board: this.board.map(row => row.map(cell => cell ? { ...cell } : null)),
            turn: this.turn,
            capturedStats: { ...this.capturedStats },
            kingsCreated: { ...this.kingsCreated },
            lastMove: this.lastMove,
            moveCount: this.moveCount,
            quietKingPlies: this.quietKingPlies
        });

        const piece = this.board[move.from.r][move.from.c];
        if (!piece) return null;

        // Remove from start square
        this.board[move.from.r][move.from.c] = null;

        // Remove all captured pieces
        for (const cap of move.capturedPieces) {
            this.board[cap.r][cap.c] = null;
            this.capturedStats[piece.player]++;
        }

        // Place on final destination
        let finalKing = piece.isKing || move.isKingPromotion;
        // In standard rules, if piece reaches end row, it becomes king
        if (!finalKing) {
            if ((piece.player === PLAYER_CYAN && move.to.r === 0) ||
                (piece.player === PLAYER_MAGENTA && move.to.r === 7)) {
                finalKing = true;
                this.kingsCreated[piece.player]++;
            }
        } else if (!piece.isKing && finalKing) {
            this.kingsCreated[piece.player]++;
        }

        this.board[move.to.r][move.to.c] = {
            player: piece.player,
            isKing: finalKing
        };

        this.lastMove = move;
        this.moveCount++;
        this.quietKingPlies = (piece.isKing && move.capturedPieces.length === 0) ? this.quietKingPlies + 1 : 0;
        this.turn = this.getOpponent(this.turn);

        return {
            move,
            wasCapture: move.capturedPieces.length > 0,
            comboCount: move.capturedPieces.length,
            isKingPromotion: finalKing && !piece.isKing,
            nextTurn: this.turn,
            gameOver: this.isGameOver()
        };
    }

    undoMove() {
        if (this.history.length === 0) return false;
        const prev = this.history.pop();
        this.board = prev.board;
        this.turn = prev.turn;
        this.capturedStats = prev.capturedStats;
        this.kingsCreated = prev.kingsCreated;
        this.lastMove = prev.lastMove;
        this.moveCount = prev.moveCount;
        this.quietKingPlies = prev.quietKingPlies || 0;
        return true;
    }

    isGameOver() {
        const cyanMoves = this.getAllLegalMoves(PLAYER_CYAN);
        const magentaMoves = this.getAllLegalMoves(PLAYER_MAGENTA);

        const cyanPieces = this.countPieces(PLAYER_CYAN);
        const magentaPieces = this.countPieces(PLAYER_MAGENTA);

        if (cyanPieces.total === 0 || (this.turn === PLAYER_CYAN && cyanMoves.length === 0)) {
            return { over: true, winner: PLAYER_MAGENTA, reason: cyanPieces.total === 0 ? 'peças eliminadas' : 'sem movimentos válidos' };
        }
        if (magentaPieces.total === 0 || (this.turn === PLAYER_MAGENTA && magentaMoves.length === 0)) {
            return { over: true, winner: PLAYER_CYAN, reason: magentaPieces.total === 0 ? 'peças eliminadas' : 'sem movimentos válidos' };
        }
        if (this.quietKingPlies >= DRAW_QUIET_KING_PLIES) {
            return { over: true, winner: null, reason: '20 lances de damas sem captura' };
        }

        return { over: false, winner: null };
    }

    countPieces(player) {
        let count = 0;
        let kings = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const cell = this.board[r][c];
                if (cell && cell.player === player) {
                    count++;
                    if (cell.isKing) kings++;
                }
            }
        }
        return { total: count, kings };
    }
}

window.CheckersEngine = CheckersEngine;
window.PLAYER_CYAN = PLAYER_CYAN;
window.PLAYER_MAGENTA = PLAYER_MAGENTA;
window.DRAW_QUIET_KING_PLIES = DRAW_QUIET_KING_PLIES;
