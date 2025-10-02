# Change Log

All notable changes to the "CDP Debug for Cursor" extension will be documented in this file.

## [0.1.0] - 2025-10-02

### Added
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

### Features
- **CDP: Launch Debug Chrome** - One-click Chrome launch with debugging
- **CDP: Start Debug Server** - Background server management
- **CDP: Stop Debug Server** - Clean server shutdown
- **CDP: Setup Cursor Rules** - Manual rule generation
- **CDP: Open Server Dashboard** - Quick access to server health
- Real-time console log capture
- Network request/response monitoring
- Automatic Cursor AI integration via rules
- Smart server detection and fallback options

### Documentation
- Comprehensive README with usage examples
- Troubleshooting guide
- API endpoint documentation
- Configuration options

## [Unreleased]

### Planned
- MCP (Model Context Protocol) server integration
- Multiple Chrome profile support
- Request/response filtering in extension UI
- Export debugging sessions
- WebSocket support for real-time updates
- Screenshot capture on errors
- Custom event triggers and webhooks

