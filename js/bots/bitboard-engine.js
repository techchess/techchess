/**
 * Bitboard Chess Engine
 * Ultra-fast move generation using 64-bit bitboards
 * Based on Sebastian Lague's approach with JavaScript BigInt
 */

class BitboardEngine {
    constructor() {
        // Bitboards for each piece type and color (12 total)
        // Using BigInt for true 64-bit representation
        this.whitePawns = 0n;
        this.whiteKnights = 0n;
        this.whiteBishops = 0n;
        this.whiteRooks = 0n;
        this.whiteQueens = 0n;
        this.whiteKing = 0n;
        
        this.blackPawns = 0n;
        this.blackKnights = 0n;
        this.blackBishops = 0n;
        this.blackRooks = 0n;
        this.blackQueens = 0n;
        this.blackKing = 0n;
        
        // Composite bitboards
        this.whitePieces = 0n;
        this.blackPieces = 0n;
        this.allPieces = 0n;
        
        // Game state
        this.whiteToMove = true;
        this.castleRights = 0b1111; // KQkq
        this.enPassantSquare = -1;
        this.halfmoveClock = 0;
        this.fullmoveNumber = 1;
        
        // Move history for unmake
        this.moveHistory = [];
        this.stateHistory = [];
        
        // Precomputed attack tables
        this.knightAttacks = new Array(64);
        this.kingAttacks = new Array(64);
        this.pawnAttacks = { white: new Array(64), black: new Array(64) };
        
        // Precompute attack tables
        this.initializeAttackTables();
        
        // Set up starting position
        this.loadStartingPosition();
    }
    
    /**
     * Initialize the attack lookup tables
     */
    initializeAttackTables() {
        // Knight moves: L-shape (2 squares one direction, 1 square perpendicular)
        const knightOffsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        
        // King moves: one square in any direction
        const kingOffsets = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        for (let square = 0; square < 64; square++) {
            const rank = Math.floor(square / 8);
            const file = square % 8;
            
            // Knight attacks
            this.knightAttacks[square] = 0n;
            for (const [dr, df] of knightOffsets) {
                const newRank = rank + dr;
                const newFile = file + df;
                if (newRank >= 0 && newRank < 8 && newFile >= 0 && newFile < 8) {
                    const targetSquare = newRank * 8 + newFile;
                    this.knightAttacks[square] |= (1n << BigInt(targetSquare));
                }
            }
            
            // King attacks
            this.kingAttacks[square] = 0n;
            for (const [dr, df] of kingOffsets) {
                const newRank = rank + dr;
                const newFile = file + df;
                if (newRank >= 0 && newRank < 8 && newFile >= 0 && newFile < 8) {
                    const targetSquare = newRank * 8 + newFile;
                    this.kingAttacks[square] |= (1n << BigInt(targetSquare));
                }
            }
            
            // White pawn attacks (captures only)
            this.pawnAttacks.white[square] = 0n;
            if (rank < 7) { // Not on 8th rank
                if (file > 0) { // Can capture left
                    this.pawnAttacks.white[square] |= (1n << BigInt((rank + 1) * 8 + (file - 1)));
                }
                if (file < 7) { // Can capture right
                    this.pawnAttacks.white[square] |= (1n << BigInt((rank + 1) * 8 + (file + 1)));
                }
            }
            
            // Black pawn attacks (captures only)
            this.pawnAttacks.black[square] = 0n;
            if (rank > 0) { // Not on 1st rank
                if (file > 0) { // Can capture left
                    this.pawnAttacks.black[square] |= (1n << BigInt((rank - 1) * 8 + (file - 1)));
                }
                if (file < 7) { // Can capture right
                    this.pawnAttacks.black[square] |= (1n << BigInt((rank - 1) * 8 + (file + 1)));
                }
            }
        }
    }
    
    /**
     * Set up the standard chess starting position
     */
    loadStartingPosition() {
        // Clear all bitboards
        this.whitePawns = 0n;
        this.whiteKnights = 0n;
        this.whiteBishops = 0n;
        this.whiteRooks = 0n;
        this.whiteQueens = 0n;
        this.whiteKing = 0n;
        this.blackPawns = 0n;
        this.blackKnights = 0n;
        this.blackBishops = 0n;
        this.blackRooks = 0n;
        this.blackQueens = 0n;
        this.blackKing = 0n;
        
        // White pieces (rank 0 and 1)
        this.whiteRooks = (1n << 0n) | (1n << 7n);
        this.whiteKnights = (1n << 1n) | (1n << 6n);
        this.whiteBishops = (1n << 2n) | (1n << 5n);
        this.whiteQueens = (1n << 3n);
        this.whiteKing = (1n << 4n);
        this.whitePawns = 0xFFn << 8n; // Second rank
        
        // Black pieces (rank 6 and 7)
        this.blackRooks = (1n << 56n) | (1n << 63n);
        this.blackKnights = (1n << 57n) | (1n << 62n);
        this.blackBishops = (1n << 58n) | (1n << 61n);
        this.blackQueens = (1n << 59n);
        this.blackKing = (1n << 60n);
        this.blackPawns = 0xFFn << 48n; // Seventh rank
        
        this.updateCompositeBitboards();
        
        // Reset game state
        this.whiteToMove = true;
        this.castleRights = 0b1111; // KQkq
        this.enPassantSquare = -1;
        this.halfmoveClock = 0;
        this.fullmoveNumber = 1;
        this.moveHistory = [];
        this.stateHistory = [];
    }
    
