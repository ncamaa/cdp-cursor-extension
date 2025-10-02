# Standalone CDP Debug Extension - Testing Guide

## ✅ **Extension Status: Ready for Testing!**

The completely standalone CDP Debug for Cursor extension is ready! Here's how to test it.

## 🎯 **What's New (Standalone Version)**

### **Old Workflow (Deprecated)**:
1. Install extension
2. Install CDP server separately
3. Launch Chrome manually
4. Start server manually
5. Setup Cursor rules manually

### **New Workflow (Standalone)**:
1. Install extension ✅
2. Open any project ✅
3. Click "Initialize" when prompted ✅
4. Run: `CDP: Open Chrome With Cursor Connection` ✅
5. **Everything else is automatic!** ✅

## 🧪 **Testing Steps**

### **Step 1: Install Extension**

**Option A: Debug Mode (Recommended)**
```bash
cd /Users/ncpersonal/local-sites/cdp-cursor-extension
cursor . # or code .
# Press F5 to start debugging
```

**Option B: Package and Install**
```bash
pnpm run package
cursor --install-extension cdp-debug-cursor-0.1.0.vsix
```

### **Step 2: Test Project Initialization**

1. **Open a new project folder** in Cursor (any folder)
2. **Wait for prompt**: "Would you like to initialize CDP Debug for this project?"
3. **Click "Initialize"**
4. **Verify**: `.cursor/rules/cdp-debug.md` was created
5. **Optional**: Click "Open Rules" to view the generated file

### **Step 3: Test Chrome Connection**

1. **Open Command Palette** (`Cmd/Ctrl+Shift+P`)
2. **Run**: `CDP: Open Chrome With Cursor Connection`
3. **Watch Output Panel** (View > Output > "CDP Debug Server")
4. **Verify**:
   - Chrome launches with debugging enabled
   - Server starts and connects to Chrome
   - Status bar shows "🟢 CDP: Connected"
   - Message: "CDP Debug connected! Chrome and server are running."

### **Step 4: Test Data Capture**

1. **In the debug Chrome window**, navigate to any website (e.g., `localhost:3000`, `google.com`)
2. **Open browser DevTools** (F12) and run some console commands:
   ```javascript
   console.log("Test message");
   console.error("Test error");
   console.warn("Test warning");
   ```
3. **Make some network requests** (navigate pages, submit forms, etc.)
4. **Test API endpoints**:
   ```bash
   # Check server health
   curl -s http://localhost:3100/health | jq
   
   # Get console logs
   curl -s http://localhost:3100/api/logs?limit=5 | jq
   
   # Get network requests
   curl -s http://localhost:3100/api/network?limit=5 | jq
   ```

### **Step 5: Test Cursor AI Integration**

1. **In Cursor**, ask a debugging question:
   - "Check for any console errors"
   - "Show me recent network requests"
   - "Are there any failed API calls?"
   
2. **Verify Cursor automatically runs** curl commands like:
   ```bash
   curl -s http://localhost:3100/api/logs?type=error&limit=5
   curl -s http://localhost:3100/api/network?limit=10
   ```

3. **Cursor should provide debugging insights** based on real browser data

### **Step 6: Test Cleanup**

1. **Run**: `CDP: Stop Connection`
2. **Verify**:
   - Chrome closes
   - Server stops
   - Status bar shows "🔴 CDP: Off"
   - No orphan processes remain

## ✅ **Expected Results**

### **Status Bar States**
- **Initial**: `🔴 CDP: Off` (click to start)
- **Connected**: `🟢 CDP: Connected` (click to stop)

### **Output Panel Logs**
```
🚀 Starting Chrome with debugging...
🔧 Starting CDP Debug Server...
🚀 CDP Debug Server running on http://localhost:3100
✅ Connected to Chrome DevTools Protocol
📝 [log] Test message
🌐 → GET https://www.google.com/
🌐 ← 200 https://www.google.com/ (145ms)
```

### **API Response Examples**
```json
// GET /health
{
  "status": "ok",
  "connected": true,
  "stats": {
    "consoleLogs": 5,
    "networkRequests": 12,
    "networkResponses": 12
  }
}

// GET /api/logs?limit=3
{
  "total": 5,
  "limit": 3,
  "logs": [
    {
      "id": "log-1234567890-0.123",
      "timestamp": 1234567890000,
      "type": "log",
      "message": "Test message"
    }
  ]
}
```

