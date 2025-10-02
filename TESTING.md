# Testing & Development Guide

## ✅ Extension Status

The CDP Debug for Cursor extension is ready for testing!

### What's Complete

- ✅ TypeScript compilation successful
- ✅ All dependencies installed
- ✅ Extension commands registered
- ✅ Status bar integration
- ✅ Chrome launcher
- ✅ Server management
- ✅ Cursor rules generation
- ✅ Configuration settings
- ✅ Documentation

## 🧪 Testing the Extension

### Method 1: Debug Mode (Recommended for Development)

1. **Open Extension Project in Cursor/VS Code**
   ```bash
   cd /Users/ncpersonal/local-sites/cdp-cursor-extension
   code . # or cursor .
   ```

2. **Press F5** (or Run > Start Debugging)
   - This opens a new "Extension Development Host" window
   - The extension is loaded in this window
   - You can set breakpoints in `src/extension.ts`

3. **Test Commands**
   - Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
   - Type "CDP" to see all commands
   - Try: `CDP: Launch Debug Chrome`
   - Try: `CDP: Start Debug Server`
   - Check status bar for "CDP: Running" indicator

4. **Test in a Real Project**
   - In the Extension Development Host window, open a web project
   - Run `CDP: Launch Debug Chrome`
   - Open your localhost site in the debug Chrome
   - Run `CDP: Start Debug Server`
   - Check `.cursor/rules/cdp-debug.md` was created
   - Test API: `curl http://localhost:3100/health`

5. **View Logs**
   - View > Output
   - Select "CDP Debug Server" from dropdown
   - See real-time server output

### Method 2: Install Locally

1. **Package the Extension**
   ```bash
   cd /Users/ncpersonal/local-sites/cdp-cursor-extension
   pnpm run package
   ```
   This creates `cdp-debug-cursor-0.1.0.vsix`

2. **Install in Cursor/VS Code**
   ```bash
   # For VS Code
   code --install-extension cdp-debug-cursor-0.1.0.vsix
   
   # For Cursor (usually same command)
   cursor --install-extension cdp-debug-cursor-0.1.0.vsix
   ```

3. **Or Install via GUI**
   - Open Extensions panel
   - Click "..." menu
   - Select "Install from VSIX..."
   - Choose the .vsix file

4. **Reload Window**
   - Command Palette > "Reload Window"
   - Extension is now active!

## 🎯 Testing Checklist

### Basic Functionality
- [ ] Extension activates on startup
- [ ] Status bar shows "CDP: Off"
- [ ] All commands appear in Command Palette
- [ ] Chrome launches with debug port
- [ ] Server starts successfully
- [ ] Status bar updates to "CDP: Running"
- [ ] Output channel shows server logs
- [ ] Server stops cleanly
- [ ] Status bar returns to "CDP: Off"

### Chrome Launcher Tests
- [ ] Chrome launches on macOS
- [ ] Chrome uses port 9222 (check `chrome://version/` in debug Chrome)
- [ ] Can launch Chrome when already running (shows warning)
- [ ] Chrome user data dir is `/tmp/chrome-debug-cdp`

### Server Tests
- [ ] Server starts from workspace with CDP server code
- [ ] Server health endpoint responds: `curl http://localhost:3100/health`
- [ ] Can view server logs in Output panel
- [ ] Server stops cleanly (no orphan processes)
- [ ] Can restart server after stopping

### Cursor Rules Tests
- [ ] `.cursor/rules/` directory is created
- [ ] `cdp-debug.md` file is generated
- [ ] File contains correct port number
- [ ] File contains API documentation
- [ ] Can open rules file from command
- [ ] Rules are not regenerated if already exist

### Integration Tests
1. **Test with Real Web App**
   - Launch Chrome
   - Start server
   - Open localhost site in debug Chrome
   - Trigger console.log
   - Make API call
   - Verify data captured: `curl http://localhost:3100/api/logs`
   - Verify network captured: `curl http://localhost:3100/api/network`

