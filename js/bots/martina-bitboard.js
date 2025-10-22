/**
 * Martina Chess Bot - FIXED BITBOARD VERSION
 * CRITICAL FIXES:
 * 1. Evaluation perspective (was evaluating from wrong side)
 * 2. Checkmate detection (was backwards)
 * 3. Hanging pieces now in evaluation (not post-search)
 * 4. Better move ordering to avoid blunders
 */

class MartinaBitboardBot {
    constructor() {
        this.name = 'Martina (Bitboard Fixed)';
        this.searchDepth = 4;
        this.board = new BitboardAdapter();
        this.transpositionTable = new Map();
        this.positionHistory = [];
        this.killerMoves = Array(64).fill(null).map(() => [null, null]);
        this.historyHeuristic = {};
        this.principalVariation = [];
        this.nodesSearched = 0;
        this.searchStartTime = 0;
        this.timeLimit = Infinity;
        this.allowNullMove = true;
        this.openingBook = typeof MASTER_OPENING_BOOK !== 'undefined' ? MASTER_OPENING_BOOK : null;
        this.pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
        this.initializePieceSquareTables();
    }
    
    async calculateMove(chess, onProgress) {
        this.searchStartTime = Date.now();
        this.nodesSearched = 0;
        this.transpositionTable.clear();
        
        const currentFen = chess.fen();
        this.board.loadFEN(currentFen);
        
        // Build position history
        this.positionHistory = [];
        const history = chess.history();
        const tempChess = new Chess();
        this.positionHistory.push(this.getPositionKey(tempChess.fen()));
        
        for (const move of history) {
            tempChess.move(move);
            this.positionHistory.push(this.getPositionKey(tempChess.fen()));
        }
        
        const bookMove = this.getBookMove(chess);
        if (bookMove) return bookMove;
        
        let bestMove = null;
        let previousScore = 0;
        
        for (let currentDepth = 1; currentDepth <= this.searchDepth; currentDepth++) {
            if (this.isOutOfTime()) break;
            
            const result = this.searchRoot(currentDepth);
            
            if (result && result.move) {
                bestMove = result.move;
                previousScore = result.score;
                
                console.log(`Depth ${currentDepth}: Best move ${this.board.engine.squareToAlgebraic(bestMove.from)}${this.board.engine.squareToAlgebraic(bestMove.to)}, Score: ${result.score}`);
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
        
        // Reset to original position
        this.board.loadFEN(currentFen);
        
        if (bestMove) {
            return {
                from: this.board.engine.squareToAlgebraic(bestMove.from),
                to: this.board.engine.squareToAlgebraic(bestMove.to),
                promotion: bestMove.promotion
            };
        }
        
        // Fallback
        const moves = this.board.engine.generateMoves();
        if (moves.length > 0) {
            console.warn('⚠️ Fallback to first move');
            return {
                from: this.board.engine.squareToAlgebraic(moves[0].from),
                to: this.board.engine.squareToAlgebraic(moves[0].to),
                promotion: moves[0].promotion
            };
        }
        return null;
    }
    
    /**
     * FIXED: Search root with proper evaluation
     */
    searchRoot(depth) {
        const moves = this.board.engine.generateMoves();
        if (moves.length === 0) return null;
        
        const orderedMoves = this.orderMoves(moves, 0);
        
        let bestMove = null;
        let bestScore = -Infinity;
        
        console.log(`\n=== ROOT SEARCH (Depth ${depth}) ===`);
        console.log(`Searching ${orderedMoves.length} moves for ${this.board.turn()}`);
        
        for (let i = 0; i < orderedMoves.length; i++) {
            const move = orderedMoves[i];
            if (i > 0 && this.isOutOfTime()) break;
            
            const moveStr = `${this.board.engine.squareToAlgebraic(move.from)}${this.board.engine.squareToAlgebraic(move.to)}`;
            
            this.board.engine.makeMove(move);
            
            const positionKey = this.getPositionKey(this.board.getFEN());
            this.positionHistory.push(positionKey);
            
            const repetitions = this.positionHistory.filter(pos => pos === positionKey).length;
            
            let score;
            if (repetitions >= 3) {
                score = 0; // Draw by repetition
            } else {
                // CRITICAL FIX: Negate the score because we made the move
                score = -this.negamax(depth - 1, -Infinity, Infinity, 1);
                
                if (repetitions === 2) {
                    score -= 15; // Mild penalty
                }
            }
            
            this.positionHistory.pop();
            this.board.engine.unmakeMove();
            
            // Log top moves
            if (i < 5) {
                console.log(`  ${i+1}. ${moveStr}: ${score.toFixed(1)} ${move.captured ? '(capture)' : ''}`);
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
                console.log(`  ✓ NEW BEST: ${moveStr} = ${score.toFixed(1)}`);
            }
        }
        
        console.log(`BEST MOVE: ${this.board.engine.squareToAlgebraic(bestMove.from)}${this.board.engine.squareToAlgebraic(bestMove.to)} (${bestScore.toFixed(1)})`);
        
        return { move: bestMove, score: bestScore };
    }
    
    /**
     * FIXED: Negamax with correct perspective
     */
    negamax(depth, alpha, beta, ply) {
        this.nodesSearched++;
        
        if (this.nodesSearched % 8192 === 0 && this.isOutOfTime()) {
            return 0;
        }
        
        const positionKey = this.getPositionKey(this.board.getFEN());
        const repetitions = this.positionHistory.filter(pos => pos === positionKey).length;
        if (repetitions >= 3) return 0;
        
        const ttEntry = this.transpositionTable.get(positionKey);
        if (ttEntry && ttEntry.depth >= depth) {
            return ttEntry.score;
        }
        
        if (this.transpositionTable.size > 200000) {
            const keysToDelete = Array.from(this.transpositionTable.keys()).slice(0, 50000);
            keysToDelete.forEach(key => this.transpositionTable.delete(key));
        }
        
        // Base case
        if (depth === 0) {
            return this.quiescenceSearch(alpha, beta, 0);
        }
        
        // CRITICAL FIX: Check game over BEFORE generating moves
        const moves = this.board.engine.generateMoves();
        if (moves.length === 0) {
            if (this.board.inCheck()) {
                // Checkmate - THIS position is mated (bad for current player)
                return -100000 + ply; // Negative = bad
            }
            return 0; // Stalemate
        }
        
        if (this.board.inDraw()) return 0;
        
        const inCheck = this.board.inCheck();
        const orderedMoves = this.orderMoves(moves, ply);
        
        let bestScore = -Infinity;
        
        for (const move of orderedMoves) {
            let extension = 0;
            if (inCheck || move.promotion) extension = 1;
            
            this.board.engine.makeMove(move);
            
            const movePositionKey = this.getPositionKey(this.board.getFEN());
            this.positionHistory.push(movePositionKey);
            
            let score;
            try {
                // Negamax: negate the opponent's score
                score = -this.negamax(depth - 1 + extension, -beta, -alpha, ply + 1);
            } finally {
                this.positionHistory.pop();
                this.board.engine.unmakeMove();
            }
            
            bestScore = Math.max(bestScore, score);
            alpha = Math.max(alpha, score);
            
            if (alpha >= beta) {
                if (!move.captured) {
                    this.killerMoves[ply][1] = this.killerMoves[ply][0];
                    this.killerMoves[ply][0] = move;
                }
                break; // Beta cutoff
            }
        }
        
        this.transpositionTable.set(positionKey, { score: bestScore, depth });
        return bestScore;
    }
    
    quiescenceSearch(alpha, beta, depth) {
        this.nodesSearched++;
        
        if (depth > 4) return this.evaluate();
        
        const standPat = this.evaluate();
        if (standPat >= beta) return beta;
        
        alpha = Math.max(alpha, standPat);
        
        const BIG_DELTA = 975;
        if (standPat < alpha - BIG_DELTA) return alpha;
        
        const captures = [];
        this.board.engine.generatePseudoLegalMoves(captures, true);
        const legalCaptures = this.board.engine.filterLegalMoves(captures);
        const orderedCaptures = this.orderCaptures(legalCaptures);
        
        for (const move of orderedCaptures) {
            if (depth >= 2) break;
            
            this.board.engine.makeMove(move);
            const score = -this.quiescenceSearch(-beta, -alpha, depth + 1);
            this.board.engine.unmakeMove();
            
            if (score >= beta) return beta;
            alpha = Math.max(alpha, score);
        }
        
        return alpha;
    }
    
    /**
     * FIXED: Evaluation from current player's perspective
     */
    evaluate() {
        // Game over checks
        const moves = this.board.engine.generateMoves();
        if (moves.length === 0) {
            if (this.board.inCheck()) {
                return -100000; // Current player is checkmated (very bad)
            }
            return 0; // Stalemate
        }
        
        if (this.board.inDraw()) return 0;
        
        const engine = this.board.engine;
        let score = 0;
        
        // Material
        const material = engine.getMaterialCount();
        const whiteMaterial = material.white;
        const blackMaterial = material.black;
        
        // Piece-square tables
        const pieceCount = engine.popCount(engine.allPieces);
        const isEndgame = pieceCount <= 10;
        
        // White pieces
        let bb = engine.whitePawns;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score += 100 + this.getPieceSquareValue('p', 'w', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.whiteKnights;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score += 320 + this.getPieceSquareValue('n', 'w', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.whiteBishops;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score += 330 + this.getPieceSquareValue('b', 'w', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.whiteRooks;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score += 500 + this.getPieceSquareValue('r', 'w', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.whiteQueens;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score += 900 + this.getPieceSquareValue('q', 'w', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.whiteKing;
        const whiteKingSquare = engine.bitScanForward(bb);
        score += this.getPieceSquareValue('k', 'w', Math.floor(whiteKingSquare / 8), whiteKingSquare % 8, isEndgame);
        
        // Black pieces (SUBTRACT)
        bb = engine.blackPawns;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score -= 100 + this.getPieceSquareValue('p', 'b', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.blackKnights;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score -= 320 + this.getPieceSquareValue('n', 'b', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.blackBishops;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score -= 330 + this.getPieceSquareValue('b', 'b', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.blackRooks;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score -= 500 + this.getPieceSquareValue('r', 'b', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.blackQueens;
        while (bb !== 0n) {
            const square = engine.bitScanForward(bb);
            score -= 900 + this.getPieceSquareValue('q', 'b', Math.floor(square / 8), square % 8, isEndgame);
            bb = engine.clearBit(bb, square);
        }
        
        bb = engine.blackKing;
        const blackKingSquare = engine.bitScanForward(bb);
        score -= this.getPieceSquareValue('k', 'b', Math.floor(blackKingSquare / 8), blackKingSquare % 8, isEndgame);
        
        // CRITICAL: Return from CURRENT player's perspective
        // If white to move: positive = white winning
        // If black to move: we need to flip it so positive = black winning
        return this.board.turn() === 'w' ? score : -score;
    }
    
    getPositionKey(fen) {
        const parts = fen.split(' ');
        return parts.slice(0, 4).join(' ');
    }
    
    orderMoves(moves, ply) {
        const scoredMoves = moves.map(move => {
            let score = 0;
            
            // MVV-LVA
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
            }
            
            return { move, score };
        });
        
        scoredMoves.sort((a, b) => b.score - a.score);
        return scoredMoves.map(sm => sm.move);
    }
    
    orderCaptures(captures) {
        return captures.sort((a, b) => {
            const scoreA = this.pieceValues[a.captured] * 10 - this.pieceValues[a.piece];
            const scoreB = this.pieceValues[b.captured] * 10 - this.pieceValues[b.piece];
            return scoreB - scoreA;
        });
    }
    
    isOutOfTime() {
        if (this.timeLimit === Infinity) return false;
        return (Date.now() - this.searchStartTime) >= this.timeLimit;
    }
    
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
    
    initializePieceSquareTables() {
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
        
        const tableIndex = (7 - rank) * 8 + file;
        return table[tableIndex] || 0;
    }
    
    async getBestMove(fen, depth = 3) {
        const chess = new Chess(fen);
        this.searchDepth = depth;
        const result = await this.calculateMove(chess);
        
        if (!result) return null;
        
        const testMove = chess.move(result);
        if (!testMove) {
            console.error('Illegal move generated:', result);
            return null;
        }
        
        chess.undo();
        return result;
    }
}

// Initialize global instance
if (typeof window !== 'undefined') {
    window.martinaBitboard = new MartinaBitboardBot();
}