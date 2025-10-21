// View Game - Archive Game Viewer JavaScript

let chessEngine = new Chess();
let moveHistory = [];
let currentMoveIndex = -1;
let isPlayingMoves = false;
let playMovesInterval = null;

// Display user info and handle logout
document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userInfoDiv = document.getElementById('user-info');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (currentUser.username) {
        userInfoDiv.textContent = `👤 ${currentUser.username}`;
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            window.location.href = 'landing.html';
        });
    }

    // Setup navigation buttons
    document.getElementById('reset-btn').addEventListener('click', goToStart);
    document.getElementById('prev-btn').addEventListener('click', previousMove);
    document.getElementById('next-btn').addEventListener('click', nextMove);
    document.getElementById('end-btn').addEventListener('click', goToEnd);
    document.getElementById('play-moves-btn').addEventListener('click', togglePlayMoves);

    // Load user's current settings first
    await loadCurrentSettings();
    
    // Load the game
    await loadGame();
});

// Load user's current settings from server
async function loadCurrentSettings() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.log('❌ No token, using defaults');
        window.gameSettings = { pieceStyle: 'classic', boardTheme: 'brown' };
        return;
    }
    
    try {
        console.log('📡 Fetching user settings from:', `${API_URL}/settings`);
        const response = await fetch(`${API_URL}/settings`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('📡 Settings response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📡 Settings data received:', data);
            
            if (data.success && data.settings) {
                window.gameSettings = {
                    pieceStyle: data.settings.pieceStyle || 'classic',
                    boardTheme: data.settings.boardTheme || 'brown'
                };
                console.log('✅ Loaded user settings:', window.gameSettings);
                return;
            }
        }
        
        // Fallback to defaults
        console.log('⚠️ Using default settings');
        window.gameSettings = { pieceStyle: 'classic', boardTheme: 'brown' };
    } catch (error) {
        console.error('❌ Failed to load settings:', error);
        window.gameSettings = { pieceStyle: 'classic', boardTheme: 'brown' };
    }
}

async function loadGame() {
    const gameId = localStorage.getItem('viewGameId');
    if (!gameId) {
        showNotification('No game selected', 'error');
        window.location.href = 'archive.html';
        return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
        showNotification('Please log in to view games', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/archived-games/${gameId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (data.success && data.game) {
            displayGame(data.game);
        } else {
            showNotification('Game not found', 'error');
            window.location.href = 'archive.html';
        }
    } catch (error) {
        console.error('Failed to load game:', error);
        showNotification('Failed to load game', 'error');
    }
}

function displayGame(game) {
    // Load PGN
    chessEngine.load_pgn(game.pgn);
    moveHistory = chessEngine.history({ verbose: true });
    
    // Note: We use the user's current settings (loaded earlier), not the game's saved settings
    // This allows users to view old games with their current piece/board preferences
    
    // Reset and display
    chessEngine.reset();
    createBoard(window.gameSettings.boardTheme);
    renderBoard();
    updateMoveList();
    updateNavigationButtons();
    
    console.log('🎨 Displaying game with user settings:', window.gameSettings);
    
    // Go to end position
    goToEnd();
}

function createBoard(boardTheme = 'brown') {
    const board = document.getElementById('chess-board');
    board.innerHTML = '';
    board.className = `chess-board board-${boardTheme}`;
    
    console.log('🎨 Creating board with theme:', boardTheme, '| Class:', board.className);
    
    // Create 64 squares
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = 'chess-square';
            
            // Alternate colors
            if ((row + col) % 2 === 0) {
                square.classList.add('light');
            } else {
                square.classList.add('dark');
            }
            
            // Add square notation and coordinates
            const file = String.fromCharCode(97 + col);
            const rank = 8 - row;
            const squareNotation = `${file}${rank}`;
            square.dataset.square = squareNotation;
            square.dataset.file = col;
            square.dataset.rank = row;
            square.dataset.fileLetter = file;
            square.dataset.rankNumber = rank;
            
            board.appendChild(square);
        }
    }
}

