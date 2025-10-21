// UI Management for Tech Chess
class ChessUI {
    constructor() {
        this.chessEngine = null;
        this.bot = null;
        this.gameSettings = {
            bot: 'martina',
            playerColor: 'white',
            pieceStyle: 'classic',
            boardTheme: 'brown',
            difficulty: 'just-for-fun'
        };
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.takebackCount = 0;
        this.maxTakebacks = 3;
        this.isDragging = false;
        this.dragElement = null;
        this.dragOffset = { x: 0, y: 0 };
        this.dragStartSquare = null;
        this.currentHoverSquare = null;
        this.initialized = false;
        
        // Move timing
        this.moveStartTime = Date.now();
        this.moveTimes = [];
        
        // Right-click annotations
        this.highlightedSquares = new Set();
        this.arrows = [];
        this.isRightDragging = false;
        this.rightDragStart = null;
        
        // Bot thinking state (for UI responsiveness)
        this.isBotThinking = false;
        
        // Bind mouse event handlers
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleRightClick = this.handleRightClick.bind(this);
        this.handleRightMouseDown = this.handleRightMouseDown.bind(this);
        this.handleRightMouseMove = this.handleRightMouseMove.bind(this);
        this.handleRightMouseUp = this.handleRightMouseUp.bind(this);
    }

    // Initialize the UI
    async initialize() {
        if (this.initialized) {
            console.warn('ChessUI already initialized, skipping...');
            return;
        }
        this.initialized = true;
        this.setupEventListeners();
        
        // Load saved settings first
        await this.loadSettings();
        
        // Check for saved game state
        const savedGame = await this.loadGameState();
        if (savedGame) {
            console.log('📂 Restoring saved game...');
            this.restoreGame(savedGame);
        } else {
            this.showMainMenu();
        }
    }
    
    // Update the move list display
    updateMoveList() {
        const moveList = document.getElementById('move-list');
        if (!moveList) return;
        
        const history = this.chessEngine.history({ verbose: true });
        moveList.innerHTML = '';
        
        // Get max time for bar scaling
        const maxTime = Math.max(...this.moveTimes, 10000); // At least 10 seconds for scaling
        
        // Group moves by pairs (white and black)
        for (let i = 0; i < history.length; i += 2) {
            const moveRow = document.createElement('div');
            moveRow.className = 'move-row';
            
            const moveNumber = document.createElement('div');
            moveNumber.className = 'move-number';
            moveNumber.textContent = `${Math.floor(i / 2) + 1}.`;
            moveRow.appendChild(moveNumber);
            
            // White's move
            const whiteMove = this.createMoveElement(history[i]);
            moveRow.appendChild(whiteMove);
            
            // Black's move (if exists)
            if (i + 1 < history.length) {
                const blackMove = this.createMoveElement(history[i + 1]);
                moveRow.appendChild(blackMove);
                
                // Add time info for both moves
                const timeInfo = this.createTimeInfo(
                    this.moveTimes[i], 
                    this.moveTimes[i + 1], 
                    maxTime
                );
                moveRow.appendChild(timeInfo);
            } else {
                // Empty space for black's move if it doesn't exist
                const emptyMove = document.createElement('div');
                emptyMove.className = 'move-container';
                moveRow.appendChild(emptyMove);
            }
            
            moveList.appendChild(moveRow);
        }
        
        // Auto-scroll to bottom
        moveList.scrollTop = moveList.scrollHeight;
    }
    
    // Create a single move element with piece symbol and notation
    createMoveElement(move) {
        const moveItem = document.createElement('div');
        moveItem.className = 'move-item';
        
        // Get piece symbol
        const pieceSymbol = this.getPieceSymbol(move.piece, move.color);
        const pieceSpan = document.createElement('span');
        pieceSpan.className = 'piece-symbol';
        pieceSpan.textContent = pieceSymbol;
        moveItem.appendChild(pieceSpan);
        
        // Get move notation (simplified algebraic notation)
        const notation = document.createElement('span');
        notation.className = 'move-notation';
        notation.textContent = move.san;
        moveItem.appendChild(notation);
        
        return moveItem;
    }
    
    // Create time info for both white and black moves
    createTimeInfo(whiteTime, blackTime, maxTime) {
        const timeContainer = document.createElement('div');
        timeContainer.className = 'move-times-container';
        
        // Format time helper
        const formatTime = (time) => {
            if (time < 1000) {
                return `${(time / 1000).toFixed(1)}s`;
            } else if (time < 60000) {
                return `${(time / 1000).toFixed(1)}s`;
            } else {
                const minutes = Math.floor(time / 60000);
                const seconds = Math.floor((time % 60000) / 1000);
                return `${minutes}m ${seconds}s`;
            }
        };
        
        // White time (left)
        const whiteTimeDiv = document.createElement('div');
        whiteTimeDiv.className = 'move-time-item';
        
        const whiteText = document.createElement('span');
        whiteText.className = 'time-text';
        whiteText.textContent = formatTime(whiteTime);
        whiteTimeDiv.appendChild(whiteText);
        
        const whiteBar = document.createElement('div');
        whiteBar.className = 'time-bar';
        const whiteFill = document.createElement('div');
        whiteFill.className = 'time-bar-fill white';
        const whitePercentage = Math.min((whiteTime / maxTime) * 100, 100);
        whiteFill.style.width = `${whitePercentage}%`;
        whiteBar.appendChild(whiteFill);
        whiteTimeDiv.appendChild(whiteBar);
        
        timeContainer.appendChild(whiteTimeDiv);
        
        // Black time (right)
        const blackTimeDiv = document.createElement('div');
        blackTimeDiv.className = 'move-time-item';
        
        const blackText = document.createElement('span');
        blackText.className = 'time-text';
        blackText.textContent = formatTime(blackTime);
        blackTimeDiv.appendChild(blackText);
        
        const blackBar = document.createElement('div');
        blackBar.className = 'time-bar';
        const blackFill = document.createElement('div');
        blackFill.className = 'time-bar-fill black';
        const blackPercentage = Math.min((blackTime / maxTime) * 100, 100);
        blackFill.style.width = `${blackPercentage}%`;
        blackBar.appendChild(blackFill);
        blackTimeDiv.appendChild(blackBar);
        
        timeContainer.appendChild(blackTimeDiv);
        
        return timeContainer;
    }
    
    // Get Unicode piece symbol
    getPieceSymbol(piece, color) {
        const symbols = {
            'k': color === 'w' ? '♔' : '♚',
            'q': color === 'w' ? '♕' : '♛',
            'r': color === 'w' ? '♖' : '♜',
            'b': color === 'w' ? '♗' : '♝',
            'n': color === 'w' ? '♘' : '♞',
            'p': color === 'w' ? '♙' : '♟'
        };
        return symbols[piece] || '';
    }
    
    // Record move time
    recordMoveTime() {
        const now = Date.now();
        const timeTaken = now - this.moveStartTime;
        this.moveTimes.push(timeTaken);
        this.moveStartTime = now;
    }

