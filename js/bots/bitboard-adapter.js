/**
 * Adapter between Chess.js and BitboardEngine
 * Allows gradual migration from Chess.js to bitboard engine
 */

class BitboardAdapter {
    constructor() {
        this.engine = new BitboardEngine();
    }
    
    /**
     * Load a FEN position
     */
    loadFEN(fen) {
        // Parse FEN string
        const parts = fen.split(' ');
        const piecePlacement = parts[0];
        const activeColor = parts[1];
        const castling = parts[2];
        const enPassant = parts[3];
        const halfmove = parseInt(parts[4]) || 0;
        const fullmove = parseInt(parts[5]) || 1;
        
        // Clear bitboards
        this.engine.whitePawns = 0n;
        this.engine.whiteKnights = 0n;
        this.engine.whiteBishops = 0n;
        this.engine.whiteRooks = 0n;
        this.engine.whiteQueens = 0n;
        this.engine.whiteKing = 0n;
        this.engine.blackPawns = 0n;
        this.engine.blackKnights = 0n;
        this.engine.blackBishops = 0n;
        this.engine.blackRooks = 0n;
        this.engine.blackQueens = 0n;
        this.engine.blackKing = 0n;
        
        // Parse piece placement
        const ranks = piecePlacement.split('/').reverse(); // FEN is rank 8 to 1, we need 0 to 7
        for (let rank = 0; rank < 8; rank++) {
            let file = 0;
            for (const char of ranks[rank]) {
                if (char >= '1' && char <= '8') {
                    file += parseInt(char); // Empty squares
                } else {
                    const square = rank * 8 + file;
                    const squareBit = 1n << BigInt(square);
                    
                    switch (char) {
                        case 'P': this.engine.whitePawns |= squareBit; break;
                        case 'N': this.engine.whiteKnights |= squareBit; break;
                        case 'B': this.engine.whiteBishops |= squareBit; break;
                        case 'R': this.engine.whiteRooks |= squareBit; break;
                        case 'Q': this.engine.whiteQueens |= squareBit; break;
                        case 'K': this.engine.whiteKing |= squareBit; break;
                        case 'p': this.engine.blackPawns |= squareBit; break;
                        case 'n': this.engine.blackKnights |= squareBit; break;
                        case 'b': this.engine.blackBishops |= squareBit; break;
                        case 'r': this.engine.blackRooks |= squareBit; break;
                        case 'q': this.engine.blackQueens |= squareBit; break;
                        case 'k': this.engine.blackKing |= squareBit; break;
                    }
                    file++;
                }
            }
        }
        
        // Update composite bitboards
        this.engine.updateCompositeBitboards();
        
        // Active color
        this.engine.whiteToMove = (activeColor === 'w');
        
        // Castling rights
        this.engine.castleRights = 0;
        if (castling.includes('K')) this.engine.castleRights |= 0b1000;
        if (castling.includes('Q')) this.engine.castleRights |= 0b0100;
        if (castling.includes('k')) this.engine.castleRights |= 0b0010;
        if (castling.includes('q')) this.engine.castleRights |= 0b0001;
        
        // En passant
        if (enPassant !== '-') {
            this.engine.enPassantSquare = this.engine.algebraicToSquare(enPassant);
        } else {
            this.engine.enPassantSquare = -1;
        }
        
        // Move counters
        this.engine.halfmoveClock = halfmove;
        this.engine.fullmoveNumber = fullmove;
        
        // Clear history
        this.engine.moveHistory = [];
        this.engine.stateHistory = [];
    }
    
    /**
     * Get FEN string from current position
     */
    getFEN() {
        let fen = '';
        
        // Piece placement (rank 8 to 1)
        for (let rank = 7; rank >= 0; rank--) {
            let emptyCount = 0;
            for (let file = 0; file < 8; file++) {
                const square = rank * 8 + file;
                const piece = this.engine.getPieceAt(square);
                
                if (piece) {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    const pieceChar = piece.piece.toUpperCase();
                    fen += piece.color === 'w' ? pieceChar : pieceChar.toLowerCase();
                } else {
                    emptyCount++;
                }
            }
            if (emptyCount > 0) {
                fen += emptyCount;
            }
            if (rank > 0) {
                fen += '/';
            }
        }
        
        // Active color
        fen += ' ' + (this.engine.whiteToMove ? 'w' : 'b');
        
        // Castling rights
        let castling = '';
        if (this.engine.castleRights & 0b1000) castling += 'K';
        if (this.engine.castleRights & 0b0100) castling += 'Q';
        if (this.engine.castleRights & 0b0010) castling += 'k';
        if (this.engine.castleRights & 0b0001) castling += 'q';
        fen += ' ' + (castling || '-');
        
        // En passant
        if (this.engine.enPassantSquare >= 0) {
            fen += ' ' + this.engine.squareToAlgebraic(this.engine.enPassantSquare);
        } else {
            fen += ' -';
        }
        
        // Move counters
        fen += ' ' + this.engine.halfmoveClock;
        fen += ' ' + this.engine.fullmoveNumber;
        
        return fen;
    }
    
