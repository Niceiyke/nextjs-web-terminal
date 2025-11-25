# Next.js Web-Based SSH Terminal

A modern, full-featured web-based terminal interface built with **Next.js 14**, **TypeScript**, and **xterm.js** to access your VPS via SSH. Features a built-in connection manager with encrypted credential storage.

## ✨ Features

- 🚀 **Next.js 14 App Router** - Modern React architecture with Server Components
- 💪 **TypeScript** - Full type safety throughout the application
- 🎨 **Tailwind CSS** - Utility-first styling with custom terminal theme
- 🖥️ **xterm.js** - Full terminal emulation with 256 color support
- 🔐 **Secure Authentication** - Session-based web login with iron-session
- 🗄️ **SQLite Database** - Lightweight, file-based database for connections
- 🔒 **Encrypted Storage** - Passwords encrypted using AES-256-CBC
- ➕ **Connection Management** - Add, edit, and delete VPS connections via UI
- 🔄 **Multi-Connection Support** - Switch between different VPS servers
- 🔑 **Advanced SSH Key Management**:
  - Upload SSH keys directly through the UI
  - Generate SSH key pairs in the browser
  - Multiple SSH keys per connection with automatic fallback
  - Display SSH key fingerprints for verification
  - Support for both file paths and uploaded key content
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile
- 🌐 **Clickable URLs** - Web links in terminal output are clickable
- ⚡ **Performance** - Optimized builds with Next.js

## 📋 Prerequisites

- **Node.js** 18+ 
- **npm**, **yarn**, or **pnpm**
- Access to one or more VPS via SSH

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd nextjs-web-terminal
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure your settings:

```env
# Session Secret (generate a random 32+ character string)
SESSION_SECRET=your-random-secret-key-min-32-chars

# Encryption Key (generate a different random 32+ character string)
ENCRYPTION_KEY=your-random-encryption-key-min-32-chars

# Web Authentication
WEB_USERNAME=admin
WEB_PASSWORD=change-this-password
```

**Important:** Generate secure random keys for production:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Login

Use the credentials you set in `.env`:
- **Username**: `admin` (or your custom username)
- **Password**: Your configured password

### 5. Add Your First Connection

1. Click the **"Connections"** button in the header
2. Click **"Add New Connection"**
3. Fill in your VPS details:
   - **Connection Name**: A friendly name (e.g., "Production Server")
   - **Host**: Your VPS IP or domain
   - **Port**: SSH port (usually 22)
   - **Username**: SSH username
   - **Password**: SSH password (or use SSH key)
4. Click **"Create Connection"**

### 6. Connect to Your VPS

1. Go back to the terminal (click "Back to Terminal")
2. Select your connection from the dropdown
3. Click **"Connect"**
4. Start using your terminal!

---

## 🏗️ Project Structure

```
nextjs-web-terminal/
├── src/
│   ├── app/
│   │   ├── page.tsx                      # Main terminal page
│   │   ├── login/page.tsx                # Login page
│   │   ├── connections/page.tsx          # Connection management
│   │   ├── layout.tsx                    # Root layout
│   │   └── api/
│   │       ├── auth/                     # Authentication APIs
│   │       └── connections/              # Connection CRUD APIs
│   ├── components/
│   │   ├── Terminal.tsx                  # xterm.js terminal component
│   │   ├── Header.tsx                    # Header with navigation
│   │   └── LoginForm.tsx                 # Login form component
│   ├── lib/
│   │   ├── config.ts                     # Configuration
│   │   ├── session.ts                    # Session management
│   │   └── db.ts                         # Database & encryption
│   └── styles/
│       └── globals.css                   # Global styles + Tailwind
├── data/
│   └── connections.db                    # SQLite database (auto-created)
├── server.js                             # Custom server (Next.js + WS)
├── package.json
├── tsconfig.json
└── next.config.js
```

## 🗄️ Database & Security

### Database

- **Type**: SQLite (file-based, no external dependencies)
- **Location**: `data/connections.db` (auto-created on first run)
- **Schema**: Connections table with encrypted credentials

### Encryption

- **Algorithm**: AES-256-CBC
- **Key Derivation**: scrypt with salt
- **Encrypted Fields**: 
  - SSH passwords
  - SSH key passphrases
  - Uploaded SSH key content
- **Key Storage**: Environment variable (`ENCRYPTION_KEY`)

**Security Best Practices:**
- Never commit `.env` file
- Use strong, unique encryption keys
- Backup your database regularly
- Set proper file permissions on `data/` directory
- Use HTTPS in production

## ⚙️ SSH Authentication Methods

### Password Authentication

When adding a connection, select "Password" and enter your SSH password. The password will be encrypted before storage.

### SSH Key Authentication

The terminal supports multiple ways to use SSH keys:

#### Option 1: File Path (Traditional)

1. Select "SSH Key" as authentication method
2. Choose "File Path" as key type
3. Enter the **full path** to your private key file (e.g., `/home/user/.ssh/id_rsa`)
4. If your key has a passphrase, enter it (will be encrypted)
5. Ensure the server running the terminal can access the key file

#### Option 2: Upload Key

1. Select "SSH Key" as authentication method
2. Choose "Upload Key" as key type
3. Click "Browse" and select your private key file
4. If your key has a passphrase, enter it
5. The key content is encrypted and stored in the database

