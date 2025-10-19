// Chess game sound effects
const ChessSounds = {
    move: new Audio("sounds/move-self.mp3"),
    capture: new Audio("sounds/capture.mp3"),
    castle: new Audio("sounds/castle.mp3"),
    check: new Audio("sounds/move-check.mp3"),
    promotion: new Audio("sounds/promote.mp3"),
    endGame: new Audio("sounds/game-end.webm")
};

// Play sound based on move type with priority rules:
// 1. Checkmate: check + endgame
// 2. Check: always overrides everything else
// 3. Promotion: overrides capture and move
// 4. Castle: specific sound
// 5. Capture: overrides move
// 6. Move: default
function playMoveSound(move, isCheck, isCheckmate) {
    // Checkmate: play check sound, then endgame sound
    if (isCheckmate) {
        ChessSounds.check.currentTime = 0;
        ChessSounds.check.play().catch(err => console.log('Sound play failed:', err));
        
        // Play endgame sound after check sound
        setTimeout(() => {
            ChessSounds.endGame.currentTime = 0;
            ChessSounds.endGame.play().catch(err => console.log('Sound play failed:', err));
        }, 500);
        return;
    }
    
    // Check: always plays (overrides promotion, capture, castle, move)
    if (isCheck) {
        ChessSounds.check.currentTime = 0;
        ChessSounds.check.play().catch(err => console.log('Sound play failed:', err));
        return;
    }
    
    // Promotion: overrides capture and move
    if (move.promotion) {
        ChessSounds.promotion.currentTime = 0;
        ChessSounds.promotion.play().catch(err => console.log('Sound play failed:', err));
        return;
    }
    
    // Castle
    if (move.flags && (move.flags.includes('k') || move.flags.includes('q'))) {
        ChessSounds.castle.currentTime = 0;
        ChessSounds.castle.play().catch(err => console.log('Sound play failed:', err));
        return;
    }
    
    // Capture: overrides move
    if (move.captured) {
        ChessSounds.capture.currentTime = 0;
        ChessSounds.capture.play().catch(err => console.log('Sound play failed:', err));
        return;
    }
    
    // Default: move
    ChessSounds.move.currentTime = 0;
    ChessSounds.move.play().catch(err => console.log('Sound play failed:', err));
}

// Play endgame sound for resign/draw
function playEndGameSound() {
    ChessSounds.endGame.currentTime = 0;
    ChessSounds.endGame.play().catch(err => console.log('Sound play failed:', err));
}