    // Setup event listeners
    setupEventListeners() {
        // Main menu events
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        
        // Color selection
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectColor(e.target.dataset.color));
        });
        
        // Piece style selection
        document.querySelectorAll('.piece-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectPieceStyle(e.target.dataset.style));
        });
        
        // Board theme selection
        document.querySelectorAll('.board-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectBoardTheme(e.target.dataset.theme));
        });
        
        // Difficulty selection
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectDifficulty(e.target.dataset.difficulty));
        });
        
        // Game control events
        document.getElementById('copy-pgn').addEventListener('click', () => this.copyPGN());
        document.getElementById('takeback-btn').addEventListener('click', () => this.takebackMove());
        document.getElementById('resign-btn').addEventListener('click', () => this.resignGame());
    }

    // Show main menu
    showMainMenu() {
        document.getElementById('main-menu').classList.add('active');
        document.getElementById('game-screen').classList.remove('active');
        this.clearGameState(); // Clear saved game when returning to menu
        this.resetGameSettings();
    }

    // Reset game settings to defaults (preserve visual settings)
    resetGameSettings() {
        // Preserve visual settings (pieceStyle and boardTheme)
        const savedPieceStyle = this.gameSettings?.pieceStyle || 'classic';
        const savedBoardTheme = this.gameSettings?.boardTheme || 'brown';
        
        this.gameSettings = {
            bot: 'martina',
            playerColor: 'white',
            pieceStyle: savedPieceStyle,
            boardTheme: savedBoardTheme,
            difficulty: 'just-for-fun'
        };
        this.updateMenuUI();
    }

    // Update menu UI to reflect current settings
    updateMenuUI() {
        // Update color selection
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === this.gameSettings.playerColor);
        });
        
        // Update piece style
        document.querySelectorAll('.piece-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.style === this.gameSettings.pieceStyle);
        });
        
        // Update board theme
        document.querySelectorAll('.board-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === this.gameSettings.boardTheme);
        });
        
        // Update difficulty
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.difficulty === this.gameSettings.difficulty);
        });
    }

    // Select player color
    selectColor(color) {
        this.gameSettings.playerColor = color;
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === color);
        });
    }

    // Select piece style
    selectPieceStyle(style) {
        this.gameSettings.pieceStyle = style;
        document.querySelectorAll('.piece-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.style === style);
        });
        this.saveSettings();
    }

    // Select board theme
    selectBoardTheme(theme) {
        this.gameSettings.boardTheme = theme;
        document.querySelectorAll('.board-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
        this.saveSettings();
    }

    // Select difficulty
    selectDifficulty(difficulty) {
        this.gameSettings.difficulty = difficulty;
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.difficulty === difficulty);
        });
        
        // Update takeback settings
        this.maxTakebacks = difficulty === 'too-easy' ? Infinity : 
                           difficulty === 'just-for-fun' ? 3 : 0;
        
        this.saveSettings();
    }

    // Start the game
    startGame() {
        // Initialize chess.js engine
        this.chessEngine = new Chess();
        
        // Initialize bot (use Chess.js version - it's faster for now)
        // Bitboard version is experimental - needs optimized legality checking
        this.bot = new MartinaBot(this.gameSettings.difficulty);
        
        // Apply performance configuration
        if (typeof applyPerformanceConfig === 'function') {
            applyPerformanceConfig(this.bot, BotPerformanceConfig);
        }
        
        // Reset game state
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.takebackCount = 0;
        this.isHandlingPieceClick = false; // Track piece click handling
        
        // Reset move timing
        this.moveStartTime = Date.now();
        this.moveTimes = [];
        
        // Show game screen
        document.getElementById('main-menu').classList.remove('active');
        document.getElementById('game-screen').classList.add('active');
        
        // Clear move list
        const moveList = document.getElementById('move-list');
        if (moveList) moveList.innerHTML = '';
        
        // Create board
        this.createBoard();
        this.updateGameUI();
        
        // If player is black, let bot move first
        if (this.gameSettings.playerColor === 'black') {
            setTimeout(() => this.makeBotMove(), 500);
        }
    }

    // Create the chess board
    createBoard() {
        const board = document.getElementById('chess-board');
        board.innerHTML = '';
        console.log('🎨 Creating board with settings:', this.gameSettings);
        board.className = `chess-board board-${this.gameSettings.boardTheme} piece-${this.gameSettings.pieceStyle}`;
        
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const square = document.createElement('div');
                square.className = 'chess-square';
                square.classList.add((file + rank) % 2 === 0 ? 'light' : 'dark');
                square.dataset.file = file;
                square.dataset.rank = rank;
                
                // Add notation labels
                square.dataset.fileLetter = String.fromCharCode(97 + file); // a-h
                square.dataset.rankNumber = 8 - rank; // 8-1
                
                // Add click event
                square.addEventListener('click', (e) => this.handleSquareClick(e));
                
                // Add mouse enter for drag hover effects
                square.addEventListener('mouseenter', (e) => this.handleSquareHover(e));
                
                // Add right-click events for annotations
                square.addEventListener('contextmenu', (e) => this.handleRightClick(e));
                square.addEventListener('mousedown', (e) => {
                    if (e.button === 2) this.handleRightMouseDown(e);
                });
                
                board.appendChild(square);
            }
        }
        
        this.updateBoard();
    }

    // Update the board display
    updateBoard() {
        const board = this.chessEngine.board();
        
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const square = getSquareElement(file, rank);
                const piece = board[rank][file];
                
                // Clear existing piece
                const existingPiece = square.querySelector('.chess-piece');
                if (existingPiece) {
                    existingPiece.remove();
                }
                
                // Add piece if present
                if (piece) {
                    const pieceElement = document.createElement('div');
                    const pieceNotation = piece.color + piece.type.toUpperCase();
                    pieceElement.className = `chess-piece ${pieceNotation}`;
                    
                    // Set piece background image
                    const imageUrl = this.getPieceImageUrl(pieceNotation);
                    pieceElement.style.backgroundImage = `url(${imageUrl})`;
                    pieceElement.style.backgroundSize = 'contain';
                    pieceElement.style.backgroundRepeat = 'no-repeat';
                    pieceElement.style.backgroundPosition = 'center';
                    
                    // Add mouse events for both dragging and annotations
                    pieceElement.addEventListener('mousedown', (e) => {
                        if (e.button === 0) {
                            // Left click - handle piece dragging
                            this.handlePieceMouseDown(e);
                        } else if (e.button === 2) {
                            // Right click - handle annotations
                            this.handleRightMouseDown(e);
                        }
                    });
                    
                    // Prevent context menu on pieces
                    pieceElement.addEventListener('contextmenu', (e) => this.handleRightClick(e));
                    
                    square.appendChild(pieceElement);
                }
            }
        }
        
        this.updateHighlights();
        this.updateMoveList();
    }

    // Handle square click
    handleSquareClick(event) {
        console.log(`🖱️ handleSquareClick called, target:`, event.target.className);
        
        // If we just handled a piece click, ignore this square click
        if (this.isHandlingPieceClick) {
            console.log(`   → Returning early: piece was just clicked`);
            this.isHandlingPieceClick = false;
            return;
        }
        
        const square = event.currentTarget;
        const file = parseInt(square.dataset.file);
        const rank = parseInt(square.dataset.rank);
        const squareNotation = coordsToAlgebraic(file, rank);
        
        const piece = this.chessEngine.get(squareNotation);
        const isPlayerTurn = this.chessEngine.turn() === this.gameSettings.playerColor[0];
        
        // Clear arrows on any click
        if (this.arrows.length > 0) {
            this.clearAnnotations();
        }
        
        // Only allow moves on player's turn
        if (!isPlayerTurn) {
            return;
        }
        
        // Don't handle square click if clicking on YOUR OWN piece (piece mousedown will handle it)
        // BUT allow clicking on enemy pieces for captures
        if (event.target.classList.contains('chess-piece') && 
            piece && piece.color === this.gameSettings.playerColor[0]) {
            console.log(`   → Returning early: clicked on your own piece`);
            return;
        }
        
        if (this.selectedSquare) {
            // Check if clicking on the same square - deselect if so
            if (this.selectedSquare.file === file && this.selectedSquare.rank === rank) {
                console.log(`   → Clicked on same square - deselecting`);
                this.clearSelection();
                return;
            }
            
            // Try to make a move
            const fromNotation = coordsToAlgebraic(this.selectedSquare.file, this.selectedSquare.rank);
            const move = this.chessEngine.move({
                from: fromNotation,
                to: squareNotation,
                promotion: 'q' // Always promote to queen for now
            });
            
            if (move) {
                this.lastMove = { from: this.selectedSquare, to: { file, rank } };
                this.recordMoveTime(); // Record time for this move
                this.clearSelection();
                
                // Clear annotations after making a move
                if (this.highlightedSquares.size > 0 || this.arrows.length > 0) {
                    this.clearAnnotations();
                }
                
                // Animate the move
                this.animatePieceMove(
                    this.lastMove.from.file, 
                    this.lastMove.from.rank,
                    this.lastMove.to.file, 
                    this.lastMove.to.rank
                ).then(() => {
                this.updateBoard();
                this.updateGameUI();
                this.playMoveSound(move); // Play sound after move
                this.saveGameState(); // Save game state after player move
                this.checkGameStatus();
                
                // Bot's turn
                if (this.chessEngine.turn() !== this.gameSettings.playerColor[0]) {
                    setTimeout(() => this.makeBotMove(), 500);
                }
                });
            } else if (piece && piece.color === this.gameSettings.playerColor[0]) {
                // Select new piece
                this.selectSquare(file, rank);
            } else {
                this.clearSelection();
            }
        } else if (piece && piece.color === this.gameSettings.playerColor[0]) {
            // Select piece
            this.selectSquare(file, rank);
        } else {
            // Clicking on empty square with no piece selected - clear annotations
            if (this.highlightedSquares.size > 0 || this.arrows.length > 0) {
                this.clearAnnotations();
            }
        }
    }

    // Select a square
    selectSquare(file, rank) {
        this.clearSelection();
        this.selectedSquare = { file, rank };
        const squareNotation = coordsToAlgebraic(file, rank);
        const moves = this.chessEngine.moves({ square: squareNotation, verbose: true });
        this.legalMoves = moves.map(move => ({
            to: algebraicToCoords(move.to)
        }));
        this.updateHighlights();
    }

    // Clear selection
    clearSelection() {
        if (this.selectedSquare) {
            console.log(`🚫 Clearing selection from ${coordsToAlgebraic(this.selectedSquare.file, this.selectedSquare.rank)}`);
        }
        this.selectedSquare = null;
        this.legalMoves = [];
        this.updateHighlights();
    }

    // Update visual highlights
    updateHighlights() {
        // Clear all highlights
        document.querySelectorAll('.chess-square').forEach(square => {
            square.querySelectorAll('.square-highlight, .legal-move').forEach(el => {
                el.remove();
            });
        });
        
        // Highlight selected square
        if (this.selectedSquare) {
            const square = getSquareElement(this.selectedSquare.file, this.selectedSquare.rank);
            const highlight = document.createElement('div');
            highlight.className = 'square-highlight selected';
            square.appendChild(highlight);
        }
        
        // Show legal moves
        this.legalMoves.forEach(move => {
            const square = getSquareElement(move.to.file, move.to.rank);
            const indicator = document.createElement('div');
            indicator.className = 'legal-move';
            
            // Check if it's a capture (using chess.js get() method with algebraic notation)
            const toSquare = coordsToAlgebraic(move.to.file, move.to.rank);
            const targetPiece = this.chessEngine.get(toSquare);
            if (targetPiece) {
                indicator.classList.add('capture');
            }
            
            square.appendChild(indicator);
        });
        
        // Highlight last move
        if (this.lastMove) {
            const fromSquare = getSquareElement(this.lastMove.from.file, this.lastMove.from.rank);
            const toSquare = getSquareElement(this.lastMove.to.file, this.lastMove.to.rank);
            
            const fromHighlight = document.createElement('div');
            fromHighlight.className = 'square-highlight last-move';
            fromSquare.appendChild(fromHighlight);
            
            const toHighlight = document.createElement('div');
            toHighlight.className = 'square-highlight last-move';
            toSquare.appendChild(toHighlight);
        }
    }

    // Animate piece movement
    async animatePieceMove(fromFile, fromRank, toFile, toRank) {
        return new Promise((resolve) => {
            const fromSquare = getSquareElement(fromFile, fromRank);
            const toSquare = getSquareElement(toFile, toRank);
            
            if (!fromSquare || !toSquare) {
                resolve();
                return;
            }
            
            // Get the piece element
            const piece = fromSquare.querySelector('.chess-piece');
            if (!piece) {
                resolve();
                return;
            }
            
            // Clone the piece for animation
            const animatedPiece = piece.cloneNode(true);
            animatedPiece.classList.add('animating-piece');
            
            // Get positions
            const fromRect = fromSquare.getBoundingClientRect();
            const toRect = toSquare.getBoundingClientRect();
            
            // Set initial position
            animatedPiece.style.position = 'fixed';
            animatedPiece.style.left = fromRect.left + 'px';
            animatedPiece.style.top = fromRect.top + 'px';
            animatedPiece.style.width = fromRect.width + 'px';
            animatedPiece.style.height = fromRect.height + 'px';
            animatedPiece.style.zIndex = '1000';
            animatedPiece.style.pointerEvents = 'none';
            animatedPiece.style.transition = 'all 0.15s ease-out';
            
            // Hide original piece
            piece.style.opacity = '0';
            
            // Add to body
            document.body.appendChild(animatedPiece);
            
            // Trigger animation
            setTimeout(() => {
                animatedPiece.style.left = toRect.left + 'px';
                animatedPiece.style.top = toRect.top + 'px';
            }, 10);
            
            // Clean up after animation
            setTimeout(() => {
                animatedPiece.remove();
                if (piece) piece.style.opacity = '';
                resolve();
            }, 160);
        });
    }

    // Make bot move
    async makeBotMove() {
        if (this.chessEngine.turn() === this.gameSettings.playerColor[0]) return;
        
        try {
            // Save position before bot thinks
            const positionBeforeThinking = this.chessEngine.fen();
            console.log('🤖 Bot starting to think...');
            console.log('📋 Position:', positionBeforeThinking);
            
            // Get all legal moves
            const moves = this.chessEngine.moves({ verbose: true });
            if (moves.length === 0) return;
            
            // Show thinking indicator
            showNotification('Bot is thinking...', 'info', 1000);
            
            // Set flag to prevent UI updates during bot's thinking
            this.isBotThinking = true;
            
            // Create a copy with move history for the bot
            // This prevents the bot from corrupting the actual game state
            const chessCopy = new Chess();
            const moveHistory = this.chessEngine.history({ verbose: true });
            for (const move of moveHistory) {
                chessCopy.move({
                    from: move.from,
                    to: move.to,
                    promotion: move.promotion
                });
            }
            
            // Verify the copy matches the original
            if (chessCopy.fen() !== positionBeforeThinking) {
                console.error('❌ Failed to create accurate copy of position!');
                console.error('Original:', positionBeforeThinking);
                console.error('Copy:', chessCopy.fen());
            }
            
            const bestMove = await this.bot.calculateMove(chessCopy);
            
            // Clear thinking flag
            this.isBotThinking = false;
            
            // Verify our actual position hasn't changed (it shouldn't!)
            const positionAfterThinking = this.chessEngine.fen();
            
            if (positionBeforeThinking !== positionAfterThinking) {
                console.error('❌ ERROR: GAME BOARD CHANGED DURING BOT THINKING!');
                console.error('📋 Before:', positionBeforeThinking);
                console.error('📋 After:', positionAfterThinking);
                showNotification('Error: board state changed', 'error', 3000);
                // Restore the position
                this.chessEngine.load(positionBeforeThinking);
            } else {
                console.log('✓ Game board state preserved correctly');
            }
            
            if (!bestMove) {
                console.warn('Bot returned no move, using random fallback');
                // Fallback to random move if bot fails
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            const move = this.chessEngine.move(randomMove);
                if (move) {
                    console.log('Random fallback move:', move);
                    this.recordMoveTime(); // Record time for bot move
                    const from = algebraicToCoords(move.from);
                    const to = algebraicToCoords(move.to);
                    this.lastMove = { from, to };
                    
                    // Animate the fallback move
                    await this.animatePieceMove(from.file, from.rank, to.file, to.rank);
                    
                    // Play sound after fallback move
                    this.playMoveSound(move);
                }
            } else {
                // Make the bot's chosen move
                console.log('Bot chose move:', bestMove);
                const move = this.chessEngine.move(bestMove);
            if (move) {
                    console.log('Move executed:', move);
                    this.recordMoveTime(); // Record time for bot move
                const from = algebraicToCoords(move.from);
                const to = algebraicToCoords(move.to);
                this.lastMove = { from, to };
                    
                    // Animate the bot's move
                    await this.animatePieceMove(from.file, from.rank, to.file, to.rank);
                    
                    // Play sound after bot move
                    this.playMoveSound(move);
                } else {
                    console.error('Failed to execute bot move:', bestMove);
                    showNotification('Bot move failed', 'error', 3000);
                }
            }
            
                this.updateBoard();
                this.updateGameUI();
                this.saveGameState(); // Save game state after bot move
                this.checkGameStatus();
        } catch (error) {
            this.isBotThinking = false; // Clear flag on error
            console.error('Bot move error:', error);
            console.error('Stack trace:', error.stack);
            showNotification('Bot error occurred', 'error');
        }
    }

    // Handle piece mouse down (chess.com style drag)
    handlePieceMouseDown(event) {
        // Only handle left mouse button
        if (event.button !== 0) {
            return;
        }
        
        event.preventDefault();
        event.stopPropagation(); // Prevent square click from firing
        
        const piece = event.currentTarget;
        const square = piece.parentElement;
        const file = parseInt(square.dataset.file);
        const rank = parseInt(square.dataset.rank);
        const squareNotation = coordsToAlgebraic(file, rank);
        
        const pieceObj = this.chessEngine.get(squareNotation);
        if (!pieceObj || pieceObj.color !== this.gameSettings.playerColor[0]) {
            return;
        }
        
        const isPlayerTurn = this.chessEngine.turn() === this.gameSettings.playerColor[0];
        
        // Only allow interaction on player's turn
        if (!isPlayerTurn) {
            return;
        }
        
        // Clear arrows on any piece click
        if (this.arrows.length > 0) {
            this.clearAnnotations();
        }
        
        // Check if this piece was already selected before we clicked it
        const wasAlreadySelected = this.selectedSquare && 
            this.selectedSquare.file === file && 
            this.selectedSquare.rank === rank;
        
        // Select the piece to show legal moves
        console.log(`✅ Selecting piece at ${coordsToAlgebraic(file, rank)}, wasAlreadySelected: ${wasAlreadySelected}`);
        this.selectSquare(file, rank);
        
        // Start dragging
        this.isDragging = true;
        this.dragElement = piece;
        this.dragStartSquare = { file, rank };
        this.pieceWasAlreadySelected = wasAlreadySelected; // Track for mouseup
        this.hasDraggedPiece = false; // Track if piece actually moved
        
        // Get piece dimensions before changing position
        const rect = piece.getBoundingClientRect();
        const originalWidth = rect.width;
        const originalHeight = rect.height;
        
        // Center the piece on cursor (chess.com style)
        this.dragOffset = {
            x: originalWidth / 2,
            y: originalHeight / 2
        };
        
        // Add dragging class (this changes position to fixed)
        piece.classList.add('dragging');
        
        // Set size and center piece on cursor
        piece.style.width = `${originalWidth}px`;
        piece.style.height = `${originalHeight}px`;
        piece.style.left = `${event.clientX - this.dragOffset.x}px`;
        piece.style.top = `${event.clientY - this.dragOffset.y}px`;
        
        // Add global mouse listeners
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    // Handle mouse move during drag
    handleMouseMove(event) {
        if (!this.isDragging || !this.dragElement) return;
        
        event.preventDefault();
        
        // Mark that the piece has actually been dragged
        this.hasDraggedPiece = true;
        
        // Move piece with cursor, maintaining the offset where user clicked
        this.dragElement.style.left = `${event.clientX - this.dragOffset.x}px`;
        this.dragElement.style.top = `${event.clientY - this.dragOffset.y}px`;
    }

    // Handle mouse up (drop)
    handleMouseUp(event) {
        if (!this.isDragging || !this.dragElement) return;
        
        event.preventDefault();
        
        // Remove global listeners
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        
        // Only process if the piece was actually dragged (mouse moved)
        // If not dragged, handleSquareClick will handle it
        const wasActuallyDragged = this.hasDraggedPiece;
        
        // Find which square we dropped on
        const elements = document.elementsFromPoint(event.clientX, event.clientY);
        const targetSquare = elements.find(el => el.classList.contains('chess-square'));
        
        if (targetSquare && this.dragStartSquare && wasActuallyDragged) {
            const toFile = parseInt(targetSquare.dataset.file);
            const toRank = parseInt(targetSquare.dataset.rank);
            
            const fromNotation = coordsToAlgebraic(this.dragStartSquare.file, this.dragStartSquare.rank);
            const toNotation = coordsToAlgebraic(toFile, toRank);
            
            const isPlayerTurn = this.chessEngine.turn() === this.gameSettings.playerColor[0];
            
            // Only allow moves on player's turn
            if (!isPlayerTurn) {
                return;
            }
            
            // Try to make the move
            const move = this.chessEngine.move({
                from: fromNotation,
                to: toNotation,
                promotion: 'q'
            });
            
            if (move) {
                this.recordMoveTime(); // Record time for this move
                this.lastMove = { 
                    from: { file: this.dragStartSquare.file, rank: this.dragStartSquare.rank }, 
                    to: { file: toFile, rank: toRank } 
                };
                this.clearSelection();
                this.updateBoard();
                this.updateGameUI();
                this.playMoveSound(move); // Play sound after move
                this.saveGameState(); // Save game state after player move
                this.checkGameStatus();
                
                // Bot's turn
                if (this.chessEngine.turn() !== this.gameSettings.playerColor[0]) {
                    setTimeout(() => this.makeBotMove(), 500);
                }
            }
        }
        
        // Clean up
        this.dragElement.classList.remove('dragging');
        this.dragElement.style.left = '';
        this.dragElement.style.top = '';
        this.dragElement.style.width = '';
        this.dragElement.style.height = '';
        this.dragElement = null;
        
        // Clear hover effects
        document.querySelectorAll('.drag-over-highlight').forEach(el => el.remove());
        
        const isPlayerTurn = this.chessEngine.turn() === this.gameSettings.playerColor[0];
        
        // If wasn't dragged, keep selection for click-to-move
        if (!wasActuallyDragged) {
            console.log(`👆 Click (no drag) - keeping selection. Current selection:`, this.selectedSquare);
            console.log(`   Target square:`, targetSquare ? `${targetSquare.dataset.file},${targetSquare.dataset.rank}` : 'none');
            console.log(`   Drag start:`, this.dragStartSquare);
            // Reset drag state but keep selection
            this.isDragging = false;
            this.hasDraggedPiece = false;
            
            // Set flag to prevent square click from firing
            this.isHandlingPieceClick = true;
            
            if (!targetSquare) {
                // Clicked outside board
                console.log(`   → No target square, clearing selection`);
                this.clearSelection();
                this.updateBoard();
            } else {
                // Check if this piece was already selected before the click - if so, deselect it
                if (this.pieceWasAlreadySelected) {
                    console.log(`   → Clicked same selected piece twice - deselecting`);
                    this.clearSelection();
                    this.updateBoard();
                } else {
                    console.log(`   → Target square found, preserving selection`);
                }
            }
            
            this.dragStartSquare = null;
            this.pieceWasAlreadySelected = false;
            // Otherwise, selection is preserved for completing the move
        } else {
            // Was actually dragged
            this.isDragging = false;
            this.dragStartSquare = null;
            this.hasDraggedPiece = false;
            
            if (!targetSquare) {
                this.clearSelection();
                this.updateBoard();
            }
        }
    }

    // Handle square hover during drag
    handleSquareHover(event) {
        if (!this.isDragging) return;
        
        // Only show hover effects on player's turn (not during bot's turn)
        const isPlayerTurn = this.chessEngine.turn() === this.gameSettings.playerColor[0];
        if (!isPlayerTurn) return;
        
        // Clear previous hover highlight
        document.querySelectorAll('.drag-over-highlight').forEach(el => el.remove());
        
        // Add hover highlight to current square
        const square = event.currentTarget;
        const highlight = document.createElement('div');
        highlight.className = 'square-highlight drag-over drag-over-highlight';
        square.appendChild(highlight);
    }

    // Handle right-click (prevent context menu)
    handleRightClick(event) {
        event.preventDefault();
        return false;
    }

    // Handle right mouse down
    handleRightMouseDown(event) {
        event.preventDefault();
        
        try {
            // Get the square element (might be clicking on piece or square directly)
            let square = event.currentTarget;
            if (square.classList.contains('chess-piece')) {
                square = square.parentElement;
            }
            
            if (!square || !square.dataset) {
                console.error('Invalid square element for right-click');
                return;
            }
            
            const file = parseInt(square.dataset.file);
            const rank = parseInt(square.dataset.rank);
            
            if (isNaN(file) || isNaN(rank)) {
                console.error('Invalid file/rank for right-click:', square.dataset);
                return;
            }
            
            this.isRightDragging = true;
            this.rightDragStart = { file, rank };
            
            // Remove any existing listeners first (safety)
            document.removeEventListener('mousemove', this.handleRightMouseMove);
            document.removeEventListener('mouseup', this.handleRightMouseUp);
            
            // Add global mouse move and up listeners
            document.addEventListener('mousemove', this.handleRightMouseMove);
            document.addEventListener('mouseup', this.handleRightMouseUp);
        } catch (error) {
            console.error('Error in handleRightMouseDown:', error);
            this.isRightDragging = false;
            this.rightDragStart = null;
        }
    }

    // Handle right mouse move (for drawing arrows)
    handleRightMouseMove(event) {
        if (!this.isRightDragging) return;
        // Visual feedback could be added here if desired
    }

    // Handle right mouse up (finalize highlight or arrow)
    handleRightMouseUp(event) {
        if (!this.isRightDragging) return;
        
        try {
            // Remove global listeners
            document.removeEventListener('mousemove', this.handleRightMouseMove);
            document.removeEventListener('mouseup', this.handleRightMouseUp);
            
            // Find target square
            const targetSquare = document.elementFromPoint(event.clientX, event.clientY)?.closest('.chess-square');
            
            if (targetSquare) {
                const endFile = parseInt(targetSquare.dataset.file);
                const endRank = parseInt(targetSquare.dataset.rank);
                const startFile = this.rightDragStart.file;
                const startRank = this.rightDragStart.rank;
                
                // If same square, toggle highlight
                if (startFile === endFile && startRank === endRank) {
                    const squareKey = `${startFile}-${startRank}`;
                    if (this.highlightedSquares.has(squareKey)) {
                        this.highlightedSquares.delete(squareKey);
                    } else {
                        this.highlightedSquares.add(squareKey);
                    }
                } else {
                    // Different square - add or remove arrow
                    const arrowKey = `${startFile}-${startRank}-${endFile}-${endRank}`;
                    const arrowIndex = this.arrows.findIndex(a => 
                        a.startFile === startFile && a.startRank === startRank &&
                        a.endFile === endFile && a.endRank === endRank
                    );
                    
                    if (arrowIndex !== -1) {
                        this.arrows.splice(arrowIndex, 1);
                    } else {
                        this.arrows.push({ startFile, startRank, endFile, endRank });
                    }
                }
                
                this.renderAnnotations();
            }
        } catch (error) {
            console.error('Error in handleRightMouseUp:', error);
        } finally {
            this.isRightDragging = false;
            this.rightDragStart = null;
        }
    }

    // Render all annotations (highlights and arrows)
    renderAnnotations() {
        // Clear existing annotations
        document.querySelectorAll('.square-highlight-red').forEach(el => el.remove());
        
        // Render highlights
        this.highlightedSquares.forEach(squareKey => {
            const [file, rank] = squareKey.split('-').map(Number);
            const square = getSquareElement(file, rank);
            if (square) {
                const highlight = document.createElement('div');
                highlight.className = 'square-highlight-red';
                square.appendChild(highlight);
            }
        });
        
        // Render arrows
        this.drawArrows();
    }

    // Draw arrows using SVG
    drawArrows() {
        // Remove existing SVG if any
        const existingSvg = document.getElementById('arrow-overlay');
        if (existingSvg) existingSvg.remove();
        
        if (this.arrows.length === 0) return;
        
        const board = document.getElementById('chess-board');
        const rect = board.getBoundingClientRect();
        const squareSize = rect.width / 8;
        
        // Create SVG overlay
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'arrow-overlay';
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '15';
        
        // Define arrow marker
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '4');
        marker.setAttribute('markerHeight', '4');
        marker.setAttribute('refX', '1');
        marker.setAttribute('refY', '1.25');
        marker.setAttribute('orient', 'auto');
        
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 4 1.25, 0 2.5');
        polygon.setAttribute('fill', 'rgba(235, 180, 52, 0.8)');
        
        marker.appendChild(polygon);
        defs.appendChild(marker);
        svg.appendChild(defs);
        
        // Draw each arrow
        this.arrows.forEach(arrow => {
            // Calculate direction for offset
            const dx = arrow.endFile - arrow.startFile;
            const dy = arrow.endRank - arrow.startRank;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            // Normalize direction
            const dirX = dx / length;
            const dirY = dy / length;
            
            // Offset from center (35% of square size)
            const offset = squareSize * 0.35;
            
            const startX = (arrow.startFile + 0.5) * squareSize + dirX * offset;
            const startY = (arrow.startRank + 0.5) * squareSize + dirY * offset;
            const endX = (arrow.endFile + 0.5) * squareSize - dirX * offset;
            const endY = (arrow.endRank + 0.5) * squareSize - dirY * offset;
            
            const absDx = Math.abs(arrow.endFile - arrow.startFile);
            const absDy = Math.abs(arrow.endRank - arrow.startRank);
            
            // Check if it's an L-shaped move (knight move pattern)
            const isLShaped = (absDx === 2 && absDy === 1) || (absDx === 1 && absDy === 2);
            
            if (isLShaped) {
                // Draw L-shaped arrow with path
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                
                // Determine the bend point for the L-shape
                let midX, midY;
                if (absDx === 2) {
                    // Horizontal longer, bend horizontally first
                    midX = endX;
                    midY = startY;
                } else {
                    // Vertical longer, bend vertically first
                    midX = startX;
                    midY = endY;
                }
                
                const pathData = `M ${startX} ${startY} L ${midX} ${midY} L ${endX} ${endY}`;
                path.setAttribute('d', pathData);
                path.setAttribute('stroke', 'rgba(235, 180, 52, 0.8)');
                path.setAttribute('stroke-width', '16');
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
                path.setAttribute('fill', 'none');
                path.setAttribute('marker-end', 'url(#arrowhead)');
                
                svg.appendChild(path);
            } else {
                // Draw straight arrow
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', startX);
                line.setAttribute('y1', startY);
                line.setAttribute('x2', endX);
                line.setAttribute('y2', endY);
                line.setAttribute('stroke', 'rgba(235, 180, 52, 0.8)');
                line.setAttribute('stroke-width', '16');
                line.setAttribute('stroke-linecap', 'round');
                line.setAttribute('marker-end', 'url(#arrowhead)');
                
                svg.appendChild(line);
            }
        });
        
        board.appendChild(svg);
    }

    // Clear all annotations
    clearAnnotations() {
        this.highlightedSquares.clear();
        this.arrows = [];
        this.renderAnnotations();
    }

    // Update game UI
    updateGameUI() {
        const currentTurn = this.chessEngine.turn();
        const currentPlayerText = currentTurn === 'w' ? 'White' : 'Black';
        const playerText = currentTurn === this.gameSettings.playerColor[0] ? 'You' : 'Bot';
        document.getElementById('current-player').textContent = `${playerText} to move`;
        
        // Update takeback counter
        const takebackCounter = document.getElementById('takeback-counter');
        const takebackBtn = document.getElementById('takeback-btn');
        
        if (this.maxTakebacks > 0) {
            takebackCounter.textContent = `Takebacks: ${this.maxTakebacks - this.takebackCount}`;
            takebackCounter.classList.remove('hidden');
            
            if (this.takebackCount < this.maxTakebacks && this.chessEngine.history().length > 0) {
                takebackBtn.classList.remove('hidden');
            } else {
                takebackBtn.classList.add('hidden');
            }
        } else {
            takebackCounter.classList.add('hidden');
            takebackBtn.classList.add('hidden');
        }
        
        // Update game status
        let statusText = 'Game in progress';
        if (this.chessEngine.in_check()) {
            statusText = `${currentPlayerText} is in check`;
        } else if (this.chessEngine.in_checkmate()) {
            statusText = `Checkmate! ${currentPlayerText === 'White' ? 'Black' : 'White'} wins`;
        } else if (this.chessEngine.in_stalemate()) {
            statusText = 'Stalemate - Draw';
        } else if (this.chessEngine.in_draw()) {
            statusText = 'Draw';
        }
        
        document.getElementById('game-status-text').textContent = statusText;
    }
    
    // Play sound effect for a move
    playMoveSound(move) {
        const isCheck = this.chessEngine.in_check();
        const isCheckmate = this.chessEngine.in_checkmate();
        
        playMoveSound(move, isCheck, isCheckmate);
    }
    
    // Check game status
    checkGameStatus() {
        if (this.chessEngine.game_over()) {
            if (this.chessEngine.in_checkmate()) {
                this.endGame('checkmate');
            } else if (this.chessEngine.in_stalemate()) {
                this.endGame('stalemate');
            } else if (this.chessEngine.in_draw()) {
                this.endGame('draw');
            }
        }
    }

    // Takeback move
    takebackMove() {
        if (this.takebackCount >= this.maxTakebacks) return;
        if (this.chessEngine.history().length === 0) return;
        
        // Undo bot's move
        this.chessEngine.undo();
        
        // Undo player's move to get back to player's turn
        if (this.chessEngine.history().length > 0) {
            this.chessEngine.undo();
        }
        
        this.takebackCount++;
        this.updateBoard();
        this.updateGameUI();
        this.clearSelection();
        this.saveGameState(); // Save game state after takeback
        
        showNotification('Move taken back', 'success');
    }

    // Copy PGN
    async copyPGN() {
        const pgn = this.chessEngine.pgn();
        const success = await copyToClipboard(pgn);
        
        if (success) {
            showNotification('PGN copied to clipboard', 'success');
        } else {
            showNotification('Failed to copy PGN', 'error');
        }
    }

    // Resign game
    resignGame() {
        if (confirm('Are you sure you want to resign?')) {
            this.endGame('resignation');
        }
    }


    // Get piece image URL based on current style
    getPieceImageUrl(pieceNotation) {
        const style = this.gameSettings.pieceStyle;
        
        // pieceNotation is already in format like 'wP' or 'bP' from chess.js
        const pieceKey = pieceNotation;
        
        if (style === 'modern') {
            const modernPieces = {
                wP: "images/modern-wp.png",
                wR: "images/modern-wr.png",
                wN: "images/modern-wn.png",
                wB: "images/modern-wb.png",
                wQ: "images/modern-wq.png",
                wK: "images/modern-wk.png",
                bP: "images/modern-bp.png",
                bR: "images/modern-br.png",
                bN: "images/modern-bn.png",
                bB: "images/modern-bb.png",
                bQ: "images/modern-bq.png",
                bK: "images/modern-bk.png",
            };
            return modernPieces[pieceKey];
        } else if (style === 'stone') {
            const stonePieces = {
                wP: "images/stone-wp.png",
                wR: "images/stone-wr.png",
                wN: "images/stone-wn.png",
                wB: "images/stone-wb.png",
                wQ: "images/stone-wq.png",
                wK: "images/stone-wk.png",
                bP: "images/stone-bp.png",
                bR: "images/stone-br.png",
                bN: "images/stone-bn.png",
                bB: "images/stone-bb.png",
                bQ: "images/stone-bq.png",
                bK: "images/stone-bk.png",
            };
            return stonePieces[pieceKey];
        } else if (style === 'neo') {
            const neoPieces = {
                wP: "https://images.chesscomfiles.com/chess-themes/pieces/cases/150/wp.png",
                wR: "https://images.chesscomfiles.com/chess-themes/pieces/cases/150/wr.png",
                wN: "https://images.chesscomfiles.com/chess-themes/pieces/cases/150/wn.png",
                wB: "https://images.chesscomfiles.com/chess-themes/pieces/cases/150/wb.png",
                wQ: "https://images.chesscomfiles.com/chess-themes/pieces/cases/150/wq.png",
                wK: "https://images.chesscomfiles.com/chess-themes/pieces/cases/150/wk.png",
                bP: "https://images.chesscomfiles.com/chess-themes/pieces/cases/150/bp.png",
                bR: "https://images.chesscomfiles.com/chess-themes/pieces/cases/150/br.png",
                bN: "https://images.chesscomfiles.com/chess-themes/pieces/cases/150/bn.png",
                bB: "https://images.chesscomfiles.com/chess-themes/pieces/cases/150/bb.png",
                bQ: "https://images.chesscomfiles.com/chess-themes/pieces/cases/150/bq.png",
                bK: "https://images.chesscomfiles.com/chess-themes/pieces/cases/150/bk.png",
            };
            return neoPieces[pieceKey];
        } else {
            // Classic pieces (default)
            const classicPieces = {
                wP: "images/classic-wp.png",
                wR: "images/classic-wr.png",
                wN: "images/classic-wn.png",
                wB: "images/classic-wb.png",
                wQ: "images/classic-wq.png",
                wK: "images/classic-wk.png",
                bP: "images/classic-bp.png",
                bR: "images/classic-br.png",
                bN: "images/classic-bn.png",
                bB: "images/classic-bb.png",
                bQ: "images/classic-bq.png",
                bK: "images/classic-bk.png",
            };
            return classicPieces[pieceKey];
        }
    }

    // Animate the checkmated king and winner king
    animateCheckmatedKing() {
        // Find the king of the player who is in checkmate (current turn)
        const loserColor = this.chessEngine.turn();
        const winnerColor = loserColor === 'w' ? 'b' : 'w';
        
        // Search through all squares to find both kings
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const squareNotation = coordsToAlgebraic(file, rank);
                const piece = this.chessEngine.get(squareNotation);
                
                if (piece && piece.type === 'k') {
                    const square = getSquareElement(file, rank);
                    if (square) {
                        if (piece.color === loserColor) {
                            // Losing king - red square with black king icon
                            const background = document.createElement('div');
                            background.className = 'square-loser-bg';
                            square.appendChild(background);
                            
                            const badge = document.createElement('div');
                            badge.className = 'king-loser-badge';
                            square.appendChild(badge);
                        } else if (piece.color === winnerColor) {
                            // Winning king - green square with crown
                            const background = document.createElement('div');
                            background.className = 'square-winner-bg';
                            square.appendChild(background);
                            
                            const badge = document.createElement('div');
                            badge.className = 'king-winner-badge';
                            square.appendChild(badge);
                        }
                    }
                }
            }
        }
    }

    // Animate resignation with flag for loser
    animateResignation() {
        // The resigning player is the current turn
        const loserColor = this.chessEngine.turn();
        const winnerColor = loserColor === 'w' ? 'b' : 'w';
        
        // Search through all squares to find both kings
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const squareNotation = coordsToAlgebraic(file, rank);
                const piece = this.chessEngine.get(squareNotation);
                
                if (piece && piece.type === 'k') {
                    const square = getSquareElement(file, rank);
                    if (square) {
                        if (piece.color === loserColor) {
                            // Resigning king - red square with flag icon
                            const background = document.createElement('div');
                            background.className = 'square-loser-bg';
                            square.appendChild(background);
                            
                            const badge = document.createElement('div');
                            badge.className = 'king-resigned-badge';
                            square.appendChild(badge);
                        } else if (piece.color === winnerColor) {
                            // Winning king - green square with crown
                            const background = document.createElement('div');
                            background.className = 'square-winner-bg';
                            square.appendChild(background);
                            
                            const badge = document.createElement('div');
                            badge.className = 'king-winner-badge';
                            square.appendChild(badge);
                        }
                    }
                }
            }
        }
    }

    // End game
    async endGame(reason) {
        let message = '';
        let result = '';
        let terminationReason = '';
        
        switch (reason) {
            case 'checkmate':
                const playerWon = this.chessEngine.turn() !== this.gameSettings.playerColor[0];
                message = playerWon ? 'You won by checkmate!' : 'You lost by checkmate!';
                result = playerWon ? 'win' : 'loss';
                terminationReason = 'Checkmate';
                
                // Animate the checkmated king
                this.animateCheckmatedKing();
                // Note: checkmate sound (check + endgame) is already played by playMoveSound
                break;
            case 'stalemate':
                message = 'Game ended in stalemate';
                result = 'draw';
                terminationReason = 'Stalemate';
                this.animateDraw();
                playEndGameSound();
                break;
            case 'draw':
                message = 'Game ended in a draw';
                result = 'draw';
                terminationReason = 'Draw by agreement';
                this.animateDraw();
                playEndGameSound();
                break;
            case 'insufficient':
                message = 'Game ended in a draw (insufficient material)';
                result = 'draw';
                terminationReason = 'Insufficient material';
                this.animateDraw();
                playEndGameSound();
                break;
            case 'resignation':
                message = 'You resigned';
                result = 'loss';
                terminationReason = 'Resignation';
                
                // Animate the resignation with flag
                this.animateResignation();
                playEndGameSound();
                break;
        }
        
        showNotification(message, 'info', 3000);
        
        // Disable further moves immediately
        this.clearSelection();
        document.querySelectorAll('.chess-piece').forEach(piece => {
            piece.style.cursor = 'not-allowed';
            piece.style.opacity = '0.7';
        });
        
        // Archive the completed game
        await this.archiveGame(result, terminationReason);
        
        // Clear saved game state when game ends
        this.clearGameState();
        
        // Return to main menu after a brief delay
        setTimeout(() => {
            this.showMainMenu();
        }, 3000);
    }
    
    // Archive completed game
    async archiveGame(result, terminationReason) {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.log('❌ No auth token - cannot archive game');
            return;
        }
        
        const history = this.chessEngine.history({ verbose: true });
        const botColor = this.gameSettings.playerColor === 'white' ? 'black' : 'white';
        
        try {
            const response = await fetch(`${API_URL}/archive-game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    pgn: this.chessEngine.pgn(),
                    userColor: this.gameSettings.playerColor,
                    botColor: botColor,
                    result: result,
                    terminationReason: terminationReason,
                    moveCount: history.length,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (response.ok) {
                console.log('📦 Game archived successfully');
            } else {
                console.error('Failed to archive game');
            }
        } catch (error) {
            console.error('Failed to archive game:', error);
        }
    }
    
    // Animate draw (grey squares with equals signs floating up)
    animateDraw() {
        const board = document.getElementById('chess-board');
        if (!board) return;
        
        // Find both king positions
        const squares = this.chessEngine.board();
        let whiteKingSquare = null;
        let blackKingSquare = null;
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = squares[row][col];
                if (piece && piece.type === 'k') {
                    const file = String.fromCharCode(97 + col);
                    const rank = 8 - row;
                    const square = `${file}${rank}`;
                    
                    if (piece.color === 'w') {
                        whiteKingSquare = square;
                    } else {
                        blackKingSquare = square;
                    }
                }
            }
        }
        
        // Animate both king squares
        [whiteKingSquare, blackKingSquare].forEach(square => {
            if (!square) return;
            
            const squareElement = document.querySelector(`[data-square="${square}"]`);
            if (!squareElement) return;
            
            // Add grey overlay to square
            const overlay = document.createElement('div');
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(128, 128, 128, 0.7)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.fontSize = '3rem';
            overlay.style.color = 'white';
            overlay.style.zIndex = '100';
            overlay.textContent = '=';
            squareElement.appendChild(overlay);
            
            // Animate floating up and shrinking
            overlay.animate([
                { transform: 'translateY(0) scale(1)', opacity: 1 },
                { transform: 'translateY(-200px) translateX(200px) scale(0.3)', opacity: 0 }
            ], {
                duration: 2000,
                easing: 'ease-out'
            });
            
            // Remove after animation
            setTimeout(() => overlay.remove(), 2000);
        });
    }
    
    // Save settings to server
    async saveSettings() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.log('❌ No auth token - saving to localStorage only');
            try {
                localStorage.setItem('techChessSettings', JSON.stringify(this.gameSettings));
            } catch (error) {
                console.error('Failed to save settings to localStorage:', error);
            }
            return;
        }
        
        try {
            console.log('💾 Saving settings to server:', this.gameSettings);
            const response = await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    pieceStyle: this.gameSettings.pieceStyle,
                    boardTheme: this.gameSettings.boardTheme,
                    difficulty: this.gameSettings.difficulty
                })
            });
            
            if (response.ok) {
                console.log('💾 Settings saved to server successfully');
            } else {
                console.error('Failed to save settings to server');
                // Fallback to localStorage
                localStorage.setItem('techChessSettings', JSON.stringify(this.gameSettings));
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            // Fallback to localStorage
            try {
                localStorage.setItem('techChessSettings', JSON.stringify(this.gameSettings));
            } catch (e) {
                console.error('Failed to save to localStorage:', e);
            }
        }
    }
    
    // Load settings from server (or localStorage as fallback)
    async loadSettings() {
        const token = localStorage.getItem('authToken');
        
        if (!token) {
            console.log('❌ No auth token - loading from localStorage only');
            try {
                const saved = localStorage.getItem('techChessSettings');
                if (saved) {
                    const settings = JSON.parse(saved);
                    this.gameSettings = { ...this.gameSettings, ...settings };
                    console.log('📂 Settings loaded from localStorage:', this.gameSettings);
                }
            } catch (error) {
                console.error('Failed to load settings from localStorage:', error);
            }
            return;
        }
        
        try {
            console.log('📂 Loading settings from server...');
            const response = await fetch(`${API_URL}/settings`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.settings) {
                    this.gameSettings = { ...this.gameSettings, ...data.settings };
                    console.log('📂 Settings loaded from server:', this.gameSettings);
                    return;
                }
            }
            
            // Fallback to localStorage if server fails
            console.log('⚠️ Server settings failed, trying localStorage...');
            const saved = localStorage.getItem('techChessSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.gameSettings = { ...this.gameSettings, ...settings };
                console.log('📂 Settings loaded from localStorage:', this.gameSettings);
            }
        } catch (error) {
            console.error('Failed to load settings from server:', error);
            // Fallback to localStorage
            try {
                const saved = localStorage.getItem('techChessSettings');
                if (saved) {
                    const settings = JSON.parse(saved);
                    this.gameSettings = { ...this.gameSettings, ...settings };
                    console.log('📂 Settings loaded from localStorage (fallback):', this.gameSettings);
                }
            } catch (e) {
                console.error('Failed to load from localStorage:', e);
            }
        }
    }
    
    // Save game state to server
    async saveGameState() {
        if (!this.chessEngine) return;
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.log('❌ No auth token - cannot save game');
            return;
        }
        
        const gameState = {
            position: this.chessEngine.fen(),
            move: this.chessEngine.turn(), // 'w' or 'b'
            pgn: this.chessEngine.pgn(),
            settings: this.gameSettings,
            moveHistory: this.chessEngine.history({ verbose: true }),
            takebackCount: this.takebackCount,
            moveTimes: this.moveTimes
        };
        
        try {
            const response = await fetch(`${API_URL}/save-game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(gameState)
            });
            
            if (response.ok) {
                console.log('💾 Game state saved to server');
            } else {
                console.error('Failed to save game to server');
            }
        } catch (error) {
            console.error('Failed to save game state:', error);
        }
    }
    
    // Load game state from server
    async loadGameState() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.log('❌ No auth token - cannot load game');
            return null;
        }
        
        try {
            const response = await fetch(`${API_URL}/load-game`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.game) {
                    console.log('📂 Found saved game on server');
                    // Convert server format to expected format
                    return {
                        fen: data.game.position,
                        pgn: data.game.pgn,
                        settings: data.game.settings,
                        moveHistory: data.game.moveHistory,
                        takebackCount: data.game.takebackCount,
                        moveTimes: data.game.moveTimes
                    };
                }
            }
        } catch (error) {
            console.error('Failed to load game state:', error);
        }
        return null;
    }
    
    // Clear saved game state from server
    async clearGameState() {
        const token = localStorage.getItem('authToken');
        if (!token) return;
        
        try {
            const response = await fetch(`${API_URL}/delete-game`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                console.log('🗑️ Game state cleared from server');
            }
        } catch (error) {
            console.error('Failed to clear game state:', error);
        }
    }
    
    // Restore a saved game
    restoreGame(savedState) {
        try {
            // Validate saved state
            if (!savedState || !savedState.fen) {
                console.log('❌ Invalid saved state, starting fresh');
                this.clearGameState();
                this.showMainMenu();
                return;
            }
            
            // Restore game settings (merge with defaults)
            if (savedState.settings) {
                this.gameSettings = { ...this.gameSettings, ...savedState.settings };
            }
            
            // Initialize chess engine
            this.chessEngine = new Chess();
            
            // Load position from PGN to restore move history
            // PGN is more important than FEN because it preserves the full game
            if (savedState.pgn && savedState.pgn.trim() !== '') {
                try {
                    this.chessEngine.load_pgn(savedState.pgn);
                    console.log('📂 Loaded game from PGN with', this.chessEngine.history().length, 'moves');
                } catch (e) {
                    console.warn('Failed to load PGN, trying FEN:', e);
                    if (savedState.fen) {
                        this.chessEngine.load(savedState.fen);
                    }
                }
            } else if (savedState.fen) {
                this.chessEngine.load(savedState.fen);
                console.log('📂 Loaded game from FEN (no move history)');
            } else {
                throw new Error('No valid position data');
            }
            
            // Initialize bot (use Chess.js version - it's faster for now)
            // Bitboard version is experimental - needs optimized legality checking
            this.bot = new MartinaBot(this.gameSettings.difficulty);
            if (typeof applyPerformanceConfig === 'function') {
                applyPerformanceConfig(this.bot, BotPerformanceConfig);
            }
            
            // Restore game state
            this.lastMove = savedState.lastMove || null;
            this.takebackCount = savedState.takebackCount || 0;
            this.moveTimes = savedState.moveTimes || [];
            this.moveStartTime = Date.now();
            
            console.log('📂 Restored move times:', this.moveTimes.length, 'entries');
            console.log('📂 Current position:', this.chessEngine.fen());
            this.maxTakebacks = this.gameSettings.difficulty === 'too-easy' ? Infinity : 
                               this.gameSettings.difficulty === 'just-for-fun' ? 3 : 0;
            
            // Reset UI state
            this.selectedSquare = null;
            this.legalMoves = [];
            this.highlightedSquares = new Set();
            this.arrows = [];
            
            // Show game screen
            document.getElementById('main-menu').classList.remove('active');
            document.getElementById('game-screen').classList.add('active');
            
            // Create and render the board
            this.createBoard();
            this.updateBoard();
            this.updateMoveList(); // Restore move list display
            this.updateGameUI();
            
            console.log('✅ Game restored successfully with', this.chessEngine.history().length, 'moves');
            showNotification('Game restored', 'success', 2000);
            
            // If it's bot's turn, make bot move
            if (this.chessEngine.turn() !== this.gameSettings.playerColor[0]) {
                setTimeout(() => this.makeBotMove(), 500);
            }
        } catch (error) {
            console.error('Failed to restore game:', error);
            this.clearGameState();
            this.showMainMenu();
            showNotification('Failed to restore game', 'error');
        }
    }
}
