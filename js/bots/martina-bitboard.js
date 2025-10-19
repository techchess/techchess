/**
 * Martina Chess Bot - BITBOARD VERSION (Ultra-Fast)
 * Based on Sebastian Lague's methods with bitboard move generation
 * 10-50x faster than Chess.js version
 */

class MartinaBitboardBot {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.name = 'Martina (Bitboard)';
        
        // Bitboard engine
        this.board = new BitboardAdapter();
        
        // Transposition table
        this.transpositionTable = new Map();
        
        // Move ordering helpers
        this.killerMoves = Array(64).fill(null).map(() => [null, null]);
        this.historyHeuristic = {};
        this.principalVariation = [];
        
        // Search statistics
        this.nodesSearched = 0;
        this.searchStartTime = 0;
        this.timeLimit = Infinity;
        
        // Null move pruning
        this.allowNullMove = true;
        
        // Opening book
        this.openingBook = typeof MASTER_OPENING_BOOK !== 'undefined' ? MASTER_OPENING_BOOK : null;
        
        // Piece values
        this.pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
        
        // Initialize piece-square tables
        this.initializePieceSquareTables();
    }
    
    /**
     * Main entry point - calculate the best move (Chess.js compatible interface)
     */
    async calculateMove(chess, onProgress) {
        this.searchStartTime = Date.now();
        this.nodesSearched = 0;
        this.transpositionTable.clear();
        
        // Load position into bitboard engine
        this.board.loadFEN(chess.fen());
        
        // Try opening book first
        const bookMove = this.getBookMove(chess);
        if (bookMove) {
            return bookMove;
        }
        
        // Iterative deepening search
        let bestMove = null;
        let previousScore = 0;
        const depth = this.getSearchDepth();
        
        for (let currentDepth = 1; currentDepth <= depth; currentDepth++) {
            if (this.isOutOfTime()) break;
            
            // Aspiration windows
            let alpha = -Infinity;
            let beta = Infinity;
            
            if (currentDepth >= 3) {
                const window = 50;
                alpha = previousScore - window;
                beta = previousScore + window;
            }
            
            const result = this.searchRoot(currentDepth, alpha, beta);
            
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
        
        // Convert bitboard move to Chess.js format
        if (bestMove) {
            return {
                from: this.board.engine.squareToAlgebraic(bestMove.from),
                to: this.board.engine.squareToAlgebraic(bestMove.to),
                promotion: bestMove.promotion
            };
        }
        
        // Fallback: return first legal move
        const moves = this.board.getMoves();
        return moves.length > 0 ? { from: moves[0].from, to: moves[0].to } : null;
    }
    
    /**
     * Search root node
     */
    searchRoot(depth, alpha = -Infinity, beta = Infinity) {
        const moves = this.board.engine.generateMoves();
        
        if (moves.length === 0) return null;
        
        // Order moves
        const orderedMoves = this.orderMoves(moves, 0);
        
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of orderedMoves) {
            if (this.isOutOfTime()) break;
            
            this.board.engine.makeMove(move);
            const score = -this.negamax(depth - 1, -beta, -alpha, 0, false);
            this.board.engine.unmakeMove();
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
            
            alpha = Math.max(alpha, score);
            if (alpha >= beta) break;
        }
        
        return { move: bestMove, score: bestScore };
    }
    
    /**
     * Negamax search with alpha-beta pruning
     */
    negamax(depth, alpha, beta, ply, allowNull) {
        this.nodesSearched++;
        
        // Check time limit occasionally
        if (this.nodesSearched % 8192 === 0 && this.isOutOfTime()) {
            return 0;
        }
        
        // Check transposition table
        const positionKey = this.board.getFEN().split(' ').slice(0, 2).join(' ');
        const ttEntry = this.transpositionTable.get(positionKey);
        if (ttEntry && ttEntry.depth >= depth) {
            return ttEntry.score;
        }
        
        // Limit transposition table size
        if (this.transpositionTable.size > 200000) {
            const keysToDelete = Array.from(this.transpositionTable.keys()).slice(0, 50000);
            keysToDelete.forEach(key => this.transpositionTable.delete(key));
        }
        
        // Base case: leaf node or game over
        if (depth === 0) {
            return this.quiescenceSearch(alpha, beta, 0);
        }
        
        if (this.board.gameOver()) {
            if (this.board.inCheckmate()) {
                return -100000 + ply;
            }
            return 0;
        }
        
        const moves = this.board.engine.generateMoves();
        if (moves.length === 0) return 0;
        
        const inCheck = this.board.inCheck();
        
        // Null move pruning
        if (allowNull && !inCheck && depth >= 3 && this.allowNullMove) {
            const originalFEN = this.board.getFEN();
            const parts = originalFEN.split(' ');
            parts[1] = parts[1] === 'w' ? 'b' : 'w'; // Switch turn
            const nullFEN = parts.join(' ');
            
            try {
                this.board.loadFEN(nullFEN);
                const nullScore = -this.negamax(depth - 3, -beta, -beta + 1, ply + 1, false);
                this.board.loadFEN(originalFEN);
                
                if (nullScore >= beta) {
                    return beta;
                }
            } finally {
                this.board.loadFEN(originalFEN);
            }
        }
        
        // Order moves
        const orderedMoves = this.orderMoves(moves, ply);
        
        let bestScore = -Infinity;
        let moveIndex = 0;
        
        for (const move of orderedMoves) {
            // Search extensions
            let extension = 0;
            if (inCheck) {
                extension = 1;
            } else if (move.promotion) {
                extension = 1;
            }
            
            this.board.engine.makeMove(move);
            let score;
            
            try {
                // Late move reduction
                if (moveIndex >= 4 && depth >= 3 && !inCheck && !move.captured && !move.promotion) {
                    score = -this.negamax(depth - 2, -alpha - 1, -alpha, ply + 1, true);
                    if (score > alpha) {
                        score = -this.negamax(depth - 1 + extension, -beta, -alpha, ply + 1, true);
                    }
                } else {
                    score = -this.negamax(depth - 1 + extension, -beta, -alpha, ply + 1, true);
                }
            } finally {
                this.board.engine.unmakeMove();
            }
            
            bestScore = Math.max(bestScore, score);
            alpha = Math.max(alpha, score);
            
            if (alpha >= beta) {
                // Killer move
                if (!move.captured) {
                    this.killerMoves[ply][1] = this.killerMoves[ply][0];
                    this.killerMoves[ply][0] = move;
                }
                break;
            }
            
            moveIndex++;
        }
        
        // Store in transposition table
        this.transpositionTable.set(positionKey, { score: bestScore, depth });
        
        return bestScore;
    }
    
    /**
     * Quiescence search - only search captures
     */
    quiescenceSearch(alpha, beta, depth) {
        this.nodesSearched++;
        
        if (depth > 4) {
            return this.evaluate();
        }
        
        const standPat = this.evaluate();
        
        if (standPat >= beta) {
            return beta;
        }
        
        alpha = Math.max(alpha, standPat);
        
        // Delta pruning
        const BIG_DELTA = 975; // Queen value + pawn
        if (standPat < alpha - BIG_DELTA) {
            return alpha;
        }
        
        // Only search captures (skip full legality check for speed in qsearch)
        const captures = this.board.engine.generateMoves(true, true);
        
        // Manual legality check only for captures (faster)
        const legalCaptures = [];
        for (const move of captures) {
            this.board.engine.makeMove(move);
            if (!this.board.engine.inCheck()) {
                legalCaptures.push(move);
            }
            this.board.engine.unmakeMove();
        }
        
        const orderedCaptures = this.orderCaptures(legalCaptures);
        
        for (const move of orderedCaptures) {
            this.board.engine.makeMove(move);
            const score = -this.quiescenceSearch(-beta, -alpha, depth + 1);
            this.board.engine.unmakeMove();
            
            if (score >= beta) {
                return beta;
            }
            alpha = Math.max(alpha, score);
        }
        
        return alpha;
    }
    
    /**
     * Evaluation function - fast bitboard version
     */
    evaluate() {
        if (this.board.inCheckmate()) {
            return this.board.turn() === 'w' ? -100000 : 100000;
        }
        if (this.board.inDraw() || this.board.inStalemate()) {
            return 0;
        }
        
        const engine = this.board.engine;
        let score = 0;
        
        // Material count using bitboard popCount (super fast!)
        const material = engine.getMaterialCount();
        score = material.white - material.black;
        
        // Piece-square tables
        const pieceCount = engine.popCount(engine.allPieces);
        const isEndgame = pieceCount <= 10;
        
        // White pieces
        let bb = engine.whitePawns;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score += this.getPieceSquareValue('p', 'w', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.whiteKnights;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score += this.getPieceSquareValue('n', 'w', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.whiteBishops;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score += this.getPieceSquareValue('b', 'w', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.whiteRooks;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score += this.getPieceSquareValue('r', 'w', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.whiteQueens;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score += this.getPieceSquareValue('q', 'w', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.whiteKing;
        const whiteKingSquare = engine.bitScanForward(bb);
        score += this.getPieceSquareValue('k', 'w', Math.floor(whiteKingSquare / 8), whiteKingSquare % 8, isEndgame);
        
        // Black pieces
        bb = engine.blackPawns;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score -= this.getPieceSquareValue('p', 'b', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.blackKnights;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score -= this.getPieceSquareValue('n', 'b', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.blackBishops;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score -= this.getPieceSquareValue('b', 'b', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.blackRooks;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score -= this.getPieceSquareValue('r', 'b', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.blackQueens;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score -= this.getPieceSquareValue('q', 'b', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.blackKing;
        const blackKingSquare = engine.bitScanForward(bb);
        score -= this.getPieceSquareValue('k', 'b', Math.floor(blackKingSquare / 8), blackKingSquare % 8, isEndgame);
        
        // Simplified mobility
        score += this.board.getMoves().length * 5;
        
        // Perspective: positive is good for white, negative for black
        return this.board.turn() === 'w' ? score : -score;
    }
    
    /**
     * Move ordering
     */
    orderMoves(moves, ply) {
        const scoredMoves = moves.map(move => {
            let score = 0;
            
            // PV move (highest priority)
            if (this.principalVariation[0] && 
                move.from === this.principalVariation[0].from && 
                move.to === this.principalVariation[0].to) {
                score = 10000000;
            }
            
            // MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
            if (move.captured) {
                score = 1000000 + this.pieceValues[move.captured] * 10 - this.pieceValues[move.piece];
            }
            
            // Promotions
            if (move.promotion) {
                score += 900000;
            }
            
            // Killer moves
            if (this.killerMoves[ply][0] && 
                move.from === this.killerMoves[ply][0].from && 
                move.to === this.killerMoves[ply][0].to) {
                score = 800000;
            } else if (this.killerMoves[ply][1] && 
                       move.from === this.killerMoves[ply][1].from && 
                       move.to === this.killerMoves[ply][1].to) {
                score = 700000;
            }
            
            // History heuristic
            const moveKey = `${move.from}-${move.to}`;
            score += this.historyHeuristic[moveKey] || 0;
            
            return { move, score };
        });
        
        scoredMoves.sort((a, b) => b.score - a.score);
        return scoredMoves.map(sm => sm.move);
    }
    
    /**
     * Order captures by MVV-LVA
     */
    orderCaptures(captures) {
        return captures.sort((a, b) => {
            const scoreA = this.pieceValues[a.captured] * 10 - this.pieceValues[a.piece];
            const scoreB = this.pieceValues[b.captured] * 10 - this.pieceValues[b.piece];
            return scoreB - scoreA;
        });
    }
    
    /**
     * Get search depth based on difficulty
     */
    getSearchDepth() {
        const depths = { easy: 2, medium: 4, hard: 5 };
        return depths[this.difficulty] || 4;
    }
    
    /**
     * Check if out of time
     */
    isOutOfTime() {
        if (this.timeLimit === Infinity) return false;
        return (Date.now() - this.searchStartTime) >= this.timeLimit;
    }
    
    /**
     * Try to get move from opening book
     */
    getBookMove(chess) {
        if (!this.openingBook) return null;
        
        const history = chess.history();
        const movesSoFar = history.join(' ');
        const color = chess.turn();
        const bookLines = color === 'w' ? this.openingBook.white : this.openingBook.black;
        
        const matchingLines = bookLines.filter(line => line.startsWith(movesSoFar + ' '));
        
        if (matchingLines.length > 0) {
            const randomLine = matchingLines[Math.floor(Math.random() * matchingLines.length)];
            const nextMove = randomLine.split(' ')[history.length];
            
            if (nextMove) {
                const legalMoves = chess.moves({ verbose: true });
                for (const move of legalMoves) {
                    const testChess = new Chess(chess.fen());
                    const result = testChess.move(move);
                    if (result && testChess.history({ verbose: false }).pop() === nextMove) {
                        return { from: move.from, to: move.to, promotion: move.promotion };
                    }
                }
            }
        }
        
        return null;
    }
    
    // Include all piece-square tables from original Martina
    initializePieceSquareTables() {
        // [Copy all piece-square tables from original martina.js]
        // This is the same as before, just included here for completeness
        this.pawnTable = [
            0,  0,  0,  0,  0,  0,  0,  0,
            50, 50, 50, 50, 50, 50, 50, 50,
            10, 10, 20, 30, 30, 20, 10, 10,
            5,  5, 10, 25, 25, 10,  5,  5,
            0,  0,  0, 20, 20,  0,  0,  0,
            5, -5,-10,  0,  0,-10, -5,  5,
            5, 10, 10,-20,-20, 10, 10,  5,
            0,  0,  0,  0,  0,  0,  0,  0
        ];
        
        this.knightTable = [
            -50,-40,-30,-30,-30,-30,-40,-50,
            -40,-20,  0,  0,  0,  0,-20,-40,
            -30,  0, 10, 15, 15, 10,  0,-30,
            -30,  5, 15, 20, 20, 15,  5,-30,
            -30,  0, 15, 20, 20, 15,  0,-30,
            -30,  5, 10, 15, 15, 10,  5,-30,
            -40,-20,  0,  5,  5,  0,-20,-40,
            -50,-40,-30,-30,-30,-30,-40,-50
        ];
        
        this.bishopTable = [
            -20,-10,-10,-10,-10,-10,-10,-20,
            -10,  0,  0,  0,  0,  0,  0,-10,
            -10,  0,  5, 10, 10,  5,  0,-10,
            -10,  5,  5, 10, 10,  5,  5,-10,
            -10,  0, 10, 10, 10, 10,  0,-10,
            -10, 10, 10, 10, 10, 10, 10,-10,
            -10,  5,  0,  0,  0,  0,  5,-10,
            -20,-10,-10,-10,-10,-10,-10,-20
        ];
        
        this.rookTable = [
            0,  0,  0,  0,  0,  0,  0,  0,
            5, 10, 10, 10, 10, 10, 10,  5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            -5,  0,  0,  0,  0,  0,  0, -5,
            0,  0,  0,  5,  5,  0,  0,  0
        ];
        
        this.queenTable = [
            -20,-10,-10, -5, -5,-10,-10,-20,
            -10,  0,  0,  0,  0,  0,  0,-10,
            -10,  0,  5,  5,  5,  5,  0,-10,
            -5,  0,  5,  5,  5,  5,  0, -5,
            0,  0,  5,  5,  5,  5,  0, -5,
            -10,  5,  5,  5,  5,  5,  0,-10,
            -10,  0,  5,  0,  0,  0,  0,-10,
            -20,-10,-10, -5, -5,-10,-10,-20
        ];
        
        this.kingMiddleGameTable = [
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -30,-40,-40,-50,-50,-40,-40,-30,
            -20,-30,-30,-40,-40,-30,-30,-20,
            -10,-20,-20,-20,-20,-20,-20,-10,
            20, 20,  0,  0,  0,  0, 20, 20,
            20, 30, 10,  0,  0, 10, 30, 20
        ];
        
        this.kingEndGameTable = [
            -50,-40,-30,-20,-20,-30,-40,-50,
            -30,-20,-10,  0,  0,-10,-20,-30,
            -30,-10, 20, 30, 30, 20,-10,-30,
            -30,-10, 30, 40, 40, 30,-10,-30,
            -30,-10, 30, 40, 40, 30,-10,-30,
            -30,-10, 20, 30, 30, 20,-10,-30,
            -30,-30,  0,  0,  0,  0,-30,-30,
            -50,-30,-30,-30,-30,-30,-30,-50
        ];
    }
    
    getPieceSquareValue(piece, color, rank, file, isEndgame) {
        const tables = {
            'p': this.pawnTable,
            'n': this.knightTable,
            'b': this.bishopTable,
            'r': this.rookTable,
            'q': this.queenTable,
            'k': isEndgame ? this.kingEndGameTable : this.kingMiddleGameTable
        };
        
        const table = tables[piece];
        if (!table) return 0;
        
        const index = color === 'w' ? rank * 8 + file : (7 - rank) * 8 + file;
        return table[index] || 0;
    }
}