2. **Test Cursor AI Integration**
   - Ask Cursor: "Check for errors"
   - Verify Cursor can run curl commands
   - Verify Cursor gets debugging data
   - Test with real debugging scenario

### Configuration Tests
- [ ] Change server port in settings
- [ ] Change Chrome port in settings
- [ ] Enable auto-start server
- [ ] Verify auto-start works on workspace open

### Error Handling Tests
- [ ] Server fails gracefully if port in use
- [ ] Chrome fails gracefully if already running
- [ ] Clear error messages for missing dependencies
- [ ] Offers to install CDP server if not found

## 📊 Expected Behavior

### On Activation
```
Console Output:
CDP Debug extension activated
```

### On "Launch Chrome"
```
Status Bar: No change (Chrome runs independently)
Message: "Chrome launched with debugging on port 9222"
```

### On "Start Server"
```
Status Bar: "CDP: Off" → "CDP: Running"
Output Panel: Server startup logs
Message: "CDP Server started on http://localhost:3100"
File Created: .cursor/rules/cdp-debug.md
```

### On "Stop Server"
```
Status Bar: "CDP: Running" → "CDP: Off"
Output Panel: "Server exited with code 0"
Message: "CDP Server stopped"
```

## 🐛 Common Issues

### Issue: Extension doesn't activate
**Solution**: Check Extensions panel for errors, reload window

### Issue: Chrome doesn't launch
**Solution**: 
- Verify Chrome is installed at `/Applications/Google Chrome.app/`
- Close all Chrome instances first
- Check if port 9222 is available: `lsof -i :9222`

### Issue: Server won't start
**Solution**:
- Ensure you're in a workspace folder
- Check if port 3100 is available: `lsof -i :3100`
- Verify CDP server code exists in workspace
- Check Output panel for errors

### Issue: No data being captured
**Solution**:
- Verify Chrome was launched by the extension
- Check server health: `curl http://localhost:3100/health`
- Refresh the webpage after starting server
- Ensure you're on the right Chrome tab

### Issue: Cursor rules not working
**Solution**:
- Verify `.cursor/rules/cdp-debug.md` exists
- Restart Cursor
- Check Cursor Settings > Rules are enabled

## 🔬 Manual Testing Script

Run this in your terminal to test the API:

```bash
# 1. Check server health
curl -s http://localhost:3100/health | jq

# 2. Open test page in debug Chrome
# (Open http://localhost:5173 or any local site)

# 3. Trigger some console logs and API calls in your site

# 4. Test API endpoints
curl -s http://localhost:3100/api/logs?limit=5 | jq
curl -s http://localhost:3100/api/network?limit=5 | jq
curl -s http://localhost:3100/api/logs?type=error | jq
curl -s http://localhost:3100/api/stats | jq

# 5. Clear data
curl -X POST http://localhost:3100/api/clear

# 6. Verify cleared
curl -s http://localhost:3100/api/stats | jq
```

## 📦 Building for Distribution

### Create Package
```bash
pnpm run package
# Creates: cdp-debug-cursor-0.1.0.vsix
```

### Test Package
```bash
code --install-extension cdp-debug-cursor-0.1.0.vsix
# Restart VS Code/Cursor
# Test all functionality
```

### Publish to Marketplace (Future)
```bash
# Get publisher token from https://marketplace.visualstudio.com/
vsce publish
```

## 🎓 Next Steps After Testing

1. ✅ Verify all tests pass
2. 📝 Document any issues found
3. 🐛 Fix any bugs
4. 📦 Create final .vsix package
5. 🚀 Publish to VS Code Marketplace
6. 📢 Announce to Cursor community!

## 💡 Tips

- Use `pnpm run watch` for live compilation during development
- Check the Debug Console for extension logs
- Use breakpoints in extension.ts for debugging
- Test with different workspace scenarios
- Test both with and without CDP server in workspace

## 🤝 Contributing

If you find issues during testing:
1. Note the exact steps to reproduce
2. Check console/output for errors
3. Create detailed bug report
4. Submit PR with fix if possible

---

Happy testing! 🎉