#### Option 3: Generate New Key Pair

1. Select "SSH Key" as authentication method
2. Click **"Generate Key Pair"**
3. A new 4096-bit RSA key pair will be generated
4. Download both the private and public keys
5. Add the public key to your server's `~/.ssh/authorized_keys`
6. The private key is automatically added to your connection

### Multiple SSH Keys with Fallback

You can add multiple SSH keys to a single connection:

1. Add your first key (upload, file path, or generate)
2. Click **"Add Key"** to add it to the connection
3. Repeat for additional keys
4. Set one key as "Primary" (tried first)
5. If the primary key fails, the system automatically tries the next key

**Benefits:**
- Increased reliability - fallback if one key fails
- Multiple authentication methods
- Easy key rotation without downtime

### SSH Key Fingerprints

All generated and uploaded keys display their SHA256 fingerprint. This helps you:
- Verify you're using the correct key
- Match keys with server-side authorized_keys
- Track which key is being used for each connection

## 🔧 Connection Management

### Adding Connections

1. Navigate to `/connections`
2. Click "Add New Connection"
3. Fill in the form with your VPS details
4. Click "Create Connection"

### Editing Connections

1. Find your connection in the list
2. Click "Edit"
3. Modify the details (leave password blank to keep existing)
4. Click "Update Connection"

### Deleting Connections

1. Find your connection in the list
2. Click "Delete"
3. Confirm the deletion

### Using Connections

1. On the main terminal page, select a connection from the dropdown
2. Click "Connect"
3. The terminal will establish an SSH connection
4. Switch connections anytime by selecting a different one

## 🏭 Production Deployment

### Build for Production

```bash
npm run build
npm start
```

### Production Checklist

- ✅ Set strong passwords in `.env`
- ✅ Generate secure `SESSION_SECRET` (32+ chars)
- ✅ Generate secure `ENCRYPTION_KEY` (32+ chars)
- ✅ Use HTTPS with SSL certificates
- ✅ Configure firewall rules
- ✅ Prefer SSH key authentication
- ✅ Set `NODE_ENV=production`
- ✅ Backup `data/connections.db` regularly
- ✅ Set proper file permissions
- ✅ Deploy behind reverse proxy (nginx/Apache)

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=<generated-secure-key>
ENCRYPTION_KEY=<generated-secure-key>
WEB_AUTH_ENABLED=true
WEB_USERNAME=admin
WEB_PASSWORD=<strong-password>
```

### Reverse Proxy (nginx example)

```nginx
server {
    listen 80;
    server_name terminal.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🛠️ Development

### Run Development Mode

```bash
npm run dev
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## 🐛 Troubleshooting

### Connection Issues

**Problem:** "No connection selected"
- Add a connection in `/connections` first
- Select a connection from the dropdown
- Click "Connect" button

**Problem:** "SSH connection failed"
- Verify credentials in connection settings
- Check VPS firewall allows SSH connections
- Test SSH access manually: `ssh username@host`
- Check server logs for detailed error messages

**Problem:** "Failed to read private key file"
- Verify the private key path is correct and absolute
- Ensure the server process has read permissions
- Check the key file exists and is a valid SSH key
- **Alternative**: Use "Upload Key" instead of file path to store key in database

**Problem:** "No valid SSH keys found"
- Check that you've added at least one SSH key to the connection
- Verify uploaded keys contain valid SSH private key format
- For file-based keys, ensure paths are correct and accessible
- Try regenerating keys using the built-in key generator

### Database Issues

**Problem:** "Error loading connections"
- Check `data/` directory exists and is writable
- Verify `ENCRYPTION_KEY` is set in `.env`
- Check file permissions on `data/connections.db`

**Problem:** "Connection not found after adding"
- Refresh the page
- Check browser console for errors
- Verify database file is writable

### Terminal Display Issues

**Problem:** Terminal doesn't render
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check browser console for JavaScript errors

## 📦 Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Terminal**: xterm.js + addons (fit, web-links)
- **Backend**: Node.js + Custom Server
- **Database**: better-sqlite3 (SQLite)
- **Encryption**: Node.js crypto module
- **WebSocket**: ws library
- **SSH**: ssh2 client
- **Session**: iron-session

## 🔒 Security Recommendations

1. **Use HTTPS in production** - Obtain SSL certificates (Let's Encrypt)
2. **Strong passwords** - Use password managers
3. **Secure encryption keys** - Generate with crypto.randomBytes
4. **SSH keys preferred** - More secure than passwords
5. **Environment variables** - Never commit sensitive data
6. **Rate limiting** - Implement to prevent brute force
7. **IP whitelisting** - Restrict access to known IPs
8. **Regular updates** - Keep dependencies updated
9. **Monitor logs** - Watch for suspicious activity
10. **Separate servers** - Don't host terminal on target VPS
11. **Backup database** - Regular backups of `data/connections.db`
12. **File permissions** - Restrict access to data directory

## 📄 License

MIT License

## 🙋 Support

For issues or questions, check the documentation or review the code comments.

---

**Author:** MiniMax Agent  
**Version:** 3.0.0  
**Features:** Advanced SSH key management with upload, generation, and multi-key fallback  
**Built with:** Next.js 14 + TypeScript + Tailwind CSS + xterm.js + SQLite  
**Last Updated:** 2025-11-25
