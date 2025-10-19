// Opening Book Trainer - Based on Sebastian Lague's approach
class OpeningBookTrainer {
    constructor() {
        this.gameDatabase = new Map(); // position -> {moves: [], frequencies: []}
        this.minGames = 5; // Minimum games a position must appear in
        this.maxDepth = 20; // Maximum opening book depth
    }

    // Parse PGN data and build opening book
    parsePGNData(pgnText) {
        const games = this.splitPGNGames(pgnText);
        console.log(`Found ${games.length} games to process`);
        
        let processedGames = 0;
        for (const game of games) {
            this.processGame(game);
            processedGames++;
            
            if (processedGames % 1000 === 0) {
                console.log(`Processed ${processedGames} games...`);
            }
        }
        
        console.log(`Finished processing ${processedGames} games`);
        this.filterWeakMoves();
        return this.generateOpeningBook();
    }

    // Split PGN text into individual games
    splitPGNGames(pgnText) {
        const games = [];
        const gameBlocks = pgnText.split(/\n\n\[Event/);
        
        for (let i = 0; i < gameBlocks.length; i++) {
            let gameText = gameBlocks[i];
            if (i > 0) {
                gameText = '[Event' + gameText;
            }
            
            const moves = this.extractMoves(gameText);
            if (moves.length > 0) {
                games.push(moves);
            }
        }
        
        return games;
    }

    // Extract moves from PGN game text
    extractMoves(gameText) {
        const moves = [];
        const lines = gameText.split('\n');
        let moveText = '';
        
        // Find the moves section
        for (const line of lines) {
            if (line.trim() && !line.startsWith('[')) {
                moveText += line + ' ';
            }
        }
        
        // Parse moves (simplified - handles basic SAN notation)
        const moveRegex = /(\d+\.\s*)?([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?)/g;
        let match;
        
        while ((match = moveRegex.exec(moveText)) !== null) {
            const move = match[2].replace(/[+#]/, ''); // Remove check/checkmate symbols
            if (move && move.length >= 2) {
                moves.push(move);
            }
        }
        
        return moves;
    }

    // Process a single game and update position statistics
    processGame(moves) {
        if (moves.length < 4) return; // Skip very short games
        
        // Simulate the game to build position database
        // Use a simple position tracking instead of full Chess.js
        let position = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        let moveHistory = [];
        
        for (let i = 0; i < Math.min(moves.length, this.maxDepth); i++) {
            const move = moves[i];
            moveHistory.push(move);
            
            // Use move history as position key (simpler approach)
            const positionKey = moveHistory.join(' ');
            
            if (!this.gameDatabase.has(positionKey)) {
                this.gameDatabase.set(positionKey, {
                    moves: [],
                    frequencies: [],
                    totalGames: 0
                });
            }
            
            const positionData = this.gameDatabase.get(positionKey);
            positionData.totalGames++;
            
            // Add next move if it exists
            if (i + 1 < moves.length) {
                const nextMove = moves[i + 1];
                const moveIndex = positionData.moves.indexOf(nextMove);
                
                if (moveIndex === -1) {
                    positionData.moves.push(nextMove);
                    positionData.frequencies.push(1);
                } else {
                    positionData.frequencies[moveIndex]++;
                }
            }
        }
    }

    // Filter out moves that appear in too few games
    filterWeakMoves() {
        for (const [positionKey, data] of this.gameDatabase.entries()) {
            if (data.totalGames < this.minGames) {
                this.gameDatabase.delete(positionKey);
                continue;
            }
            
            // Filter moves that appear in less than 10% of games
            const minFrequency = Math.max(1, Math.floor(data.totalGames * 0.1));
            
            for (let i = data.moves.length - 1; i >= 0; i--) {
                if (data.frequencies[i] < minFrequency) {
                    data.moves.splice(i, 1);
                    data.frequencies.splice(i, 1);
                }
            }
            
            // Remove positions with no valid moves
            if (data.moves.length === 0) {
                this.gameDatabase.delete(positionKey);
            }
        }
    }

    // Generate opening book for the bot
    generateOpeningBook() {
        const openingBook = {
            white: [],
            black: []
        };
        
        // Convert position database to opening book format
        for (const [positionKey, data] of this.gameDatabase.entries()) {
            // Determine if it's white or black's turn based on move count
            const moves = positionKey.split(' ');
            const isWhite = moves.length % 2 === 0; // Even number of moves = black's turn, odd = white's turn
            
            // The position key is already the move sequence
            const line = positionKey;
            
            // Add the most popular moves from this position
            for (let i = 0; i < data.moves.length; i++) {
                const move = data.moves[i];
                const frequency = data.frequencies[i];
                
                // Create opening line: current position + next move
                const openingLine = line + ' ' + move;
                
                if (isWhite) {
                    openingBook.white.push(openingLine);
                } else {
                    openingBook.black.push(openingLine);
                }
            }
        }
        
        console.log(`Generated opening book: ${openingBook.white.length} white lines, ${openingBook.black.length} black lines`);
        return openingBook;
    }

    // Get the best move from opening book for a position
    getBestMove(chess, openingBook) {
        const history = chess.history();
        const currentLine = history.join(' ');
        const isWhite = chess.turn() === 'w';
        const book = isWhite ? openingBook.white : openingBook.black;
        
        // Find matching lines
        const matchingLines = book.filter(line => 
            line.startsWith(currentLine) && line.length > currentLine.length
        );
        
        if (matchingLines.length === 0) {
            return null;
        }
        
        // Choose the most popular move (simplified - could be improved with frequency data)
        const chosenLine = matchingLines[Math.floor(Math.random() * matchingLines.length)];
        const lineMoves = chosenLine.split(' ');
        const nextMove = lineMoves[history.length];
        
        // Validate the move is legal
        const legalMoves = chess.moves();
        const foundMove = legalMoves.find(m => 
            m === nextMove || m.replace(/[+#]/, '') === nextMove
        );
        
        return foundMove || null;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OpeningBookTrainer;
}
