// Tech Chess Backend Server
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Simple in-memory database (replace with MongoDB/PostgreSQL for production)
const DB_FILE = path.join(__dirname, 'users.json');
let users = [];
let verificationCodes = {}; // Store verification codes temporarily

// Load users from file
if (fs.existsSync(DB_FILE)) {
    users = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// Save users to file
function saveUsers() {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

// JWT Secret (in production, use environment variable)
const JWT_SECRET = 'tech-chess-secret-key-change-this-in-production';

// No email - verification code shown directly on page

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Tech Chess API is running' });
});

// Sign up
app.post('/api/signup', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if username already exists
        const userExists = users.find(u => 
            u.username.toLowerCase() === username.toLowerCase()
        );

        if (userExists) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate verification code
        const verificationCode = crypto.randomInt(100000, 999999).toString();

        // Create user
        const newUser = {
            id: Date.now().toString(),
            username: username,
            password: hashedPassword,
            verified: false,
            createdAt: new Date().toISOString(),
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0
        };

        users.push(newUser);
        saveUsers();

        // Store verification code (expires in 10 minutes) - using username as key
        verificationCodes[username] = {
            code: verificationCode,
            expiresAt: Date.now() + 10 * 60 * 1000
        };

        // Return verification code directly (no email)
        console.log('✅ Account created for:', username);
        console.log('🔑 Verification code:', verificationCode);

        res.json({ 
            success: true, 
            message: 'Account created! Your verification code is displayed below.',
            userId: newUser.id,
            verificationCode: verificationCode
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error during signup' });
    }
});

// Verify code
app.post('/api/verify-email', (req, res) => {
    try {
        const { username, code } = req.body;

        if (!username || !code) {
            return res.status(400).json({ error: 'Username and code are required' });
        }

        // Check if verification code exists and is valid
        const storedCode = verificationCodes[username];
        if (!storedCode) {
            return res.status(400).json({ error: 'No verification code found. Please sign up again.' });
        }

        if (Date.now() > storedCode.expiresAt) {
            delete verificationCodes[username];
            return res.status(400).json({ error: 'Verification code expired. Please sign up again.' });
        }

        if (storedCode.code !== code) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Verify user
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.verified = true;
        saveUsers();

        // Clean up verification code
        delete verificationCodes[username];

        res.json({ success: true, message: 'Account verified successfully!' });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Server error during verification' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { usernameOrEmail, password } = req.body;

        if (!usernameOrEmail || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Find user by username or email
        const user = users.find(u => 
            u.username.toLowerCase() === usernameOrEmail.toLowerCase() || 
            (u.email && u.email.toLowerCase() === usernameOrEmail.toLowerCase())
        );

        if (!user) {
            return res.status(400).json({ error: 'Invalid username/email or password' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid username/email or password' });
        }

        // Check if verified
        if (!user.verified) {
            return res.status(400).json({ 
                error: 'Please verify your email before logging in',
                needsVerification: true
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                email: user.email 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                gamesPlayed: user.gamesPlayed,
                wins: user.wins,
                losses: user.losses,
                draws: user.draws
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Get user profile (protected route)
app.get('/api/profile', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        gamesPlayed: user.gamesPlayed,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        createdAt: user.createdAt
    });
});

// Update game stats (protected route)
app.post('/api/game-result', authenticateToken, (req, res) => {
    const { result } = req.body; // 'win', 'loss', 'draw'
    
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    user.gamesPlayed++;
    if (result === 'win') user.wins++;
    else if (result === 'loss') user.losses++;
    else if (result === 'draw') user.draws++;

    saveUsers();

    res.json({ success: true, stats: { 
        gamesPlayed: user.gamesPlayed, 
        wins: user.wins, 
        losses: user.losses, 
        draws: user.draws 
    }});
});

// Save current game (protected route)
app.post('/api/save-game', authenticateToken, (req, res) => {
    const { position, move, pgn, settings, moveHistory, moveTimes, takebackCount } = req.body;
    
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Save game state to user object
    user.currentGame = {
        username: user.username,
        position: position, // FEN string
        move: move, // 'w' or 'b' - whose turn it was
        pgn: pgn || '',
        settings: settings || {},
        moveHistory: moveHistory || [],
        moveTimes: moveTimes || [],
        takebackCount: takebackCount || 0,
        lastSaved: new Date().toISOString()
    };

    saveUsers();

    res.json({ 
        success: true, 
        message: 'Game saved successfully'
    });
});

// Load current game (protected route)
app.get('/api/load-game', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (!user.currentGame) {
        return res.json({ 
            success: true, 
            game: null 
        });
    }

    res.json({ 
        success: true, 
        game: user.currentGame 
    });
});

// Delete current game (protected route)
app.delete('/api/delete-game', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    delete user.currentGame;
    saveUsers();

    res.json({ 
        success: true, 
        message: 'Game deleted successfully'
    });
});

// Save completed game to archive (protected route)
app.post('/api/archive-game', authenticateToken, (req, res) => {
    const { pgn, userColor, botColor, result, terminationReason, moveCount, timestamp } = req.body;
    
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Initialize games array if it doesn't exist
    if (!user.archivedGames) {
        user.archivedGames = [];
    }

    // Create archived game object
    const archivedGame = {
        id: Date.now().toString(),
        username: user.username,
        userColor: userColor,
        botColor: botColor,
        pgn: pgn,
        result: result, // 'win', 'loss', 'draw'
        terminationReason: terminationReason, // 'checkmate', 'resign', 'stalemate', 'insufficient material', etc.
        moveCount: moveCount || 0,
        timestamp: timestamp || new Date().toISOString()
    };

    // Add to user's archived games
    user.archivedGames.push(archivedGame);
    
    // Keep only last 50 games to prevent database bloat
    if (user.archivedGames.length > 50) {
        user.archivedGames = user.archivedGames.slice(-50);
    }

    saveUsers();

    res.json({ 
        success: true, 
        message: 'Game archived successfully',
        gameId: archivedGame.id
    });
});

// Get user's archived games (protected route)
app.get('/api/archived-games', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const games = user.archivedGames || [];
    
    // Return games in reverse chronological order (newest first)
    res.json({ 
        success: true, 
        games: games.reverse()
    });
});

// Get specific archived game (protected route)
app.get('/api/archived-games/:gameId', authenticateToken, (req, res) => {
    const { gameId } = req.params;
    const user = users.find(u => u.id === req.user.id);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const game = (user.archivedGames || []).find(g => g.id === gameId);
    
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }

    res.json({ 
        success: true, 
        game: game
    });
});

// Save user settings (protected route)
app.post('/api/settings', authenticateToken, (req, res) => {
    const { pieceStyle, boardTheme, difficulty } = req.body;
    
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Initialize settings if they don't exist
    if (!user.settings) {
        user.settings = {};
    }

    // Update settings
    if (pieceStyle) user.settings.pieceStyle = pieceStyle;
    if (boardTheme) user.settings.boardTheme = boardTheme;
    if (difficulty) user.settings.difficulty = difficulty;

    saveUsers();

    res.json({ 
        success: true, 
        message: 'Settings saved successfully',
        settings: user.settings
    });
});

// Get user settings (protected route)
app.get('/api/settings', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const settings = user.settings || {
        pieceStyle: 'classic',
        boardTheme: 'brown',
        difficulty: 'just-for-fun'
    };

    res.json({ 
        success: true, 
        settings: settings
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Tech Chess API running on http://localhost:${PORT}`);
    console.log(`📊 Users database: ${DB_FILE}`);
});

