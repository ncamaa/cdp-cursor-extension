# How to Configure CDP Debug MCP Server in Cursor

## 🎯 **The Problem**

You're seeing "No MCP resources found" because Cursor doesn't know about our MCP server yet. We need to register it in Cursor's MCP settings.

## ✅ **The Solution**

### **Step 1: Find the MCP Server Executable**

After running `CDP: Open Chrome With Cursor Connection`, the MCP server is compiled to:
```
[Extension Path]/out/cdp-mcp-server.js
```

### **Step 2: Configure in Cursor Settings**

1. **Open Cursor Settings** (`Cmd/Ctrl + ,`)
2. **Search for "MCP"** in settings
3. **Add a new MCP server** with these settings:

| Setting | Value |
|---------|-------|
| **Name** | `cdp-debug-server` |
| **Command** | `node` |
| **Args** | `["/path/to/extension/out/cdp-mcp-server.js"]` |
| **Environment** | `CDP_PORT=9222, TARGET_RE=.*` |

### **Step 3: Get the Exact Path**

Run this command to get the exact path for your system:

```bash
# In the extension development host, open terminal and run:
echo "node \"$(find ~/.vscode* -name 'cdp-mcp-server.js' | head -1)\""
```

### **Step 4: Restart Cursor**

After adding the MCP server configuration, restart Cursor completely.

## 🧪 **Testing**

After configuration:
1. **Ask Cursor**: "Check for console errors"
2. **Expected**: Cursor uses `get_console_logs` tool
3. **Ask Cursor**: "Show recent network requests"  
4. **Expected**: Cursor uses `get_network_requests` tool

## 🤔 **Alternative: Simpler HTTP API Approach**

Since MCP configuration can be complex, we could also:

1. **Keep the Express HTTP server** alongside MCP
2. **Let Cursor use curl commands** (which work reliably)
3. **Add MCP as an enhancement** for future versions

This way users get immediate value without complex MCP setup.

## 💡 **Recommendation**

For the MVP version, let's:
1. **Use both servers** - Express for immediate use, MCP for future
2. **Default to Express API** in Cursor rules (curl commands)
3. **Provide MCP as optional advanced feature**

This gives users a working solution immediately while providing a path to MCP integration.

---

**What would you prefer? MCP-only or hybrid approach?**