## 🎯 **Test Scenarios**

### **Scenario 1: First-Time User**
- Install extension
- Open any project
- Follow initialization prompt
- Test basic functionality
- **Expected**: Smooth onboarding, everything works

### **Scenario 2: Multiple Projects**
- Test with 3 different project folders
- Verify each gets its own `.cursor/rules/cdp-debug.md`
- Verify "Don't ask again" works
- **Expected**: Per-project initialization

### **Scenario 3: Real Debugging Session**
- Open a web development project
- Start local dev server (e.g., `npm start`)
- Connect CDP Debug
- Open localhost in debug Chrome
- Trigger actual errors and API calls
- Ask Cursor to debug real issues
- **Expected**: Cursor provides useful debugging insights

### **Scenario 4: Error Handling**
- Try connecting when Chrome already running
- Try connecting when ports are in use
- Try with no internet connection
- **Expected**: Graceful error handling and clear messages

## 🐛 **Known Issues & Workarounds**

### **Issue: Chrome won't launch**
**Symptoms**: Error in output panel, Chrome doesn't start
**Solutions**:
- Close all existing Chrome instances
- Check if Chrome is installed at default location
- Verify port 9222 is available: `lsof -i :9222`

### **Issue: Server won't connect**
**Symptoms**: "Failed to connect to Chrome DevTools Protocol"
**Solutions**:
- Wait 3-5 seconds after Chrome launches
- Refresh the webpage in debug Chrome
- Check if port 3100 is available: `lsof -i :3100`

### **Issue: No data captured**
**Symptoms**: API returns empty arrays
**Solutions**:
- Ensure you're using the debug Chrome window (not regular Chrome)
- Navigate to a webpage and interact with it
- Check browser console for the target tab

### **Issue: Cursor not using API**
**Symptoms**: Cursor doesn't run curl commands automatically
**Solutions**:
- Verify `.cursor/rules/cdp-debug.md` exists
- Restart Cursor after initialization
- Check Cursor Settings > Rules are enabled

## 📊 **Performance Expectations**

- **Chrome launch time**: 2-3 seconds
- **Server startup**: 1-2 seconds
- **CDP connection**: 1-2 seconds
- **Total connection time**: ~5-7 seconds
- **API response time**: <100ms
- **Memory usage**: ~50-100MB (Chrome + Server)

## 🎉 **Success Criteria**

**✅ Extension is ready for release if:**

1. **Installation works** in both debug and packaged modes
2. **Project initialization** prompts and creates rules correctly
3. **Chrome connection** launches Chrome and server successfully
4. **Data capture** collects console logs and network requests
5. **API endpoints** respond with correct data
6. **Cursor integration** automatically fetches debugging data
7. **Error handling** provides clear messages for common issues
8. **Cleanup** stops processes cleanly without orphans
9. **Multiple projects** work independently
10. **Performance** meets expectations (connection <10s, API <1s)

## 🚀 **Next Steps After Testing**

1. ✅ Fix any issues found during testing
2. 📝 Update documentation with any changes
3. 📦 Create final .vsix package
4. 🎯 Test in production environment
5. 📢 Prepare for release/distribution

## 💡 **Testing Tips**

- **Use Output Panel** to debug issues (View > Output > "CDP Debug Server")
- **Test with real projects** not just empty folders
- **Try different websites** in debug Chrome (localhost, external sites)
- **Test edge cases** (no internet, ports in use, Chrome crashes)
- **Verify cleanup** after each test (no orphan processes)
- **Test Cursor rules** with actual debugging questions

## 🎬 **Demo Script**

**Perfect demo sequence:**
1. "Let me show you CDP Debug for Cursor"
2. Open Cursor with any project
3. Show initialization prompt → click "Initialize"
4. Show generated `.cursor/rules/cdp-debug.md` file
5. Run `CDP: Open Chrome With Cursor Connection`
6. Show Chrome launching + server starting in Output panel
7. Navigate to a website, trigger console logs
8. Ask Cursor: "Check for any errors"
9. Show Cursor automatically running curl commands
10. Show Cursor providing debugging insights
11. Run `CDP: Stop Connection`
12. "That's it! Automatic browser debugging for Cursor AI"

---

**Ready to test! 🧪 Let's make sure everything works perfectly.**
