/**
 * Martina Chess Bot - Rebuilt using Sebastian Lague's Methods
 * Based on: https://github.com/SebLague/Chess-Coding-Adventure
 * Video: https://youtu.be/_vqlIPDR2TU
 */

class MartinaBot {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.name = 'Martina';
        
        // Transposition table for position caching
        this.transpositionTable = new Map();
        
        // Move ordering helpers
        this.killerMoves = Array(64).fill(null).map(() => [null, null]);
        this.historyHeuristic = {};
        this.principalVariation = [];
        
        // Search statistics
        this.nodesSearched = 0;
        this.searchStartTime = 0;
        this.timeLimit = Infinity; // No time limit
        
        // Null move pruning
        this.allowNullMove = true;
        
        // Opening book
        this.openingBook = typeof MASTER_OPENING_BOOK !== 'undefined' ? MASTER_OPENING_BOOK : null;
    }

    /**
     * Main entry point - calculate the best move
     */
    async calculateMove(chess, onProgress) {
        this.searchStartTime = Date.now();
        this.nodesSearched = 0;
        this.transpositionTable.clear();
        this.lastYieldNodes = 0;
        this.yieldInterval = 50; // Yield every 50 nodes
        
        // Try opening book first
        const bookMove = this.getBookMove(chess);
        if (bookMove) {
            return bookMove;
        }
        
        // Iterative deepening search with aspiration windows
        let bestMove = null;
        let previousScore = 0;
        const depth = this.getSearchDepth();
        
        for (let currentDepth = 1; currentDepth <= depth; currentDepth++) {
            if (this.isOutOfTime()) break;
            
            // Aspiration windows - narrow the search window for efficiency
            let alpha = -Infinity;
            let beta = Infinity;
            
            if (currentDepth >= 3) {
                const window = 50;
                alpha = previousScore - window;
                beta = previousScore + window;
            }
            
            // Save position to verify it doesn't change
            const positionBefore = chess.fen();
            
            const result = this.searchRoot(chess, currentDepth, alpha, beta);
            
            // Verify position unchanged (safety check)
            const positionAfter = chess.fen();
            if (positionBefore !== positionAfter) {
                // Position changed during search - restore it
                chess.load(positionBefore);
            }
            
            if (result && result.move) {
                bestMove = result.move;
                previousScore = result.score;
            }
            
            if (onProgress) {
                onProgress({
                    depth: currentDepth,
                    nodes: this.nodesSearched,
                    time: Date.now() - this.searchStartTime,
                    score: previousScore
                });
            }
        }
        
        const finalMove = bestMove || this.getRandomMove(chess);
        
        if (!finalMove) {
            console.error('❌ ERROR: Bot failed to find any move!');
            console.log('Available moves:', chess.moves({ verbose: true }));
        }
        
        return finalMove;
    }

    /**
     * Root search - finds the best move at the root position
     */
    searchRoot(chess, depth, alpha = -Infinity, beta = Infinity) {
        const moves = chess.moves({ verbose: true });
        
        if (moves.length === 0) return null;

        // Order moves for better pruning (use PV move if available)
        const orderedMoves = this.orderMoves(chess, moves, 0);
        
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of orderedMoves) {
            if (this.isOutOfTime()) break;
            
            chess.move(move);
            const score = -this.negamax(chess, depth - 1, -beta, -alpha, 0, false);
            chess.undo();
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
                
                // Update principal variation
                this.principalVariation[0] = move;
            }
            
            alpha = Math.max(alpha, score);
            
            // Beta cutoff
            if (alpha >= beta) {
                break;
            }
        }
        
        return { move: bestMove, score: bestScore };
    }

    /**
     * Negamax search with alpha-beta pruning + Null Move Pruning
     * This is Sebastian Lague's core search algorithm with enhancements
     */
    negamax(chess, depth, alpha, beta, ply, allowNull = true) {
        this.nodesSearched++;
        
        // Check time limit less frequently for better performance
        if (this.nodesSearched % 8192 === 0 && this.isOutOfTime()) {
            return 0;
        }
        
        // Check transposition table (use FEN as key, but only board + turn)
        const positionKey = chess.fen().split(' ').slice(0, 2).join(' '); // Only position + turn (faster)
        const ttEntry = this.transpositionTable.get(positionKey);
        if (ttEntry && ttEntry.depth >= depth) {
            return ttEntry.score;
        }
        
        // Limit transposition table size (increased for better hit rate)
        if (this.transpositionTable.size > 200000) {
            // Clear oldest 25% of entries
            const keysToDelete = Array.from(this.transpositionTable.keys()).slice(0, 50000);
            keysToDelete.forEach(key => this.transpositionTable.delete(key));
        }
        
        // Base case: leaf node or game over
        if (depth === 0) {
            return this.quiescenceSearch(chess, alpha, beta, 0);
        }
        
        if (chess.game_over()) {
            if (chess.in_checkmate()) {
                return -100000 + ply; // Prefer faster checkmates
            }
            return 0; // Draw
        }
        
        const moves = chess.moves({ verbose: true });
        if (moves.length === 0) return 0;
        
        const inCheck = chess.in_check();
        
        // Null Move Pruning - major speedup for non-check positions
        if (allowNull && !inCheck && depth >= 3) {
            const R = 2; // Reduction factor
            
            // Make a "null move" - pass the turn to opponent
            const originalFen = chess.fen(); // Save original position
            const nullFen = this.makeNullMove(chess);
            if (nullFen) {
                try {
                    chess.load(nullFen);
                    const nullScore = -this.negamax(chess, depth - 1 - R, -beta, -beta + 1, ply + 1, false);
                    
                    if (nullScore >= beta) {
                        // Position is so good we can return immediately
                        return beta;
                    }
                } finally {
                    // ALWAYS restore original position
                    chess.load(originalFen);
                }
            }
        }
        
        // Futility Pruning - skip moves in shallow positions that can't improve alpha
        let futilityPruning = false;
        if (!inCheck && depth <= 3) {
            const staticEval = this.evaluate(chess);
            const futilityMargin = [0, 200, 350, 500][depth]; // Margins per depth
            
            if (staticEval + futilityMargin <= alpha) {
                futilityPruning = true; // Can only search forcing moves
            }
        }
        
        // Order moves for better alpha-beta pruning
        const orderedMoves = this.orderMoves(chess, moves, ply);
        
        let bestScore = -Infinity;
        let searchedMoves = 0;
        
        for (const move of orderedMoves) {
            // Apply futility pruning - skip quiet moves in hopeless positions
            if (futilityPruning && !move.captured && !move.promotion) {
                continue; // Skip this move
            }
            // Search extensions - Sebastian Lague's technique
            let extension = 0;
            if (chess.in_check()) {
                extension = 1; // Always extend in check
            } else if (move.promotion) {
                extension = 1; // Always extend promotions
            }
            
            chess.move(move);
            let score;
            
            try {
                // Late Move Reduction (LMR)
                if (searchedMoves > 3 && depth > 2 && !move.captured && !move.promotion && !inCheck && extension === 0) {
                    // Search with reduced depth
                    score = -this.negamax(chess, depth - 2, -beta, -alpha, ply + 1, true);
                    
                    // Re-search if it looks promising
                    if (score > alpha) {
                        score = -this.negamax(chess, depth - 1 + extension, -beta, -alpha, ply + 1, true);
                    }
                } else {
                    score = -this.negamax(chess, depth - 1 + extension, -beta, -alpha, ply + 1, true);
                }
            } finally {
                // ALWAYS undo the move, even if there's an error
                chess.undo();
            }
            
            searchedMoves++;
            
            if (score >= beta) {
                // Beta cutoff - store killer move
                this.storeKillerMove(move, ply);
                this.transpositionTable.set(positionKey, { score: beta, depth });
                return beta;
            }
            
                if (score > bestScore) {
                    bestScore = score;
                if (score > alpha) {
                    alpha = score;
                    // Update history heuristic
                    this.updateHistory(move, depth);
                }
            }
        }
        
        // Store in transposition table
        this.transpositionTable.set(positionKey, { score: bestScore, depth });
        
        return bestScore;
    }

    /**
     * Quiescence Search - only search "quiet" positions (OPTIMIZED)
     * Prevents horizon effect by searching all captures
     */
    quiescenceSearch(chess, alpha, beta, depth) {
        this.nodesSearched++;
        
        // Reduce max quiescence depth for speed
        if (depth > 4) {
            return this.evaluate(chess);
        }
        
        const standPat = this.evaluate(chess);
        
        if (standPat >= beta) {
            return beta;
        }
        if (alpha < standPat) {
            alpha = standPat;
        }
        
        // Only search captures (skip check extension in qsearch for speed)
        const inCheck = chess.in_check();
        const moves = inCheck ? chess.moves({ verbose: true }) : chess.moves({ verbose: true }).filter(m => m.captured);
        
        // Order captures by MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
        moves.sort((a, b) => {
            const aValue = (a.captured ? this.getPieceValue(a.captured) : 0) - this.getPieceValue(a.piece);
            const bValue = (b.captured ? this.getPieceValue(b.captured) : 0) - this.getPieceValue(b.piece);
            return bValue - aValue;
        });
        
        for (const move of moves) {
            // Delta pruning - skip captures that can't improve position
            if (!inCheck && move.captured) {
                const captureValue = this.getPieceValue(move.captured);
                if (standPat + captureValue + 200 < alpha) {
                    continue;
                }
            }
            
            chess.move(move);
            const score = -this.quiescenceSearch(chess, -beta, -alpha, depth + 1);
            chess.undo();
            
            if (score >= beta) {
                return beta;
            }
            if (score > alpha) {
                alpha = score;
            }
        }
        
        return alpha;
    }

    /**
     * Move Ordering - crucial for alpha-beta pruning efficiency
     * Sebastian Lague's move ordering: PV > Captures (MVV-LVA) > Killers > History
     */
    orderMoves(chess, moves, ply) {
        const scoredMoves = moves.map(move => {
        let score = 0;
        
            // 0. Principal Variation move (highest priority)
            if (ply < this.principalVariation.length && this.movesEqual(move, this.principalVariation[ply])) {
                score += 20000;
            }
            
            // 1. Captures - MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
            if (move.captured) {
                score += 10000 + this.getPieceValue(move.captured) * 10 - this.getPieceValue(move.piece);
            }
            
            // 2. Promotions
            if (move.promotion) {
                score += 9000 + this.getPieceValue(move.promotion);
            }
            
            // 3. Killer moves
            const killers = this.killerMoves[ply] || [null, null];
            if (killers[0] && this.movesEqual(move, killers[0])) {
                score += 8000;
            } else if (killers[1] && this.movesEqual(move, killers[1])) {
                score += 7000;
            }
            
            // 4. History heuristic
            const historyKey = this.getMoveKey(move);
            score += (this.historyHeuristic[historyKey] || 0);
            
            // 5. Penalize moving into attacked squares (OPTIMIZED - skip for speed)
            // This check is expensive, and move ordering is already good enough
            // The search will naturally prune bad moves anyway
            
            return { move, score };
        });
        
        scoredMoves.sort((a, b) => b.score - a.score);
        return scoredMoves.map(sm => sm.move);
    }

    /**
     * Evaluation Function - Enhanced with mobility, king safety, pawn structure
     * Material + Piece-Square Tables + Positional factors
     */
    evaluate(chess) {
        if (chess.in_checkmate()) {
            return chess.turn() === 'w' ? -100000 : 100000;
        }
        if (chess.in_draw() || chess.in_stalemate() || chess.in_threefold_repetition()) {
            return 0;
        }
        
        const board = chess.board();
        let score = 0;
        let pieceCount = 0;
        
        // Single loop: material + piece-square tables
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (piece) {
                    pieceCount++;
                    const pieceValue = this.getPieceValue(piece.type);
                    const isEndgame = pieceCount <= 10; // Quick approximation
                    const tableValue = this.getPieceSquareValue(piece.type, piece.color, rank, file, isEndgame);
                    const totalValue = pieceValue + tableValue;
                    
                    score += piece.color === 'w' ? totalValue : -totalValue;
                }
            }
        }
        
        // Simplified mobility - just count our moves (very fast)
        score += chess.moves().length * 5;
        
        // Perspective: positive is good for white, negative for black
        return chess.turn() === 'w' ? score : -score;
    }

    /**
     * Evaluate mobility - reward having more legal moves (OPTIMIZED)
     * Only count moves without generating full move objects for speed
     */
    evaluateMobility(chess) {
        // Use cached move count from current position
        const currentMoves = chess.moves().length;
        
        // Simple approximation: just use our mobility, don't calculate opponent's
        // This is much faster and still provides good positional understanding
        const mobilityScore = currentMoves * 5; // Reduced weight for speed
        
        return chess.turn() === 'w' ? mobilityScore : -mobilityScore;
    }

    /**
     * Evaluate king safety - penalize exposed kings
     */
    evaluateKingSafety(chess, board) {
        let score = 0;
        
        // Find kings
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (piece && piece.type === 'k') {
                    const safety = this.getKingSafety(board, rank, file, piece.color);
                    score += piece.color === 'w' ? safety : -safety;
                }
            }
        }
        
        return score;
    }

    /**
     * Get king safety score for a specific king
     */
    getKingSafety(board, kingRank, kingFile, color) {
        let safety = 0;
        
        // Reward pawns in front of king
        const direction = color === 'w' ? -1 : 1;
        for (let file = Math.max(0, kingFile - 1); file <= Math.min(7, kingFile + 1); file++) {
            const checkRank = kingRank + direction;
            if (checkRank >= 0 && checkRank < 8) {
                const piece = board[checkRank][file];
                if (piece && piece.type === 'p' && piece.color === color) {
                    safety += 30; // Pawn shield
                }
            }
        }
        
        // Penalize king in center during middlegame
        if (kingFile >= 2 && kingFile <= 5) {
            safety -= 20;
        }
        
        return safety;
    }

    /**
     * Evaluate pawn structure - reward good pawn formations
     */
    evaluatePawnStructure(chess, board) {
        let score = 0;
        
        // Count pawns per file for both colors
        const whitePawns = Array(8).fill(0);
        const blackPawns = Array(8).fill(0);
        
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (piece && piece.type === 'p') {
                    if (piece.color === 'w') {
                        whitePawns[file]++;
                    } else {
                        blackPawns[file]++;
                    }
                }
            }
        }
        
        // Penalize doubled pawns
        for (let file = 0; file < 8; file++) {
            if (whitePawns[file] > 1) score -= (whitePawns[file] - 1) * 20;
            if (blackPawns[file] > 1) score += (blackPawns[file] - 1) * 20;
        }
        
        // Penalize isolated pawns
        for (let file = 0; file < 8; file++) {
            const leftFile = file > 0 ? file - 1 : -1;
            const rightFile = file < 7 ? file + 1 : -1;
            
            if (whitePawns[file] > 0) {
                const hasSupport = (leftFile >= 0 && whitePawns[leftFile] > 0) || 
                                 (rightFile >= 0 && whitePawns[rightFile] > 0);
                if (!hasSupport) score -= 15;
            }
            
            if (blackPawns[file] > 0) {
                const hasSupport = (leftFile >= 0 && blackPawns[leftFile] > 0) || 
                                 (rightFile >= 0 && blackPawns[rightFile] > 0);
                if (!hasSupport) score += 15;
            }
        }
        
        return score;
    }

    /**
     * Piece Values - Standard chess piece values
     */
    getPieceValue(piece) {
        const values = {
            'p': 100,
            'n': 320,
            'b': 330,
            'r': 500,
            'q': 900,
            'k': 20000
        };
        return values[piece] || 0;
    }

    /**
     * Piece-Square Tables - Sebastian Lague's positional evaluation
     * Encourages pieces to occupy good squares
     * Uses separate endgame tables for king
     */
    getPieceSquareValue(piece, color, rank, file, isEndgame = false) {
        // Flip rank for black pieces
        const r = color === 'w' ? 7 - rank : rank;
        
        const tables = {
            'p': [ // Pawns
                0,  0,  0,  0,  0,  0,  0,  0,
                50, 50, 50, 50, 50, 50, 50, 50,
                10, 10, 20, 30, 30, 20, 10, 10,
                5,  5, 10, 25, 25, 10,  5,  5,
                0,  0,  0, 20, 20,  0,  0,  0,
                5, -5,-10,  0,  0,-10, -5,  5,
                5, 10, 10,-20,-20, 10, 10,  5,
                0,  0,  0,  0,  0,  0,  0,  0
            ],
            'n': [ // Knights
                -50,-40,-30,-30,-30,-30,-40,-50,
                -40,-20,  0,  0,  0,  0,-20,-40,
                -30,  0, 10, 15, 15, 10,  0,-30,
                -30,  5, 15, 20, 20, 15,  5,-30,
                -30,  0, 15, 20, 20, 15,  0,-30,
                -30,  5, 10, 15, 15, 10,  5,-30,
                -40,-20,  0,  5,  5,  0,-20,-40,
                -50,-40,-30,-30,-30,-30,-40,-50
            ],
            'b': [ // Bishops
                -20,-10,-10,-10,-10,-10,-10,-20,
                -10,  0,  0,  0,  0,  0,  0,-10,
                -10,  0,  5, 10, 10,  5,  0,-10,
                -10,  5,  5, 10, 10,  5,  5,-10,
                -10,  0, 10, 10, 10, 10,  0,-10,
                -10, 10, 10, 10, 10, 10, 10,-10,
                -10,  5,  0,  0,  0,  0,  5,-10,
                -20,-10,-10,-10,-10,-10,-10,-20
            ],
            'r': [ // Rooks
                0,  0,  0,  0,  0,  0,  0,  0,
                5, 10, 10, 10, 10, 10, 10,  5,
                -5,  0,  0,  0,  0,  0,  0, -5,
                -5,  0,  0,  0,  0,  0,  0, -5,
                -5,  0,  0,  0,  0,  0,  0, -5,
                -5,  0,  0,  0,  0,  0,  0, -5,
                -5,  0,  0,  0,  0,  0,  0, -5,
                0,  0,  0,  5,  5,  0,  0,  0
            ],
            'q': [ // Queen
                -20,-10,-10, -5, -5,-10,-10,-20,
                -10,  0,  0,  0,  0,  0,  0,-10,
                -10,  0,  5,  5,  5,  5,  0,-10,
                -5,  0,  5,  5,  5,  5,  0, -5,
                0,  0,  5,  5,  5,  5,  0, -5,
                -10,  5,  5,  5,  5,  5,  0,-10,
                -10,  0,  5,  0,  0,  0,  0,-10,
                -20,-10,-10, -5, -5,-10,-10,-20
            ],
            'k': [ // King (middlegame)
                -30,-40,-40,-50,-50,-40,-40,-30,
                -30,-40,-40,-50,-50,-40,-40,-30,
                -30,-40,-40,-50,-50,-40,-40,-30,
                -30,-40,-40,-50,-50,-40,-40,-30,
                -20,-30,-30,-40,-40,-30,-30,-20,
                -10,-20,-20,-20,-20,-20,-20,-10,
                20, 20,  0,  0,  0,  0, 20, 20,
                20, 30, 10,  0,  0, 10, 30, 20
            ]
        };
        
        const endgameTables = {
            'k': [ // King (endgame) - encourage centralization and activity
                -50,-40,-30,-20,-20,-30,-40,-50,
                -30,-20,-10,  0,  0,-10,-20,-30,
                -30,-10, 20, 30, 30, 20,-10,-30,
                -30,-10, 30, 40, 40, 30,-10,-30,
                -30,-10, 30, 40, 40, 30,-10,-30,
                -30,-10, 20, 30, 30, 20,-10,-30,
                -30,-30,  0,  0,  0,  0,-30,-30,
                -50,-30,-30,-30,-30,-30,-30,-50
            ]
        };
        
        // Use endgame table for king in endgame
        let table;
        if (isEndgame && piece === 'k' && endgameTables[piece]) {
            table = endgameTables[piece];
                        } else {
            table = tables[piece];
        }
        
        if (!table) return 0;
        
        const index = r * 8 + file;
        return table[index] || 0;
    }

    /**
     * Helper: Check if a square is attacked
     */
    isSquareAttacked(chess, square, byColor) {
        const moves = chess.moves({ verbose: true });
        return moves.some(m => m.to === square);
    }

    /**
     * Helper: Store killer move for move ordering
     */
    storeKillerMove(move, ply) {
        if (ply >= this.killerMoves.length) return;
        
        const killers = this.killerMoves[ply];
        if (!this.movesEqual(move, killers[0])) {
            killers[1] = killers[0];
            killers[0] = move;
        }
    }

    /**
     * Helper: Update history heuristic
     */
    updateHistory(move, depth) {
        const key = this.getMoveKey(move);
        this.historyHeuristic[key] = (this.historyHeuristic[key] || 0) + depth * depth;
    }

    /**
     * Helper: Get move key for history table
     */
    getMoveKey(move) {
        return `${move.from}${move.to}${move.promotion || ''}`;
    }

    /**
     * Helper: Compare two moves
     */
    movesEqual(move1, move2) {
        if (!move1 || !move2) return false;
        return move1.from === move2.from && 
               move1.to === move2.to && 
               move1.promotion === move2.promotion;
    }

    /**
     * Helper: Make a null move (pass turn to opponent)
     */
    makeNullMove(chess) {
        const parts = chess.fen().split(' ');
        if (parts.length < 6) return null;
        
        // Switch turn
        parts[1] = parts[1] === 'w' ? 'b' : 'w';
        // Reset en passant
        parts[3] = '-';
        
        return parts.join(' ');
    }

    /**
     * Opening Book - use master games for opening moves
     */
    getBookMove(chess) {
        if (!this.openingBook) return null;
        
        const history = chess.history();
        if (history.length > 12) return null; // Only use book for first 12 moves
        
        const moveSequence = history.join(' ');
        const bookMoves = chess.turn() === 'w' ? this.openingBook.white : this.openingBook.black;
        
        // Find matching sequences
        const candidates = bookMoves.filter(seq => seq.startsWith(moveSequence));
        if (candidates.length === 0) return null;
        
        // Get the next move from a random candidate
        const randomSeq = candidates[Math.floor(Math.random() * candidates.length)];
        const moves = randomSeq.split(' ');
        const nextMoveSAN = moves[history.length];
        
        if (!nextMoveSAN) return null;
        
        // Find the move object that matches this SAN
        const legalMoves = chess.moves({ verbose: true });
        for (const move of legalMoves) {
            const testChess = new Chess(chess.fen());
            const result = testChess.move(move);
            if (result && testChess.history({ verbose: false }).pop() === nextMoveSAN) {
                return move;
            }
        }
        
        return null;
    }

    /**
     * Helper: Get search depth based on difficulty
     */
    getSearchDepth() {
        const depths = {
            'easy': 2,
            'medium': 4,
            'hard': 5
        };
        return depths[this.difficulty] || 4;
    }

    /**
     * Helper: Check if out of time
     */
    isOutOfTime() {
        return Date.now() - this.searchStartTime >= this.timeLimit;
    }

    /**
     * Fallback: Get random move
     */
    getRandomMove(chess) {
        const moves = chess.moves({ verbose: true });
        return moves[Math.floor(Math.random() * moves.length)];
    }
}

// Export for use in main game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MartinaBot;
}

