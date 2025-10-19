// Lichess PGN Parser - Handles the specific format from Lichess database
class LichessPGNParser {
    constructor() {
        this.gameDatabase = new Map();
        this.minGames = 3; // Lower threshold for more data
        this.maxDepth = 15; // Shorter depth for faster processing
        this.processedGames = 0;
        this.maxGames = 10000; // Limit for browser performance
    }

    // Parse Lichess PGN data in chunks to avoid memory issues
    async parseLichessPGN(pgnText, progressCallback = null) {
        console.log('🔄 Starting Lichess PGN parsing...');
        
        // Split into individual games
        const games = this.splitLichessGames(pgnText);
        console.log(`📊 Found ${games.length} games to process`);
        
        // Limit games for browser performance
        const gamesToProcess = games.slice(0, this.maxGames);
        console.log(`🎯 Processing first ${gamesToProcess.length} games`);
        
        let processedCount = 0;
        
        for (const game of gamesToProcess) {
            this.processLichessGame(game);
            processedCount++;
            
            // Update progress every 100 games
            if (processedCount % 100 === 0 && progressCallback) {
                const progress = (processedCount / gamesToProcess.length) * 100;
                progressCallback(progress, processedCount, gamesToProcess.length);
            }
            
            // Yield to browser every 50 games
            if (processedCount % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        console.log(`✅ Processed ${processedCount} games`);
        this.filterWeakMoves();
        return this.generateOpeningBook();
    }

    // Split Lichess PGN text into individual games
    splitLichessGames(pgnText) {
        const games = [];
        const gameBlocks = pgnText.split(/\n\n\[Event/);
        
        for (let i = 0; i < gameBlocks.length; i++) {
            let gameText = gameBlocks[i];
            if (i > 0) {
                gameText = '[Event' + gameText;
            }
            
            const moves = this.extractLichessMoves(gameText);
            if (moves.length >= 4) { // Only games with at least 2 moves each side
                games.push(moves);
            }
        }
        
        return games;
    }

    // Extract moves from Lichess PGN format
    extractLichessMoves(gameText) {
        const moves = [];
        const lines = gameText.split('\n');
        
        // Find the moves section (usually the last non-empty line)
        let moveText = '';
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line && !line.startsWith('[') && !line.startsWith('1-0') && !line.startsWith('0-1') && !line.startsWith('1/2-1/2')) {
                moveText = line;
                break;
            }
        }
        
        if (!moveText) return moves;
        
        // Parse moves - Lichess format has moves like "1. d4 d5 2. c4 Nf6"
        const moveRegex = /(\d+\.\s*)?([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?)/g;
        let match;
        
        while ((match = moveRegex.exec(moveText)) !== null) {
            const move = match[2].replace(/[+#]/, ''); // Remove check/checkmate symbols
            if (move && move.length >= 2 && this.isValidMove(move)) {
                moves.push(move);
            }
        }
        
        return moves;
    }

    // Basic move validation
    isValidMove(move) {
        // Basic SAN move validation
        const validPattern = /^[NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](=[NBRQ])?$/;
        return validPattern.test(move);
    }

    // Process a single Lichess game
    processLichessGame(moves) {
        if (moves.length < 4) return;
        
        let moveHistory = [];
        
        for (let i = 0; i < Math.min(moves.length, this.maxDepth); i++) {
            const move = moves[i];
            moveHistory.push(move);
            
            // Use move history as position key
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

    // Filter out weak moves
    filterWeakMoves() {
        console.log('🔍 Filtering weak moves...');
        let removedPositions = 0;
        let removedMoves = 0;
        
        for (const [positionKey, data] of this.gameDatabase.entries()) {
            if (data.totalGames < this.minGames) {
                this.gameDatabase.delete(positionKey);
                removedPositions++;
                continue;
            }
            
            // Filter moves that appear in less than 15% of games
            const minFrequency = Math.max(1, Math.floor(data.totalGames * 0.15));
            
            for (let i = data.moves.length - 1; i >= 0; i--) {
                if (data.frequencies[i] < minFrequency) {
                    data.moves.splice(i, 1);
                    data.frequencies.splice(i, 1);
                    removedMoves++;
                }
            }
            
            if (data.moves.length === 0) {
                this.gameDatabase.delete(positionKey);
                removedPositions++;
            }
        }
        
        console.log(`🗑️ Removed ${removedPositions} weak positions and ${removedMoves} weak moves`);
    }

    // Generate opening book
    generateOpeningBook() {
        const openingBook = {
            white: [],
            black: []
        };
        
        for (const [positionKey, data] of this.gameDatabase.entries()) {
            const moves = positionKey.split(' ');
            const isWhite = moves.length % 2 === 0; // Even moves = black's turn
            
            // Add the most popular moves from this position
            for (let i = 0; i < data.moves.length; i++) {
                const move = data.moves[i];
                const frequency = data.frequencies[i];
                
                // Create opening line
                const openingLine = positionKey + ' ' + move;
                
                if (isWhite) {
                    openingBook.white.push(openingLine);
                } else {
                    openingBook.black.push(openingLine);
                }
            }
        }
        
        console.log(`📚 Generated opening book: ${openingBook.white.length} white lines, ${openingBook.black.length} black lines`);
        return openingBook;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LichessPGNParser;
}


