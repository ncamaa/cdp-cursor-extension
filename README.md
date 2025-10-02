# CDP Debug for Cursor - Standalone Extension

**The completely standalone Chrome DevTools Protocol debugging extension for Cursor IDE.**

No external dependencies. No setup required. Just install and debug! 🚀

## 🎯 What is this?

A VS Code/Cursor extension that eliminates the tedious copy-pasting of console errors and network data from DevTools. Cursor AI can automatically fetch debugging data from your browser in real-time!

## ⚡ Quick Start

1. **Install the Extension** (from .vsix or Marketplace)
2. **Open any project** in Cursor
3. **Click "Initialize"** when prompted (adds Cursor rules)
4. **Run Command**: `CDP: Open Chrome With Cursor Connection`
5. **Start Debugging!** Cursor AI can now auto-fetch browser debugging data!

## ✨ What Makes This Special

### 🔄 **Traditional Debugging (Manual)**
```
You: "My login is broken"
Cursor: "Can you share the error message?"
You: *opens DevTools, copies console error*
You: *pastes error*
Cursor: "Can you share the network request?"
You: *copies network tab data*
You: *pastes network data*
Cursor: "I see the issue..."
```

### 🤖 **With CDP Debug Extension (Automatic)**
```
You: "My login is broken"
Cursor: *automatically runs*
  curl -s http://localhost:3100/api/logs?type=error&limit=5
  curl -s http://localhost:3100/api/network?url=login&limit=5
Cursor: "I see a 401 error. The request is missing the email field..."
```

## 🚀 Key Features

- ✅ **Completely Standalone** - No external packages or dependencies
- ✅ **Auto Project Init** - Prompts to initialize CDP Debug for each project
- ✅ **One-Click Connection** - Single command launches Chrome + Server
- ✅ **Cursor AI Integration** - Auto-generates `.cursor/rules/cdp-debug.md`
- ✅ **Real-Time Capture** - Console logs, network requests, errors, timing
- ✅ **Smart Status Bar** - Visual indicator of connection status
- ✅ **Zero Configuration** - Works out of the box

## 📚 How It Works

### Project Initialization
When you open a project folder, the extension asks:
> "Would you like to initialize CDP Debug for this project?"

**If you click "Initialize":**
- Creates `.cursor/rules/cdp-debug.md` with API instructions
- Cursor AI learns how to fetch debugging data automatically
- Ready to debug!

### Chrome Connection
Run command: **`CDP: Open Chrome With Cursor Connection`**

This automatically:
1. 🚀 Launches Chrome with debugging enabled
2. 🔧 Starts the CDP server in the background
3. 🔗 Connects to Chrome via Chrome DevTools Protocol
4. 📊 Begins capturing all console logs and network activity
5. ✅ Updates status bar to show "CDP: Connected"

## 🎮 Commands

Access via Command Palette (`Cmd/Ctrl+Shift+P`):

| Command | Description |
|---------|-------------|
| **`CDP: Open Chrome With Cursor Connection`** | Launches Chrome + starts server (main command) |
| **`CDP: Stop Connection`** | Stops Chrome and server |
| **`CDP: Initialize Project`** | Manually add Cursor rules to project |
| **`CDP: Open Server Dashboard`** | Opens server health endpoint |

## 📊 Status Bar Indicator

Bottom-right corner shows connection status:

- `🔴 CDP: Off` - Not connected (click to start)
- `🟢 CDP: Connected` - Active connection (click to stop)

## 🌐 API Endpoints (Auto-used by Cursor)

When connected, Cursor AI can use these endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Server status and statistics |
| `GET /api/logs?type=error&limit=10` | Recent console errors |
| `GET /api/logs?limit=20` | All console logs |
| `GET /api/network?limit=10` | Network requests with responses |
| `GET /api/network?url=login` | Filter by URL pattern |
| `GET /api/responses?status=404` | Failed requests |
| `GET /api/stats` | Debugging statistics |