    /**
     * Update composite bitboards (white pieces, black pieces, all pieces)
     */
    updateCompositeBitboards() {
        this.whitePieces = this.whitePawns | this.whiteKnights | this.whiteBishops | 
                          this.whiteRooks | this.whiteQueens | this.whiteKing;
        this.blackPieces = this.blackPawns | this.blackKnights | this.blackBishops | 
                          this.blackRooks | this.blackQueens | this.blackKing;
        this.allPieces = this.whitePieces | this.blackPieces;
    }
    
    /**
     * Test if a bit is set at a square
     */
    testBit(bitboard, square) {
        return (bitboard & (1n << BigInt(square))) !== 0n;
    }
    
    /**
     * Set a bit at a square
     */
    setBit(bitboard, square) {
        return bitboard | (1n << BigInt(square));
    }
    
    /**
     * Clear a bit at a square
     */
    clearBit(bitboard, square) {
        return bitboard & ~(1n << BigInt(square));
    }
    
    /**
     * Get the piece type at a square
     * Returns: { piece: 'p'|'n'|'b'|'r'|'q'|'k', color: 'w'|'b' } or null
     */
    getPieceAt(square) {
        const squareBit = 1n << BigInt(square);
        
        if ((squareBit & this.whitePawns) !== 0n) return { piece: 'p', color: 'w' };
        if ((squareBit & this.whiteKnights) !== 0n) return { piece: 'n', color: 'w' };
        if ((squareBit & this.whiteBishops) !== 0n) return { piece: 'b', color: 'w' };
        if ((squareBit & this.whiteRooks) !== 0n) return { piece: 'r', color: 'w' };
        if ((squareBit & this.whiteQueens) !== 0n) return { piece: 'q', color: 'w' };
        if ((squareBit & this.whiteKing) !== 0n) return { piece: 'k', color: 'w' };
        
        if ((squareBit & this.blackPawns) !== 0n) return { piece: 'p', color: 'b' };
        if ((squareBit & this.blackKnights) !== 0n) return { piece: 'n', color: 'b' };
        if ((squareBit & this.blackBishops) !== 0n) return { piece: 'b', color: 'b' };
        if ((squareBit & this.blackRooks) !== 0n) return { piece: 'r', color: 'b' };
        if ((squareBit & this.blackQueens) !== 0n) return { piece: 'q', color: 'b' };
        if ((squareBit & this.blackKing) !== 0n) return { piece: 'k', color: 'b' };
        
        return null;
    }
    
    /**
     * Generate sliding piece attacks (rooks, bishops, queens)
     * Using simple shift-based approach (can be optimized with magic bitboards later)
     */
    getSlidingAttacks(square, directions, blockers) {
        let attacks = 0n;
        const rank = Math.floor(square / 8);
        const file = square % 8;
        
        for (const [dr, df] of directions) {
            let r = rank + dr;
            let f = file + df;
            
            while (r >= 0 && r < 8 && f >= 0 && f < 8) {
                const targetSquare = r * 8 + f;
                const targetBit = 1n << BigInt(targetSquare);
                attacks |= targetBit;
                
                // Stop if we hit a blocker
                if (blockers & targetBit) break;
                
                r += dr;
                f += df;
            }
        }
        
        return attacks;
    }
    
