// API Configuration - Auto-detects environment
const isLocalhost = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '';

// Automatically use the right API URL based on environment
const API_URL = isLocalhost 
    ? 'http://localhost:8020/api'  // Local development
    : 'https://tech-chess-api.onrender.com/api'; // Production backend

console.log(`🌐 Running in ${isLocalhost ? 'LOCAL' : 'PRODUCTION'} mode`);
console.log(`📡 API URL: ${API_URL}`);

