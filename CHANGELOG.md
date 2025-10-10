# Change Log

All notable changes to **Cursor Browser Inspector** will be documented in this file.

---

## [0.2.0] - 2025-10-10

### 🎉 **Major Release: Hybrid MCP + HTTP Integration**

#### **New Name**
- Renamed from "CDP Debug for Cursor" to **"Cursor Browser Inspector"**
- Better communicates value: Give Cursor AI direct access to browser DevTools
- Improved marketplace discoverability

#### **Added**
- **Dual Protocol Support**: MCP + HTTP API hybrid approach
- **MCP Server**: Native Model Context Protocol integration for Cursor AI
- **Automatic MCP Configuration**: One-click MCP setup in Cursor settings
- **Lazy CDP Connection**: MCP server connects to Chrome only when needed
- **Improved Target Detection**: Filters out DevTools tabs, focuses on real web pages
- **Auto-Configuration Class**: `CursorMCPConfigurator` for seamless MCP setup
- **Graceful Fallback**: Automatically falls back to HTTP if MCP unavailable

#### **MCP Tools**
- `check_connection_status` - Verify CDP server connection to Chrome
- `get_console_logs` - Get browser console logs with filtering
- `get_network_requests` - Get network requests with responses
- `get_failed_requests` - Get failed requests (4xx, 5xx)
- `get_server_stats` - Get aggregated debugging statistics
- `clear_debug_data` - Clear all stored debugging data

#### **Changed**
- Renamed internal files for clarity
- Updated Cursor rules to support both MCP and HTTP
- Improved error messages and user feedback
- Enhanced connection reliability

#### **Fixed**
- HTTP server connection status now shows correctly
- Target detection avoids DevTools tabs
- Multiple CDP connection conflicts resolved
- MCP server no longer fails on startup without Chrome

#### **Documentation**
- Complete marketplace-ready README
- MCP integration guide
- User experience documentation
- Troubleshooting guides

---

## [0.1.0] - 2025-10-02

### 🎉 **Initial Release**

#### **Added**
- Initial release of CDP Debug for Cursor extension
- Command to launch Chrome with debugging enabled
- Command to start/stop CDP debug server in background
- Auto-generation of `.cursor/rules/cdp-debug.md` for AI integration
- Status bar indicator showing server state
- Support for macOS, Linux, and Windows Chrome paths
- Configuration settings for server and Chrome ports
- Auto-start server option
- Output channel for server logs
- Automatic detection of local vs global CDP server installation
- Support for workspace detection of CDP server repository

#### **Features**
- **CDP: Launch Debug Chrome** - One-click Chrome launch with debugging
- **CDP: Start Debug Server** - Background server management
- **CDP: Stop Debug Server** - Clean server shutdown
- **CDP: Setup Cursor Rules** - Manual rule generation
- **CDP: Open Server Dashboard** - Quick access to server health
- Real-time console log capture
- Network request/response monitoring
- Automatic Cursor AI integration via rules
- Smart server detection and fallback options

---

## [Unreleased]

### **Planned Features**
- Multiple Chrome profile support
- Request/response filtering in extension UI
- Export debugging sessions to files
- WebSocket support for real-time updates
- Screenshot capture on errors
- Custom event triggers and webhooks
- Performance metrics dashboard
- Browser automation capabilities

---

## **Migration Guide**

### **From v0.1.0 to v0.2.0**

#### **Breaking Changes**
- None! Fully backward compatible

#### **New Features Available**
1. **MCP Support**: Run command and choose "Auto-Configure MCP"
2. **Hybrid Mode**: Both MCP and HTTP run simultaneously
3. **Better Target Detection**: Automatically finds your app tab

#### **Recommended Actions**
1. Update extension to v0.2.0
2. Run `CDP: Open Chrome With Cursor Connection`
3. Choose "Auto-Configure MCP" when prompted
4. Restart Cursor for MCP integration
5. Enjoy enhanced debugging experience!

---

## **Support**

- **📖 Documentation**: [GitHub README](https://github.com/ncamaa/cdp-cursor-extension#readme)
- **🐛 Report Issues**: [GitHub Issues](https://github.com/ncamaa/cdp-cursor-extension/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/ncamaa/cdp-cursor-extension/discussions)
- **⭐ Star on GitHub**: Show your support!

---

**Thank you for using Cursor Browser Inspector!** 🚀