function renderBoard() {
    const squares = document.querySelectorAll('.chess-square');
    const pieceStyle = window.gameSettings?.pieceStyle || 'classic';
    
    console.log('🎨 Rendering board with piece style:', pieceStyle);
    
    squares.forEach(square => {
        const squareNotation = square.dataset.square;
        const piece = chessEngine.get(squareNotation);
        
        // Clear existing piece
        const existingPiece = square.querySelector('.chess-piece');
        if (existingPiece) {
            existingPiece.remove();
        }
        
        if (piece) {
            const pieceDiv = document.createElement('div');
            pieceDiv.className = 'chess-piece';
            const color = piece.color === 'w' ? 'w' : 'b';
            const type = piece.type.toLowerCase();
            const imagePath = `images/${pieceStyle}-${color}${type}.png`;
            pieceDiv.style.backgroundImage = `url('${imagePath}')`;
            pieceDiv.style.backgroundSize = 'contain';
            pieceDiv.style.backgroundRepeat = 'no-repeat';
            pieceDiv.style.backgroundPosition = 'center';
            square.appendChild(pieceDiv);
        }
    });
}

// Animate piece movement (pulled from ui.js)
async function animatePieceMove(fromSquare, toSquare) {
    return new Promise((resolve) => {
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
        }, 170);
    });
}

function getPieceImage(piece) {
    const color = piece.color === 'w' ? 'w' : 'b';
    const type = piece.type.toLowerCase();
    return `images/classic-${color}${type}.png`;
}

// Play sound for the current move
function playCurrentMoveSound(moveIndex) {
    if (moveIndex < 0 || moveIndex >= moveHistory.length) return;
    
    const move = moveHistory[moveIndex];
    const isCheck = chessEngine.in_check();
    const isCheckmate = chessEngine.in_checkmate();
    
    playMoveSound(move, isCheck, isCheckmate);
}

function updateMoveList() {
    const moveList = document.getElementById('move-list');
    moveList.innerHTML = '';
    
    // Group moves by pairs
    for (let i = 0; i < moveHistory.length; i += 2) {
        const moveRow = document.createElement('div');
        moveRow.className = 'move-row';
        moveRow.style.gridTemplateColumns = '40px 1fr 1fr';
        
        const moveNumber = document.createElement('div');
        moveNumber.className = 'move-number';
        moveNumber.textContent = `${Math.floor(i / 2) + 1}.`;
        moveRow.appendChild(moveNumber);
        
        // White's move
        const whiteMove = createMoveElement(moveHistory[i], i);
        moveRow.appendChild(whiteMove);
        
        // Black's move
        if (i + 1 < moveHistory.length) {
            const blackMove = createMoveElement(moveHistory[i + 1], i + 1);
            moveRow.appendChild(blackMove);
        } else {
            moveRow.appendChild(document.createElement('div'));
        }
        
        moveList.appendChild(moveRow);
    }
    
    updateNavigationButtons();
}

function createMoveElement(move, moveIndex) {
    const moveItem = document.createElement('div');
    moveItem.className = 'move-item';
    
    if (moveIndex === currentMoveIndex) {
        moveItem.classList.add('active');
    }
    
    moveItem.addEventListener('click', () => goToMove(moveIndex));
    moveItem.style.cursor = 'pointer';
    
    moveItem.textContent = move.san;
    
    return moveItem;
}

// Navigation functions
function goToStart() {
    stopPlayingMoves();
    currentMoveIndex = -1;
    chessEngine.reset();
    renderBoard();
    updateMoveList();
    // No sound when going to start position
}

async function previousMove() {
    if (currentMoveIndex < 0) return;
    stopPlayingMoves();
    currentMoveIndex--;
    await loadPositionAtMove(currentMoveIndex, true);
}

async function nextMove() {
    if (currentMoveIndex >= moveHistory.length - 1) return;
    currentMoveIndex++;
    await loadPositionAtMove(currentMoveIndex, true);
    playCurrentMoveSound(currentMoveIndex);
}

function goToEnd() {
    stopPlayingMoves();
    currentMoveIndex = moveHistory.length - 1;
    loadPositionAtMove(currentMoveIndex, false);
}

