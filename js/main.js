// Main application entry point for Tech Chess

// Global variables
let chessUI = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Tech Chess - Initializing...');
    
    // Initialize the UI
    chessUI = new ChessUI();
    chessUI.initialize();
    
    console.log('Tech Chess - Ready to play!');
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden - pause any ongoing operations
        console.log('Page hidden - pausing operations');
    } else {
        // Page is visible - resume operations
        console.log('Page visible - resuming operations');
    }
});

// Handle window resize
window.addEventListener('resize', debounce(() => {
    // Adjust board size if needed
    if (chessUI && chessUI.chessEngine) {
        chessUI.updateBoard();
    }
}, 250));

// Handle keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (!chessUI || !chessUI.chessEngine) return;
    
    // Escape key - clear selection
    if (event.key === 'Escape') {
        chessUI.clearSelection();
    }
    
    // Ctrl+Z - takeback move
    if (event.ctrlKey && event.key === 'z') {
        event.preventDefault();
        chessUI.takebackMove();
    }
    
    // Ctrl+C - copy PGN
    if (event.ctrlKey && event.key === 'c' && event.target.tagName !== 'INPUT') {
        event.preventDefault();
        chessUI.copyPGN();
    }
});

// Handle beforeunload to save game
window.addEventListener('beforeunload', (event) => {
    if (chessUI && chessUI.chessEngine && chessUI.chessEngine.history().length > 0) {
        // Save game to server before leaving
        const token = localStorage.getItem('authToken');
        if (token) {
            const gameState = {
                position: chessUI.chessEngine.fen(),
                move: chessUI.chessEngine.turn(),
                pgn: chessUI.chessEngine.pgn(),
                settings: chessUI.gameSettings,
                moveHistory: chessUI.chessEngine.history({ verbose: true }),
                takebackCount: chessUI.takebackCount || 0,
                moveTimes: chessUI.moveTimes || []
            };
            
            // Use sendBeacon for reliable background save
            const data = new FormData();
            data.append('data', JSON.stringify(gameState));
            
            // Fallback: use synchronous XHR (last resort)
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${API_URL}/save-game`, false); // synchronous
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.send(JSON.stringify(gameState));
            } catch (e) {
                console.error('Failed to save game on exit:', e);
            }
        }
    }
});

// Service Worker registration (disabled - for future PWA features)
// Uncomment when sw.js is created
// if ('serviceWorker' in navigator) {
//     window.addEventListener('load', () => {
//         navigator.serviceWorker.register('/sw.js')
//             .then(registration => {
//                 console.log('SW registered: ', registration);
//             })
//             .catch(registrationError => {
//                 console.log('SW registration failed: ', registrationError);
//             });
//     });
// }

// Performance monitoring
if ('performance' in window) {
    window.addEventListener('load', () => {
        setTimeout(() => {
            const perfData = performance.getEntriesByType('navigation')[0];
            console.log('Page load time:', perfData.loadEventEnd - perfData.loadEventStart, 'ms');
        }, 0);
    });
}

// Error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showNotification('An error occurred. Please refresh the page.', 'error', 5000);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('An error occurred. Please refresh the page.', 'error', 5000);
});

// Export for debugging
window.TechChess = {
    chessUI: () => chessUI,
    Chess: Chess,
    MartinaBot: MartinaBot
};