    /**
     * Get rook attacks from a square
     */
    getRookAttacks(square, blockers) {
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]]; // Right, Left, Up, Down
        return this.getSlidingAttacks(square, directions, blockers);
    }
    
    /**
     * Get bishop attacks from a square
     */
    getBishopAttacks(square, blockers) {
        const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]]; // Diagonals
        return this.getSlidingAttacks(square, directions, blockers);
    }
    
    /**
     * Get queen attacks from a square
     */
    getQueenAttacks(square, blockers) {
        return this.getRookAttacks(square, blockers) | this.getBishopAttacks(square, blockers);
    }
    
    /**
     * Check if a square is attacked by the given color
     */
    isSquareAttacked(square, byColor) {
        // Check for invalid square
        if (square < 0 || square >= 64) return false;
        
        const squareBit = 1n << BigInt(square);
        const blockers = this.allPieces;
        
        if (byColor === 'w') {
            // Check pawn attacks
            const pawnAttack = this.pawnAttacks.black[square];
            if (pawnAttack !== undefined && (pawnAttack & this.whitePawns) !== 0n) return true;
            
            // Check knight attacks
            const knightAttack = this.knightAttacks[square];
            if (knightAttack !== undefined && (knightAttack & this.whiteKnights) !== 0n) return true;
            
            // Check king attacks
            const kingAttack = this.kingAttacks[square];
            if (kingAttack !== undefined && (kingAttack & this.whiteKing) !== 0n) return true;
            
            // Check bishop/queen attacks
            const bishopAttacks = this.getBishopAttacks(square, blockers);
            if ((bishopAttacks & (this.whiteBishops | this.whiteQueens)) !== 0n) return true;
            
            // Check rook/queen attacks
            const rookAttacks = this.getRookAttacks(square, blockers);
            if ((rookAttacks & (this.whiteRooks | this.whiteQueens)) !== 0n) return true;
        } else {
            // Check pawn attacks
            const pawnAttack = this.pawnAttacks.white[square];
            if (pawnAttack !== undefined && (pawnAttack & this.blackPawns) !== 0n) return true;
            
            // Check knight attacks
            const knightAttack = this.knightAttacks[square];
            if (knightAttack !== undefined && (knightAttack & this.blackKnights) !== 0n) return true;
            
            // Check king attacks
            const kingAttack = this.kingAttacks[square];
            if (kingAttack !== undefined && (kingAttack & this.blackKing) !== 0n) return true;
            
            // Check bishop/queen attacks
            const bishopAttacks = this.getBishopAttacks(square, blockers);
            if ((bishopAttacks & (this.blackBishops | this.blackQueens)) !== 0n) return true;
            
            // Check rook/queen attacks
            const rookAttacks = this.getRookAttacks(square, blockers);
            if ((rookAttacks & (this.blackRooks | this.blackQueens)) !== 0n) return true;
        }
        
        return false;
    }
    
    /**
     * Check if the current side to move is in check
     */
    inCheck() {
        return this.isKingInCheck(this.whiteToMove);
    }
    
    /**
     * Check if a specific side's king is in check
     */
    isKingInCheck(forWhite) {
        const kingBitboard = forWhite ? this.whiteKing : this.blackKing;
        const kingSquare = this.bitScanForward(kingBitboard);
        const attackingColor = forWhite ? 'b' : 'w';
        return this.isSquareAttacked(kingSquare, attackingColor);
    }
    
    /**
     * Find the index of the least significant bit (bit scan forward)
     */
    bitScanForward(bitboard) {
        if (bitboard === 0n) return -1;
        let square = 0;
        let bb = bitboard;
        while ((bb & 1n) === 0n) {
            bb >>= 1n;
            square++;
        }
        return square;
    }
    
    /**
     * Count the number of set bits (population count)
     */
    popCount(bitboard) {
        let count = 0;
        let bb = bitboard;
        while (bb !== 0n) {
            bb &= bb - 1n; // Remove the least significant bit
            count++;
        }
        return count;
    }
    
    /**
     * Generate all legal moves for the current position
     * Returns array of move objects: { from, to, piece, captured, promotion, flags }
     */
    generateMoves(capturesOnly = false) {
        const moves = [];
        
        // Generate pseudo-legal moves first
        this.generatePseudoLegalMoves(moves, capturesOnly);
        
        // Filter for legal moves (without infinite recursion)
        return this.filterLegalMoves(moves);
    }
    
    /**
     * Generate pseudo-legal moves (moves that follow piece rules but may leave king in check)
     */
    generatePseudoLegalMoves(moves, capturesOnly = false) {
        const friendlyPieces = this.whiteToMove ? this.whitePieces : this.blackPieces;
        const enemyPieces = this.whiteToMove ? this.blackPieces : this.whitePieces;
        
        if (this.whiteToMove) {
            this.generatePawnMoves(moves, this.whitePawns, friendlyPieces, enemyPieces, true, capturesOnly);
            this.generateKnightMoves(moves, this.whiteKnights, friendlyPieces, enemyPieces, capturesOnly);
            this.generateBishopMoves(moves, this.whiteBishops, friendlyPieces, enemyPieces, capturesOnly);
            this.generateRookMoves(moves, this.whiteRooks, friendlyPieces, enemyPieces, capturesOnly);
            this.generateQueenMoves(moves, this.whiteQueens, friendlyPieces, enemyPieces, capturesOnly);
            this.generateKingMoves(moves, this.whiteKing, friendlyPieces, enemyPieces, capturesOnly);
        } else {
            this.generatePawnMoves(moves, this.blackPawns, friendlyPieces, enemyPieces, false, capturesOnly);
            this.generateKnightMoves(moves, this.blackKnights, friendlyPieces, enemyPieces, capturesOnly);
            this.generateBishopMoves(moves, this.blackBishops, friendlyPieces, enemyPieces, capturesOnly);
            this.generateRookMoves(moves, this.blackRooks, friendlyPieces, enemyPieces, capturesOnly);
            this.generateQueenMoves(moves, this.blackQueens, friendlyPieces, enemyPieces, capturesOnly);
            this.generateKingMoves(moves, this.blackKing, friendlyPieces, enemyPieces, capturesOnly);
        }
    }
    
    /**
     * Filter pseudo-legal moves to only include legal moves
     * Uses direct state manipulation instead of makeMove/unmakeMove to avoid infinite recursion
     */
    filterLegalMoves(pseudoLegalMoves) {
        const legalMoves = [];
        const currentSide = this.whiteToMove;
        
        for (const move of pseudoLegalMoves) {
            if (this.isMoveLegal(move, currentSide)) {
                legalMoves.push(move);
            }
        }
        
        return legalMoves;
    }
    
    /**
     * Check if a move is legal by simulating it without using makeMove/unmakeMove
     */
    isMoveLegal(move, forWhite) {
        const { from, to, piece, captured, flags } = move;
        
        // Save current state
        const originalPieces = this.saveCurrentState();
        
        // Simulate the move directly on bitboards
        this.simulateMove(move, forWhite);
        
        // Check if king is in check after the move
        const kingInCheck = this.isKingInCheck(forWhite);
        
        // Restore original state
        this.restoreState(originalPieces);
        
        return !kingInCheck;
    }
    
    /**
     * Save current bitboard state
     */
    saveCurrentState() {
        return {
            whitePawns: this.whitePawns,
            whiteKnights: this.whiteKnights,
            whiteBishops: this.whiteBishops,
            whiteRooks: this.whiteRooks,
            whiteQueens: this.whiteQueens,
            whiteKing: this.whiteKing,
            blackPawns: this.blackPawns,
            blackKnights: this.blackKnights,
            blackBishops: this.blackBishops,
            blackRooks: this.blackRooks,
            blackQueens: this.blackQueens,
            blackKing: this.blackKing,
            whitePieces: this.whitePieces,
            blackPieces: this.blackPieces,
            allPieces: this.allPieces
        };
    }
    
    /**
     * Restore bitboard state
     */
    restoreState(state) {
        this.whitePawns = state.whitePawns;
        this.whiteKnights = state.whiteKnights;
        this.whiteBishops = state.whiteBishops;
        this.whiteRooks = state.whiteRooks;
        this.whiteQueens = state.whiteQueens;
        this.whiteKing = state.whiteKing;
        this.blackPawns = state.blackPawns;
        this.blackKnights = state.blackKnights;
        this.blackBishops = state.blackBishops;
        this.blackRooks = state.blackRooks;
        this.blackQueens = state.blackQueens;
        this.blackKing = state.blackKing;
        this.whitePieces = state.whitePieces;
        this.blackPieces = state.blackPieces;
        this.allPieces = state.allPieces;
    }
    
    /**
     * Simulate a move directly on bitboards without full makeMove logic
     */
    simulateMove(move, forWhite) {
        const { from, to, piece, captured, flags } = move;
        
        // Get source bitboard
        const sourceBitboard = this.getBitboardForPiece(piece, forWhite);
        
        // Remove piece from source
        this[sourceBitboard] = this.clearBit(this[sourceBitboard], from);
        
        // Handle captures
        if (captured) {
            const capturedBitboard = this.getBitboardForPiece(captured, !forWhite);
            const captureSquare = flags === 'ep-capture' ? (forWhite ? to - 8 : to + 8) : to;
            this[capturedBitboard] = this.clearBit(this[capturedBitboard], captureSquare);
        }
        
        // Add piece to destination
        this[sourceBitboard] = this.setBit(this[sourceBitboard], to);
        
        // Handle castling rook moves
        if (flags === 'castle-kingside') {
            if (forWhite) {
                this.whiteRooks = this.clearBit(this.whiteRooks, 7);
                this.whiteRooks = this.setBit(this.whiteRooks, 5);
            } else {
                this.blackRooks = this.clearBit(this.blackRooks, 63);
                this.blackRooks = this.setBit(this.blackRooks, 61);
            }
        } else if (flags === 'castle-queenside') {
            if (forWhite) {
                this.whiteRooks = this.clearBit(this.whiteRooks, 0);
                this.whiteRooks = this.setBit(this.whiteRooks, 3);
            } else {
                this.blackRooks = this.clearBit(this.blackRooks, 56);
                this.blackRooks = this.setBit(this.blackRooks, 59);
            }
        }
        
        // Update composite bitboards
        this.updateCompositeBitboards();
    }
    
    /**
     * Generate pawn moves
     */
    generatePawnMoves(moves, pawns, friendly, enemy, isWhite, capturesOnly) {
        let pawnBitboard = pawns;
        const direction = isWhite ? 8 : -8;
        const startRank = isWhite ? 1 : 6;
        const promotionRank = isWhite ? 7 : 0;
        
        while (pawnBitboard !== 0n) {
            const from = this.bitScanForward(pawnBitboard);
            const fromRank = Math.floor(from / 8);
            const fromFile = from % 8;
            
            // Single push
            if (!capturesOnly) {
                const to = from + direction;
                if (to >= 0 && to < 64 && !this.testBit(this.allPieces, to)) {
                    const toRank = Math.floor(to / 8);
                    if (toRank === promotionRank) {
                        // Promotions
                        moves.push({ from, to, piece: 'p', promotion: 'q', flags: 'promotion' });
                        moves.push({ from, to, piece: 'p', promotion: 'r', flags: 'promotion' });
                        moves.push({ from, to, piece: 'p', promotion: 'b', flags: 'promotion' });
                        moves.push({ from, to, piece: 'p', promotion: 'n', flags: 'promotion' });
                    } else {
                        moves.push({ from, to, piece: 'p', flags: 'normal' });
                        
                        // Double push from starting position
                        if (fromRank === startRank) {
                            const doublePushTo = from + direction * 2;
                            if (!this.testBit(this.allPieces, doublePushTo)) {
                                moves.push({ from, to: doublePushTo, piece: 'p', flags: 'doublepush' });
                            }
                        }
                    }
                }
            }
            
            // Captures
            const captureSquares = isWhite ? this.pawnAttacks.white[from] : this.pawnAttacks.black[from];
            if (captureSquares === undefined) {
                pawnBitboard = this.clearBit(pawnBitboard, from);
                continue;
            }
            let captures = captureSquares & enemy;
            
            while (captures !== 0n) {
                const to = this.bitScanForward(captures);
                const toRank = Math.floor(to / 8);
                const captured = this.getPieceAt(to);
                
                if (toRank === promotionRank) {
                    moves.push({ from, to, piece: 'p', captured: captured.piece, promotion: 'q', flags: 'capture-promotion' });
                    moves.push({ from, to, piece: 'p', captured: captured.piece, promotion: 'r', flags: 'capture-promotion' });
                    moves.push({ from, to, piece: 'p', captured: captured.piece, promotion: 'b', flags: 'capture-promotion' });
                    moves.push({ from, to, piece: 'p', captured: captured.piece, promotion: 'n', flags: 'capture-promotion' });
                } else {
                    moves.push({ from, to, piece: 'p', captured: captured.piece, flags: 'capture' });
                }
                
                captures = this.clearBit(captures, to);
            }
            
            // En passant
            if (this.enPassantSquare >= 0) {
                const epBit = 1n << BigInt(this.enPassantSquare);
                if (captureSquares & epBit) {
                    moves.push({ from, to: this.enPassantSquare, piece: 'p', captured: 'p', flags: 'ep-capture' });
                }
            }
            
            pawnBitboard = this.clearBit(pawnBitboard, from);
        }
    }
    
    /**
     * Generate knight moves
     */
    generateKnightMoves(moves, knights, friendly, enemy, capturesOnly) {
        let knightBitboard = knights;
        
        while (knightBitboard !== 0n) {
            const from = this.bitScanForward(knightBitboard);
            const knightAttack = this.knightAttacks[from];
            if (knightAttack === undefined) {
                knightBitboard = this.clearBit(knightBitboard, from);
                continue;
            }
            let targets = knightAttack & ~friendly;
            
            if (capturesOnly) {
                targets &= enemy;
            }
            
            while (targets !== 0n) {
                const to = this.bitScanForward(targets);
                const captured = this.getPieceAt(to);
                
                moves.push({
                    from,
                    to,
                    piece: 'n',
                    captured: captured ? captured.piece : null,
                    flags: captured ? 'capture' : 'normal'
                });
                
                targets = this.clearBit(targets, to);
            }
            
            knightBitboard = this.clearBit(knightBitboard, from);
        }
    }
    
    /**
     * Generate bishop moves
     */
    generateBishopMoves(moves, bishops, friendly, enemy, capturesOnly) {
        let bishopBitboard = bishops;
        
        while (bishopBitboard !== 0n) {
            const from = this.bitScanForward(bishopBitboard);
            let targets = this.getBishopAttacks(from, this.allPieces) & ~friendly;
            
            if (capturesOnly) {
                targets &= enemy;
            }
            
            while (targets !== 0n) {
                const to = this.bitScanForward(targets);
                const captured = this.getPieceAt(to);
                
                moves.push({
                    from,
                    to,
                    piece: 'b',
                    captured: captured ? captured.piece : null,
                    flags: captured ? 'capture' : 'normal'
                });
                
                targets = this.clearBit(targets, to);
            }
            
            bishopBitboard = this.clearBit(bishopBitboard, from);
        }
    }
    
    /**
     * Generate rook moves
     */
    generateRookMoves(moves, rooks, friendly, enemy, capturesOnly) {
        let rookBitboard = rooks;
        
        while (rookBitboard !== 0n) {
            const from = this.bitScanForward(rookBitboard);
            let targets = this.getRookAttacks(from, this.allPieces) & ~friendly;
            
            if (capturesOnly) {
                targets &= enemy;
            }
            
            while (targets !== 0n) {
                const to = this.bitScanForward(targets);
                const captured = this.getPieceAt(to);
                
                moves.push({
                    from,
                    to,
                    piece: 'r',
                    captured: captured ? captured.piece : null,
                    flags: captured ? 'capture' : 'normal'
                });
                
                targets = this.clearBit(targets, to);
            }
            
            rookBitboard = this.clearBit(rookBitboard, from);
        }
    }
    
    /**
     * Generate queen moves
     */
    generateQueenMoves(moves, queens, friendly, enemy, capturesOnly) {
        let queenBitboard = queens;
        
        while (queenBitboard !== 0n) {
            const from = this.bitScanForward(queenBitboard);
            let targets = this.getQueenAttacks(from, this.allPieces) & ~friendly;
            
            if (capturesOnly) {
                targets &= enemy;
            }
            
            while (targets !== 0n) {
                const to = this.bitScanForward(targets);
                const captured = this.getPieceAt(to);
                
                moves.push({
                    from,
                    to,
                    piece: 'q',
                    captured: captured ? captured.piece : null,
                    flags: captured ? 'capture' : 'normal'
                });
                
                targets = this.clearBit(targets, to);
            }
            
            queenBitboard = this.clearBit(queenBitboard, from);
        }
    }
    
    /**
     * Generate king moves (including castling)
     */
    generateKingMoves(moves, king, friendly, enemy, capturesOnly) {
        const from = this.bitScanForward(king);
        if (from < 0) return; // No king found
        
        const kingAttack = this.kingAttacks[from];
        if (kingAttack === undefined) return;
        
        let targets = kingAttack & ~friendly;
        
        if (capturesOnly) {
            targets &= enemy;
        }
        
        while (targets !== 0n) {
            const to = this.bitScanForward(targets);
            const captured = this.getPieceAt(to);
            
            moves.push({
                from,
                to,
                piece: 'k',
                captured: captured ? captured.piece : null,
                flags: captured ? 'capture' : 'normal'
            });
            
            targets = this.clearBit(targets, to);
        }
        
        // Castling (only if not capturesOnly)
        if (!capturesOnly && !this.inCheck()) {
            if (this.whiteToMove) {
                // White kingside: e1 (4) to g1 (6), checking f1 (5) and g1 (6)
                if ((this.castleRights & 0b1000) && 
                    !this.testBit(this.allPieces, 5) && 
                    !this.testBit(this.allPieces, 6) &&
                    !this.isSquareAttacked(5, 'b') && 
                    !this.isSquareAttacked(6, 'b')) {
                    moves.push({ from: 4, to: 6, piece: 'k', flags: 'castle-kingside' });
                }
                // White queenside: e1 (4) to c1 (2), checking d1 (3), c1 (2), and b1 (1)
                if ((this.castleRights & 0b0100) && 
                    !this.testBit(this.allPieces, 1) && 
                    !this.testBit(this.allPieces, 2) && 
                    !this.testBit(this.allPieces, 3) &&
                    !this.isSquareAttacked(2, 'b') && 
                    !this.isSquareAttacked(3, 'b')) {
                    moves.push({ from: 4, to: 2, piece: 'k', flags: 'castle-queenside' });
                }
            } else {
                // Black kingside: e8 (60) to g8 (62), checking f8 (61) and g8 (62)
                if ((this.castleRights & 0b0010) && 
                    !this.testBit(this.allPieces, 61) && 
                    !this.testBit(this.allPieces, 62) &&
                    !this.isSquareAttacked(61, 'w') && 
                    !this.isSquareAttacked(62, 'w')) {
                    moves.push({ from: 60, to: 62, piece: 'k', flags: 'castle-kingside' });
                }
                // Black queenside: e8 (60) to c8 (58), checking d8 (59), c8 (58), and b8 (57)
                if ((this.castleRights & 0b0001) && 
                    !this.testBit(this.allPieces, 57) && 
                    !this.testBit(this.allPieces, 58) && 
                    !this.testBit(this.allPieces, 59) &&
                    !this.isSquareAttacked(58, 'w') && 
                    !this.isSquareAttacked(59, 'w')) {
                    moves.push({ from: 60, to: 58, piece: 'k', flags: 'castle-queenside' });
                }
            }
        }
    }
    
    /**
     * Make a move on the board
     */
    makeMove(move) {
        // Save current state for unmake
        this.stateHistory.push({
            castleRights: this.castleRights,
            enPassantSquare: this.enPassantSquare,
            halfmoveClock: this.halfmoveClock,
            fullmoveNumber: this.fullmoveNumber
        });
        this.moveHistory.push(move);
        
        const { from, to, piece, captured, promotion, flags } = move;
        const isWhite = this.whiteToMove;
        
        // Get bitboard for moving piece
        const pieceBitboard = this.getBitboardForPiece(piece, isWhite);
        
        // Remove piece from source square
        this[pieceBitboard] = this.clearBit(this[pieceBitboard], from);
        
        // Handle captures
        if (captured) {
            const capturedBitboard = this.getBitboardForPiece(captured, !isWhite);
            const captureSquare = flags === 'ep-capture' ? (isWhite ? to - 8 : to + 8) : to;
            this[capturedBitboard] = this.clearBit(this[capturedBitboard], captureSquare);
            this.halfmoveClock = 0;
            
            // Remove castling rights if a rook is captured on its starting square
            if (captured === 'r') {
                if (captureSquare === 0) this.castleRights &= 0b1011; // White queenside (a1)
                if (captureSquare === 7) this.castleRights &= 0b0111; // White kingside (h1)
                if (captureSquare === 56) this.castleRights &= 0b1110; // Black queenside (a8)
                if (captureSquare === 63) this.castleRights &= 0b1101; // Black kingside (h8)
            }
        } else if (piece === 'p') {
            this.halfmoveClock = 0;
        } else {
            this.halfmoveClock++;
        }
        
        // Add piece to target square (handle promotions)
        if (promotion) {
            const promotionBitboard = this.getBitboardForPiece(promotion, isWhite);
            this[promotionBitboard] = this.setBit(this[promotionBitboard], to);
        } else {
            this[pieceBitboard] = this.setBit(this[pieceBitboard], to);
        }
        
        // Handle castling
        if (flags === 'castle-kingside') {
            if (isWhite) {
                // White: h1 (7) to f1 (5)
                this.whiteRooks = this.clearBit(this.whiteRooks, 7);
                this.whiteRooks = this.setBit(this.whiteRooks, 5);
            } else {
                // Black: h8 (63) to f8 (61)
                this.blackRooks = this.clearBit(this.blackRooks, 63);
                this.blackRooks = this.setBit(this.blackRooks, 61);
            }
        } else if (flags === 'castle-queenside') {
            if (isWhite) {
                // White: a1 (0) to d1 (3)
                this.whiteRooks = this.clearBit(this.whiteRooks, 0);
                this.whiteRooks = this.setBit(this.whiteRooks, 3);
            } else {
                // Black: a8 (56) to d8 (59)
                this.blackRooks = this.clearBit(this.blackRooks, 56);
                this.blackRooks = this.setBit(this.blackRooks, 59);
            }
        }
        
        // Update castling rights
        if (piece === 'k') {
            if (isWhite) {
                this.castleRights &= 0b0011; // Remove white castling rights
            } else {
                this.castleRights &= 0b1100; // Remove black castling rights
            }
        } else if (piece === 'r') {
            if (from === 0) this.castleRights &= 0b1011; // White queenside (a1)
            if (from === 7) this.castleRights &= 0b0111; // White kingside (h1)
            if (from === 56) this.castleRights &= 0b1110; // Black queenside (a8)
            if (from === 63) this.castleRights &= 0b1101; // Black kingside (h8)
        }
        
        // Update en passant square
        if (flags === 'doublepush') {
            this.enPassantSquare = isWhite ? to - 8 : to + 8;
        } else {
            this.enPassantSquare = -1;
        }
        
        // Update composite bitboards
        this.updateCompositeBitboards();
        
        // Switch sides
        this.whiteToMove = !this.whiteToMove;
        if (!isWhite) {
            this.fullmoveNumber++;
        }
        
    }
    
    /**
     * Unmake the last move
     */
    unmakeMove() {
        if (this.moveHistory.length === 0) return;
        
        const move = this.moveHistory.pop();
        const state = this.stateHistory.pop();
        
        
        // Restore state
        this.castleRights = state.castleRights;
        this.enPassantSquare = state.enPassantSquare;
        this.halfmoveClock = state.halfmoveClock;
        this.fullmoveNumber = state.fullmoveNumber;
        
        const { from, to, piece, captured, promotion, flags } = move;
        
        // Switch sides back first
        this.whiteToMove = !this.whiteToMove;
        
        // isWhite should match the side that made the move (now matches whiteToMove after switch)
        const isWhite = this.whiteToMove;
        
        // Remove piece from target square
        if (promotion) {
            const promotionBitboard = this.getBitboardForPiece(promotion, isWhite);
            this[promotionBitboard] = this.clearBit(this[promotionBitboard], to);
        } else {
            const pieceBitboard = this.getBitboardForPiece(piece, isWhite);
            this[pieceBitboard] = this.clearBit(this[pieceBitboard], to);
        }
        
        // Restore piece to source square
        const pieceBitboard = this.getBitboardForPiece(piece, isWhite);
        this[pieceBitboard] = this.setBit(this[pieceBitboard], from);
        
        // Restore captured piece
        if (captured) {
            const capturedBitboard = this.getBitboardForPiece(captured, !isWhite);
            const captureSquare = flags === 'ep-capture' ? (isWhite ? to - 8 : to + 8) : to;
            this[capturedBitboard] = this.setBit(this[capturedBitboard], captureSquare);
        }
        
        // Undo castling rook moves
        if (flags === 'castle-kingside') {
            if (isWhite) {
                // White: f1 (5) back to h1 (7)
                this.whiteRooks = this.clearBit(this.whiteRooks, 5);
                this.whiteRooks = this.setBit(this.whiteRooks, 7);
            } else {
                // Black: f8 (61) back to h8 (63)
                this.blackRooks = this.clearBit(this.blackRooks, 61);
                this.blackRooks = this.setBit(this.blackRooks, 63);
            }
        } else if (flags === 'castle-queenside') {
            if (isWhite) {
                // White: d1 (3) back to a1 (0)
                this.whiteRooks = this.clearBit(this.whiteRooks, 3);
                this.whiteRooks = this.setBit(this.whiteRooks, 0);
            } else {
                // Black: d8 (59) back to a8 (56)
                this.blackRooks = this.clearBit(this.blackRooks, 59);
                this.blackRooks = this.setBit(this.blackRooks, 56);
            }
        }
        
        // Update composite bitboards
        this.updateCompositeBitboards();
        
    }
    
    /**
     * Get bitboard name for a piece
     */
    getBitboardForPiece(piece, isWhite) {
        const pieceMap = {
            'p': isWhite ? 'whitePawns' : 'blackPawns',
            'n': isWhite ? 'whiteKnights' : 'blackKnights',
            'b': isWhite ? 'whiteBishops' : 'blackBishops',
            'r': isWhite ? 'whiteRooks' : 'blackRooks',
            'q': isWhite ? 'whiteQueens' : 'blackQueens',
            'k': isWhite ? 'whiteKing' : 'blackKing'
        };
        return pieceMap[piece];
    }
    
    /**
     * Convert square index to algebraic notation
     */
    squareToAlgebraic(square) {
        const file = String.fromCharCode(97 + (square % 8)); // a-h
        const rank = Math.floor(square / 8) + 1; // 1-8
        return file + rank;
    }
    
    /**
     * Convert algebraic notation to square index
     */
    algebraicToSquare(algebraic) {
        const file = algebraic.charCodeAt(0) - 97; // a-h -> 0-7
        const rank = parseInt(algebraic[1]) - 1; // 1-8 -> 0-7
        return rank * 8 + file;
    }
    
    /**
     * Check if game is over
     */
    isGameOver() {
        const moves = this.generateMoves();
        if (moves.length === 0) {
            const inCheck = this.inCheck();
            return { 
                gameOver: true, 
                checkmate: inCheck, 
                stalemate: !inCheck,
                draw: !inCheck
            };
        }
        if (this.halfmoveClock >= 100) {
            return { gameOver: true, draw: true, stalemate: false, checkmate: false, reason: '50-move rule' };
        }
        return { gameOver: false, checkmate: false, stalemate: false, draw: false };
    }
    
    /**
     * Get material count for evaluation
     */
    getMaterialCount() {
        return {
            white: this.popCount(this.whitePawns) * 100 +
                   this.popCount(this.whiteKnights) * 320 +
                   this.popCount(this.whiteBishops) * 330 +
                   this.popCount(this.whiteRooks) * 500 +
                   this.popCount(this.whiteQueens) * 900,
            black: this.popCount(this.blackPawns) * 100 +
                   this.popCount(this.blackKnights) * 320 +
                   this.popCount(this.blackBishops) * 330 +
                   this.popCount(this.blackRooks) * 500 +
                   this.popCount(this.blackQueens) * 900
        };
    }
}