async function goToMove(moveIndex) {
    stopPlayingMoves();
    const previousIndex = currentMoveIndex;
    currentMoveIndex = moveIndex;
    await loadPositionAtMove(moveIndex, false);
    
    // Only play sound if moving forward
    if (moveIndex > previousIndex && moveIndex >= 0) {
        playCurrentMoveSound(moveIndex);
    }
}

async function loadPositionAtMove(moveIndex, animated = false) {
    // Store the current board state before making the move
    const prevFen = chessEngine.fen();
    
    // Reset and replay to target position
    chessEngine.reset();
    for (let i = 0; i <= moveIndex && i < moveHistory.length; i++) {
        chessEngine.move(moveHistory[i].san);
    }
    
    // If animated and we have a move to show
    if (animated && moveHistory[moveIndex]) {
        const move = moveHistory[moveIndex];
        const fromSquare = document.querySelector(`[data-square="${move.from}"]`);
        const toSquare = document.querySelector(`[data-square="${move.to}"]`);
        
        if (fromSquare && toSquare) {
            // Render the board before the move
            const tempEngine = new Chess();
            tempEngine.reset();
            for (let i = 0; i < moveIndex; i++) {
                tempEngine.move(moveHistory[i].san);
            }
            
            // Render board state before this move
            const pieceStyle = window.gameSettings?.pieceStyle || 'classic';
            const squares = document.querySelectorAll('.chess-square');
            squares.forEach(square => {
                const squareNotation = square.dataset.square;
                const piece = tempEngine.get(squareNotation);
                
                const existingPiece = square.querySelector('.chess-piece');
                if (existingPiece) existingPiece.remove();
                
                if (piece) {
                    const pieceDiv = document.createElement('div');
                    pieceDiv.className = 'chess-piece';
                    const color = piece.color === 'w' ? 'w' : 'b';
                    const type = piece.type.toLowerCase();
                    pieceDiv.style.backgroundImage = `url('images/${pieceStyle}-${color}${type}.png')`;
                    pieceDiv.style.backgroundSize = 'contain';
                    pieceDiv.style.backgroundRepeat = 'no-repeat';
                    pieceDiv.style.backgroundPosition = 'center';
                    square.appendChild(pieceDiv);
                }
            });
            
            // Animate the move
            await animatePieceMove(fromSquare, toSquare);
        }
    }
    
    renderBoard();
    updateMoveList();
}

function togglePlayMoves() {
    if (isPlayingMoves) {
        stopPlayingMoves();
    } else {
        startPlayingMoves();
    }
}

async function startPlayingMoves() {
    if (moveHistory.length === 0) return;
    
    // If at the end, reset to start before playing
    if (currentMoveIndex >= moveHistory.length - 1) {
        currentMoveIndex = -1;
        chessEngine.reset();
        renderBoard();
        updateMoveList();
    }
    
    isPlayingMoves = true;
    updatePlayButton();
    
    playMovesInterval = setInterval(async () => {
        if (currentMoveIndex >= moveHistory.length - 1) {
            stopPlayingMoves();
            return;
        }
        await nextMove();
    }, 1000);
}

function stopPlayingMoves() {
    if (playMovesInterval) {
        clearInterval(playMovesInterval);
        playMovesInterval = null;
    }
    isPlayingMoves = false;
    updatePlayButton();
}

function updatePlayButton() {
    const playBtn = document.getElementById('play-moves-btn');
    if (!playBtn) return;
    
    if (isPlayingMoves) {
        playBtn.textContent = '⏸';
        playBtn.classList.add('playing');
    } else {
        playBtn.textContent = '▶';
        playBtn.classList.remove('playing');
    }
}

function updateNavigationButtons() {
    const resetBtn = document.getElementById('reset-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const endBtn = document.getElementById('end-btn');
    const playBtn = document.getElementById('play-moves-btn');
    
    const hasHistory = moveHistory.length > 0;
    const atStart = currentMoveIndex < 0;
    const atEnd = currentMoveIndex >= moveHistory.length - 1;
    
    resetBtn.disabled = !hasHistory || atStart;
    prevBtn.disabled = !hasHistory || atStart;
    nextBtn.disabled = !hasHistory || atEnd;
    endBtn.disabled = !hasHistory || atEnd;
    playBtn.disabled = !hasHistory;
}