    /**
     * Get moves in Chess.js format { verbose: true }
     */
    getMoves(capturesOnly = false) {
        const moves = this.engine.generateMoves(capturesOnly, false);
        
        // Convert to Chess.js format
        return moves.map(move => ({
            from: this.engine.squareToAlgebraic(move.from),
            to: this.engine.squareToAlgebraic(move.to),
            piece: move.piece,
            captured: move.captured,
            promotion: move.promotion,
            flags: move.flags,
            san: this.moveToSAN(move), // We'll compute this
            color: this.engine.whiteToMove ? 'w' : 'b'
        }));
    }
    
    /**
     * Make a move (accepts Chess.js move object or simple {from, to})
     */
    makeMove(move) {
        // Convert algebraic notation to square indices
        const from = typeof move.from === 'string' ? 
            this.engine.algebraicToSquare(move.from) : move.from;
        const to = typeof move.to === 'string' ? 
            this.engine.algebraicToSquare(move.to) : move.to;
        
        // Find the matching move in legal moves
        const legalMoves = this.engine.generateMoves();
        const matchingMove = legalMoves.find(m => m.from === from && m.to === to && 
            (!move.promotion || m.promotion === move.promotion));
        
        if (!matchingMove) {
            return null; // Illegal move
        }
        
        this.engine.makeMove(matchingMove);
        return matchingMove;
    }
    
    /**
     * Undo last move
     */
    undo() {
        this.engine.unmakeMove();
    }
    
    /**
     * Check if in check
     */
    inCheck() {
        return this.engine.inCheck();
    }
    
    /**
     * Check if game over
     */
    gameOver() {
        const result = this.engine.isGameOver();
        return result.gameOver;
    }
    
    /**
     * Check if checkmate
     */
    inCheckmate() {
        const result = this.engine.isGameOver();
        return result.checkmate || false;
    }
    
    /**
     * Check if stalemate
     */
    inStalemate() {
        const result = this.engine.isGameOver();
        return result.stalemate || false;
    }
    
    /**
     * Check if draw
     */
    inDraw() {
        const result = this.engine.isGameOver();
        return result.draw || false;
    }
    
    /**
     * Get current turn
     */
    turn() {
        return this.engine.whiteToMove ? 'w' : 'b';
    }
    
    /**
     * Get board as 2D array (for evaluation)
     */
    board() {
        const board = [];
        for (let rank = 0; rank < 8; rank++) {
            const row = [];
            for (let file = 0; file < 8; file++) {
                const square = rank * 8 + file;
                const piece = this.engine.getPieceAt(square);
                row.push(piece ? { type: piece.piece, color: piece.color } : null);
            }
            board.push(row);
        }
        return board;
    }
    
    /**
     * Convert move to SAN (Standard Algebraic Notation)
     * Simplified version - can be enhanced
     */
    moveToSAN(move) {
        let san = '';
        
        // Piece prefix (except pawns)
        if (move.piece !== 'p') {
            san += move.piece.toUpperCase();
        }
        
        // From square (if needed for disambiguation - simplified)
        // In full implementation, check for ambiguity
        
        // Capture notation
        if (move.captured) {
            if (move.piece === 'p') {
                san += this.engine.squareToAlgebraic(move.from)[0]; // File letter
            }
            san += 'x';
        }
        
        // To square
        san += this.engine.squareToAlgebraic(move.to);
        
        // Promotion
        if (move.promotion) {
            san += '=' + move.promotion.toUpperCase();
        }
        
        // Castling special case
        if (move.flags === 'castle-kingside') {
            return 'O-O';
        }
        if (move.flags === 'castle-queenside') {
            return 'O-O-O';
        }
        
        // Check/checkmate (would need to make move, check, then unmake)
        // Simplified: skip for now
        
        return san;
    }
}

