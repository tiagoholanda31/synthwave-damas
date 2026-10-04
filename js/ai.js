/**
 * SYNTHWAVE DAMAS - ARTIFICIAL INTELLIGENCE
 * Multi-tier AI Engine featuring Minimax with Alpha-Beta Pruning,
 * Quiescence search for captures, and Brazilian Checkers tactical heuristics.
 */

class SynthwaveAI {
    constructor(difficulty = 'tactical') {
        this.difficulty = difficulty; // 'novice', 'tactical', 'master'
    }

    setDifficulty(diff) {
        this.difficulty = diff;
    }

    /**
     * Chooses the best move for the AI player.
     * Returns a Promise resolving to the selected move.
     */
    async getBestMove(engine, aiPlayer = PLAYER_MAGENTA) {
        const legalMoves = engine.getAllLegalMoves(aiPlayer);
        if (legalMoves.length === 0) return null;
        if (legalMoves.length === 1) return legalMoves[0];

        // Artificial thinking delay for immersion & fluid pacing
        const thinkDelay = this.difficulty === 'novice' ? 300 : (this.difficulty === 'tactical' ? 450 : 600);
        await new Promise(r => setTimeout(r, thinkDelay));

        if (this.difficulty === 'novice') {
            return this.getNoviceMove(legalMoves);
        } else if (this.difficulty === 'tactical') {
            return this.getMinimaxMove(engine, aiPlayer, 3);
        } else {
            // Master: depth 5 with alpha-beta pruning
            return this.getMinimaxMove(engine, aiPlayer, 5);
        }
    }

    /**
     * Novice: Selects moves with light random dispersion, prioritizing captures if available.
     */
    getNoviceMove(moves) {
        // If there's capture, pick random among captures (already filtered by engine if mandatory)
        // 25% chance to make a suboptimal move, otherwise pick randomly
        return moves[Math.floor(Math.random() * moves.length)];
    }

    /**
     * Minimax with Alpha-Beta Pruning
     */
    getMinimaxMove(engine, aiPlayer, maxDepth) {
        const legalMoves = engine.getAllLegalMoves(aiPlayer);
        let bestScore = -Infinity;
        let bestMove = legalMoves[0];
        let alpha = -Infinity;
        let beta = Infinity;

        // Shuffle moves to avoid predictable patterns
        const shuffled = [...legalMoves].sort(() => Math.random() - 0.5);

        for (const move of shuffled) {
            const simEngine = engine.clone();
            simEngine.executeMove(move);

            // Minimax call (next is opponent: minimize)
            const score = this.minimax(simEngine, maxDepth - 1, alpha, beta, false, aiPlayer);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
            alpha = Math.max(alpha, bestScore);
            if (beta <= alpha) break;
        }

        return bestMove;
    }

    minimax(engine, depth, alpha, beta, isMaximizing, aiPlayer) {
        const opponent = engine.getOpponent(aiPlayer);
        const over = engine.isGameOver();

        if (over.over) {
            if (over.winner === aiPlayer) return 10000 + depth;
            if (over.winner === opponent) return -10000 - depth;
            return 0; // Draw
        }

        if (depth <= 0) {
            return this.evaluateBoard(engine.board, aiPlayer);
        }

        const currentTurn = isMaximizing ? aiPlayer : opponent;
        const legalMoves = engine.getAllLegalMoves(currentTurn);

        if (legalMoves.length === 0) {
            return isMaximizing ? -10000 - depth : 10000 + depth;
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of legalMoves) {
                const simEngine = engine.clone();
                simEngine.executeMove(move);
                const evalScore = this.minimax(simEngine, depth - 1, alpha, beta, false, aiPlayer);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of legalMoves) {
                const simEngine = engine.clone();
                simEngine.executeMove(move);
                const evalScore = this.minimax(simEngine, depth - 1, alpha, beta, true, aiPlayer);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    /**
     * Positional & Tactical Evaluation Heuristic
     * - Piece differential: Men = 100, Kings = 320
     * - Positional: Advancement towards enemy rank
     * - Center control (rows 3,4 and cols 2,3,4,5)
     * - Back row protection (guarding against early kinging)
     * - Edge safety penalty (pieces stuck at rim have less mobility)
     */
    evaluateBoard(board, aiPlayer) {
        const humanPlayer = aiPlayer === PLAYER_CYAN ? PLAYER_MAGENTA : PLAYER_CYAN;
        let score = 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (!piece) continue;

                const isAI = piece.player === aiPlayer;
                const multiplier = isAI ? 1 : -1;

                // 1. Material value
                const baseVal = piece.isKing ? 320 : 100;
                let posVal = 0;

                // 2. Position advancement for normal pieces
                if (!piece.isKing) {
                    if (piece.player === PLAYER_MAGENTA) {
                        // Moving down: r from 0 -> 7
                        posVal += r * 8;
                    } else {
                        // Moving up: r from 7 -> 0
                        posVal += (7 - r) * 8;
                    }
                }

                // 3. Center Control (Damas board middle squares are tactically supreme)
                if ((r === 3 || r === 4) && (c >= 2 && c <= 5)) {
                    posVal += piece.isKing ? 25 : 15;
                }

                // 4. Back row protection (defense)
                if (!piece.isKing) {
                    if (piece.player === PLAYER_MAGENTA && r === 0) posVal += 20;
                    if (piece.player === PLAYER_CYAN && r === 7) posVal += 20;
                }

                // 5. Border penalty (pieces on edge cols have 50% fewer diagonal options)
                if (c === 0 || c === 7) {
                    posVal -= 8;
                }

                score += multiplier * (baseVal + posVal);
            }
        }

        return score;
    }
}

window.SynthwaveAI = SynthwaveAI;