## 🎯 Real-World Examples

### Example 1: Login Issues
**You**: "Login button doesn't work"

**Cursor AI automatically fetches**:
```bash
curl -s http://localhost:3100/api/logs?type=error&limit=5
curl -s http://localhost:3100/api/network?url=login&limit=3
```

**Cursor AI**: "I see a 401 error from POST /api/login. The request body shows you're sending 'username' but the API expects 'email'. Also, there's a JavaScript error: 'Cannot read property token of undefined' at login.js:45. Here's the fix..."

### Example 2: Performance Issues
**You**: "Page loads slowly"

**Cursor AI automatically fetches**:
```bash
curl -s http://localhost:3100/api/network?limit=50 | jq '.network[] | select(.duration > 1000)'
```

**Cursor AI**: "I found 3 slow requests. The /api/users endpoint takes 2.3 seconds and returns 50MB of data. You should add pagination..."

### Example 3: CORS Errors
**You**: "Getting weird network errors"

**Cursor AI automatically fetches**:
```bash
curl -s http://localhost:3100/api/logs?type=error | jq '.logs[] | select(.message | test("cors"; "i"))'
```

**Cursor AI**: "You have CORS errors. The request to https://api.external.com is being blocked. Add the origin to your CORS configuration..."

## 🔧 Project Structure

After initialization, your project will have:
```
your-project/
├── .cursor/
│   └── rules/
│       └── cdp-debug.md    # Auto-generated Cursor AI instructions
└── ... (your project files)
```

## 🛠️ Configuration

Single setting in VS Code/Cursor preferences:

| Setting | Default | Description |
|---------|---------|-------------|
| `cdpDebug.autoInitProjects` | `true` | Automatically prompt to initialize new projects |

## 📦 Installation

### From VS Code Marketplace (Future)
```bash
ext install cdp-debug.cdp-debug-cursor
```

### From .vsix File
1. Download the latest `.vsix` file
2. In Cursor: Extensions > "..." menu > "Install from VSIX..."
3. Select the `.vsix` file
4. Reload Cursor

### From Source
```bash
git clone https://github.com/ncamaa/cdp-cursor-extension.git
cd cdp-cursor-extension
pnpm install
pnpm run compile
# Press F5 to debug
```

## 🐛 Troubleshooting

### Extension doesn't activate
- Check Extensions panel for errors
- Reload window (`Cmd/Ctrl+Shift+P` > "Reload Window")

### Chrome won't launch
- Verify Chrome is installed at default location
- Close all existing Chrome instances first
- Check Output panel (View > Output > "CDP Debug Server") for errors

### No data being captured
- Ensure you're using the Chrome window launched by the extension
- Check server health: `curl http://localhost:3100/health`
- Refresh your webpage after connecting
- Make sure you're on the correct Chrome tab

### Cursor not using the API
- Check `.cursor/rules/cdp-debug.md` exists in your project
- Restart Cursor after initialization
- Try running `CDP: Initialize Project` manually

### Server connection fails
- Check if ports 3100 or 9222 are in use by other processes
- View Output panel for detailed error messages
- Try stopping and restarting the connection

## 🎉 What Makes This Extension Unique

1. **Completely Standalone** - Everything bundled, no external dependencies
2. **Smart Initialization** - Prompts per project, remembers your choice
3. **One-Click Debugging** - Single command does everything
4. **Automatic AI Integration** - Cursor learns to fetch data without training
5. **Real Browser Context** - Actual console logs and network data, not guesses

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📝 License

MIT

## 🔗 Links

- **GitHub Repository**: [cdp-cursor-extension](https://github.com/ncamaa/cdp-cursor-extension)
- **Report Issues**: [GitHub Issues](https://github.com/ncamaa/cdp-cursor-extension/issues)
- **Cursor Documentation**: [Cursor Docs](https://cursor.com/docs)

---

**It's like giving Cursor AI eyes into your browser!** 👀

**Made for Cursor developers by developers** 🚀
