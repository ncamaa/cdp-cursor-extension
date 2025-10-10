# 🤖 MCP Setup Guide for Cursor Browser Inspector

## 🎯 **What is MCP?**

**MCP (Model Context Protocol)** lets Cursor AI use native "tools" to access your browser's debugging data - no curl commands, no JSON parsing, just seamless integration.

## ⚡ **Quick Setup (2 minutes)**

### **Step 1: Install Extension**
Install Cursor Browser Inspector from the VS Code Marketplace.

### **Step 2: Get MCP Configuration**
1. Run command: **`CDP: Copy MCP Configuration`**
2. Extension shows a popup with the exact configuration
3. Click **"Copy to Clipboard"**

### **Step 3: Add to Cursor**
1. Open **`~/.cursor/mcp.json`** (or create it if it doesn't exist)
2. **Paste** the configuration inside `"mcpServers": { }`
3. **Save** the file

**Your mcp.json should look like:**
```json
{
  "mcpServers": {
    "cursor-browser-inspector": {
      "command": "node",
      "args": ["/path/to/extension/out/cdp-mcp-server.js"],
      "env": {
        "CDP_PORT": "9222",
        "TARGET_RE": ".*"
      }
    }
  }
}
```

### **Step 4: Restart Cursor**
Restart Cursor completely for MCP to take effect.

### **Step 5: Test**
1. Run: `CDP: Open Chrome With Cursor Connection`
2. Ask Cursor: **"Check for console errors"**
3. Cursor should use MCP tools (you won't see curl commands)

---

## 🎬 **Visual Guide**

### **Before MCP Setup:**
```
You: "Check for errors"
Cursor: curl -s http://localhost:3100/api/logs?type=error&limit=5 | jq
        ↑ You see this curl command
```

### **After MCP Setup:**
```
You: "Check for errors"
Cursor: [Uses get_console_logs tool invisibly]
        ↑ No curl command visible, cleaner experience
```

---

## 📍 **Finding Your MCP Configuration File**

### **macOS:**
```bash
~/.cursor/mcp.json
# Full path: /Users/YOUR_USERNAME/.cursor/mcp.json
```

### **Linux:**
```bash
~/.cursor/mcp.json
# Full path: /home/YOUR_USERNAME/.cursor/mcp.json
```

### **Windows:**
```
%USERPROFILE%\.cursor\mcp.json
# Example: C:\Users\YOUR_USERNAME\.cursor\mcp.json
```

### **Creating the File (If It Doesn't Exist):**

**macOS/Linux:**
```bash
mkdir -p ~/.cursor
echo '{"mcpServers":{}}' > ~/.cursor/mcp.json
```

**Windows (PowerShell):**
```powershell
New-Item -Path "$env:USERPROFILE\.cursor" -ItemType Directory -Force
'{"mcpServers":{}}' | Out-File "$env:USERPROFILE\.cursor\mcp.json"
```

---

## 🔧 **Manual Configuration (If Auto-Config Doesn't Work)**

### **Step 1: Find Extension Path**

Run this command in terminal:
```bash
# macOS/Linux
find ~/.vscode* ~/.cursor -name "cdp-mcp-server.js" 2>/dev/null | grep cursor-browser-inspector

# Windows (PowerShell)
Get-ChildItem -Path "$env:USERPROFILE\.vscode*","$env:USERPROFILE\.cursor" -Recurse -Filter "cdp-mcp-server.js" | Where-Object { $_.FullName -match "cursor-browser-inspector" }
```

**Example output:**
```
/Users/username/.cursor/extensions/codamasoftware.cursor-browser-inspector-0.2.0/out/cdp-mcp-server.js
```

### **Step 2: Add to mcp.json**

Edit `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "cursor-browser-inspector": {
      "command": "node",
      "args": ["/Users/username/.cursor/extensions/codamasoftware.cursor-browser-inspector-0.2.0/out/cdp-mcp-server.js"],
      "env": {
        "CDP_PORT": "9222",
        "TARGET_RE": ".*"
      }
    }
  }
}
```

**Important**: Replace the path with your actual extension path from Step 1!

---

## ✅ **Verify MCP Setup**

### **Check 1: MCP File Exists**
```bash
cat ~/.cursor/mcp.json
```
Should show your MCP configuration.

### **Check 2: Path is Correct**
```bash
node /path/from/mcp.json
```
Should start the MCP server (press Ctrl+C to stop).

### **Check 3: Cursor Recognizes It**
1. Restart Cursor
2. Check Cursor Settings > Search "MCP"
3. Should see "cursor-browser-inspector" listed

### **Check 4: Tools Work**
1. Run: `CDP: Open Chrome With Cursor Connection`
2. Ask: "What MCP tools are available?"
3. Should list the 6 CDP debug tools

---

## 🐛 **Troubleshooting MCP**

### **"No MCP tools found"**
**Cause**: MCP server not configured or Cursor not restarted
**Fix**:
1. Check `~/.cursor/mcp.json` exists and has correct config
2. Restart Cursor completely (not just reload window)
3. Verify extension path is correct

### **"MCP server failed to start"**
**Cause**: Chrome not running or wrong path
**Fix**:
1. Make sure you run `CDP: Open Chrome With Cursor Connection` first
2. Verify the path in mcp.json points to actual file
3. Check Output panel for error details

### **"Error: ECONNREFUSED"**
**Cause**: MCP server trying to connect before Chrome is ready
**Fix**:
1. Always run `CDP: Open Chrome With Cursor Connection` before using MCP tools
2. Extension automatically starts Chrome first
3. MCP connects lazily when tools are used

---

## 🔄 **HTTP API Fallback**

### **Don't Want to Use MCP?**
No problem! The HTTP API works perfectly without any MCP configuration.

**Just:**
1. Run: `CDP: Open Chrome With Cursor Connection`
2. Ask Cursor debugging questions
3. Cursor will use curl commands (visible but reliable)

**Both methods provide the exact same debugging data!**

---

## 💡 **Pro Tips**

### **Tip 1: Use the Helper Command**
Run: **`CDP: Copy MCP Configuration`**
- Gets the exact path automatically
- Copies ready-to-paste JSON
- No manual path finding needed

### **Tip 2: Multiple Projects**
You only need to configure MCP **once**. It works for all your projects after that.

### **Tip 3: Check Status Anytime**
Ask Cursor: "Check MCP connection status"
- If MCP working: Shows connection details
- If MCP not working: Falls back to HTTP automatically

### **Tip 4: Update Path After Extension Update**
When the extension updates, the path changes. Just run `CDP: Copy MCP Configuration` again to get the new path.

---

## 🎉 **Benefits of MCP**

**With MCP:**
- ✅ Cleaner Cursor conversations (no visible curl commands)
- ✅ Faster tool execution (native protocol)
- ✅ Better error handling (structured responses)
- ✅ Type-safe data access
- ✅ Future-proof integration

**Without MCP (HTTP API):**
- ✅ Works immediately (no configuration)
- ✅ Universal compatibility
- ✅ Transparent (you see the commands)
- ✅ Easy to debug manually
- ✅ Same debugging data

**Choose what works best for you!** Both are fully supported.

---

## 📞 **Need Help?**

- **🐛 Report Issues**: [GitHub Issues](https://github.com/ncamaa/cdp-cursor-extension/issues)
- **💬 Ask Questions**: [GitHub Discussions](https://github.com/ncamaa/cdp-cursor-extension/discussions)
- **📖 Full Docs**: [GitHub README](https://github.com/ncamaa/cdp-cursor-extension)

---

**Happy debugging!** 🚀

