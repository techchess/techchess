# Tech Chess Backend Setup Instructions

## Prerequisites

- Node.js installed (download from https://nodejs.org/)
- A Gmail account (for sending verification emails)

## Step 1: Install Node.js Dependencies

Open a terminal and run:

```bash
cd "server"
npm install
```

This will install:
- express (web server)
- cors (cross-origin requests)
- bcryptjs (password hashing)
- jsonwebtoken (authentication tokens)
- nodemailer (email sending)

## Step 2: Configure Email (Gmail)

### Option A: Use Gmail App Password (Recommended)

1. Go to your Google Account: https://myaccount.google.com/
2. Click "Security" in the left sidebar
3. Under "How you sign in to Google", click "2-Step Verification"
4. Scroll down and click "App passwords"
5. Select "Mail" and your device
6. Click "Generate"
7. Copy the 16-character password

### Option B: Skip Email (Development Only)

For testing without email, the server will show the verification code in the API response.

### Update server.js

Open `server/server.js` and replace these lines (around line 32):

```javascript
auth: {
    user: 'YOUR_EMAIL@gmail.com',     // Replace with your Gmail
    pass: 'YOUR_APP_PASSWORD'          // Replace with App Password
}
```

**Example:**
```javascript
auth: {
    user: 'myemail@gmail.com',
    pass: 'abcd efgh ijkl mnop'  // The 16-character app password
}
```

## Step 3: Start the Backend Server

In the terminal (from the `server` directory):

```bash
npm start
```

You should see:
```
🚀 Tech Chess API running on http://localhost:3000
📊 Users database: /path/to/server/users.json
```

## Step 4: Start the Frontend Server

Open a **new terminal** window and run:

```bash
cd "/Users/arthurbuckley/tech chess"
python3 -m http.server 8020
```

## Step 5: Test the System

1. Open your browser to: http://localhost:8020/landing.html
2. Click "Sign Up"
3. Create an account
4. Check your email for the 6-digit verification code
5. Enter the code to verify
6. Login with your username and password

## Troubleshooting

### "Cannot find module 'express'"
- Run `npm install` in the server directory

### Email not sending
- Check your Gmail App Password is correct
- Make sure 2-Step Verification is enabled on your Google account
- Check the server console for error messages
- For development, the verification code will appear in the API response

### CORS errors
- Make sure the backend server is running on port 3000
- Make sure the frontend is on port 8020
- Check browser console for specific errors

### "Port already in use"
- Kill any process using port 3000: `lsof -ti:3000 | xargs kill -9`
- Or change the PORT in server.js

## Testing Without Email Setup

If you want to test without setting up email:

1. Start the server
2. Sign up for an account
3. Check the server terminal - it will print the verification code
4. Or check the browser network tab - the response includes the code

## File Structure

```
server/
  ├── server.js       # Main backend server
  ├── package.json    # Dependencies
  └── users.json      # User database (auto-created)
```

## Important Notes

- **users.json** is automatically created when the first user signs up
- The JWT_SECRET in production should be a secure random string
- For production, use a real database (MongoDB, PostgreSQL)
- Keep your Gmail App Password secure and never commit it to git

## Production Deployment

For production:
1. Use environment variables for secrets
2. Replace in-memory database with MongoDB/PostgreSQL
3. Add rate limiting
4. Enable HTTPS
5. Use a professional email service (SendGrid, AWS SES)

