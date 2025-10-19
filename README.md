# ♟️ Tech Chess

A modern chess web application where you can play against an AI opponent powered by advanced algorithms. Built with vanilla JavaScript, featuring Sebastian Lague-inspired AI techniques.

## 🎮 Features

- **Smart AI Opponent** - "Martina Bot" powered by minimax with alpha-beta pruning
- **Bitboard Engine** - Ultra-fast move generation
- **Opening Book** - Trained on real master games
- **Beautiful UI** - Multiple piece styles and board themes
- **User Accounts** - Save your games and settings
- **Cross-Platform** - Works on desktop and mobile

## 🚀 Quick Start

### Local Development

1. **Start the Backend Server:**
```bash
cd server
npm install
PORT=8020 node server.js
```

2. **Start the Frontend Server:**
```bash
python3 -m http.server 8000
```

3. **Open in Browser:**
Navigate to `http://localhost:8000/landing.html`

## 📁 Project Structure

```
tech chess/
├── css/                 # Stylesheets
├── js/                  # Frontend JavaScript
│   ├── bots/           # AI bot implementations
│   ├── config.js       # Environment configuration
│   ├── main.js         # Main application
│   └── ui.js           # UI management
├── server/             # Node.js backend
│   ├── server.js       # Express API server
│   └── users.json      # User database
├── images/             # Chess piece images
├── sounds/             # Game sound effects
└── index.html          # Main game page
```

## 🌐 Deployment

### Frontend (GitHub Pages)

The frontend automatically detects if it's running locally or in production.

**To deploy:**
1. Push code to GitHub
2. Go to repository Settings → Pages
3. Select branch: `main`, folder: `/` (root)
4. Visit `https://techchess.github.io/techchess`

### Backend (Render.com - Free)

1. Go to [Render.com](https://render.com) and sign up
2. Create new Web Service
3. Connect your GitHub repository
4. Configure:
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && node server.js`
   - **Environment:** Node
5. Add environment variable: `PORT` (Render will auto-assign)
6. Deploy!
7. Update `js/config.js` with your Render URL:
   ```javascript
   const API_URL = isLocalhost 
       ? 'http://localhost:8020/api'
       : 'https://your-app-name.onrender.com/api';
   ```

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript, CSS3, HTML5
- **Backend:** Node.js, Express.js
- **Chess Engine:** Chess.js + Custom Bitboard Engine
- **Authentication:** JWT
- **Storage:** JSON file database (localStorage for settings)

## 🎯 AI Features

- **Minimax Algorithm** with Alpha-Beta Pruning
- **Iterative Deepening** for time management
- **Transposition Tables** for position caching
- **Move Ordering** (MVV-LVA, Killer moves, History heuristic)
- **Quiescence Search** for tactical sequences
- **Opening Book** trained on Lichess master games
- **Multiple Difficulty Levels**

## 🎨 Customization

- **4 Piece Styles:** Classic, Modern, Stone, Neo
- **5 Board Themes:** Brown, Green, Blue, Purple, Grey
- **3 Difficulty Levels:** Too Easy, Just for Fun, Standard

## 📝 License

MIT License - feel free to use this project for learning and fun!

## 🤝 Contributing

Pull requests welcome! This is a learning project inspired by Sebastian Lague's chess programming videos.

## 🎓 Credits

- AI algorithms inspired by [Sebastian Lague](https://www.youtube.com/c/SebastianLague)
- Chess piece images from various open-source sets
- Opening book trained on Lichess game database

---

Made with ❤️ for chess enthusiasts and coding learners
