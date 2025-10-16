import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import CDPMCPServer from './cdp-mcp-server';
import CDPDebugServer from './cdp-server-legacy'; // Keep legacy for reference
import ChromeLauncher from './chrome-launcher';
import { CursorMCPConfigurator } from './cursor-mcp-config';

let mcpServer: CDPMCPServer | null = null;
let mcpProcess: ChildProcess | null = null;
let legacyServer: CDPDebugServer | null = null; // For fallback
let chromeLauncher: ChromeLauncher | null = null;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    console.log('CDP Debug extension activated');

    // Create output channel for server logs
    outputChannel = vscode.window.createOutputChannel('CDP Debug Server');
    context.subscriptions.push(outputChannel);

    // Initialize MCP configurator
    const mcpConfigurator = new CursorMCPConfigurator(context.extensionPath);

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(debug-disconnect) CDP: Off';
    statusBarItem.tooltip = 'CDP Debug Server - Click to connect';
    statusBarItem.command = 'cdp-debug.openChromeWithConnection';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('cdp-debug.openChromeWithConnection', openChromeWithConnection),
        vscode.commands.registerCommand('cdp-debug.stopConnection', stopConnection),
        vscode.commands.registerCommand('cdp-debug.initProject', initProject),
        vscode.commands.registerCommand('cdp-debug.copyMCPConfig', () => copyMCPConfiguration(context)),
        vscode.commands.registerCommand('cdp-debug.openServerDashboard', openServerDashboard)
    );

    // Check if we should prompt for project initialization
    if (vscode.workspace.workspaceFolders) {
        checkForProjectInit();
    }

    // Listen for workspace folder changes
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
        if (vscode.workspace.workspaceFolders) {
            checkForProjectInit();
        }
    });
}

async function checkForProjectInit() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const cursorRulesPath = path.join(workspaceFolder.uri.fsPath, '.cursor', 'rules', 'cdp-debug.md');
    const hasRules = fs.existsSync(cursorRulesPath);

    if (!hasRules) {
        // Show initialization prompt
        const response = await vscode.window.showInformationMessage(
            'Would you like to initialize CDP Debug for this project? This will add Cursor rules for automatic debugging data fetching.',
            'Initialize',
            'Not now',
            "Don't ask again"
        );

        if (response === 'Initialize') {
            await initProject();
        } else if (response === "Don't ask again") {
            // Create a marker file to remember the user's choice
            const markerPath = path.join(workspaceFolder.uri.fsPath, '.cursor', '.cdp-debug-skip');
            const cursorDir = path.dirname(markerPath);
            if (!fs.existsSync(cursorDir)) {
                fs.mkdirSync(cursorDir, { recursive: true });
            }
            fs.writeFileSync(markerPath, '');
        }
    }
}

async function initProject() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    try {
        const cursorRulesDir = path.join(workspaceFolder.uri.fsPath, '.cursor', 'rules');
        const rulesFilePath = path.join(cursorRulesDir, 'cdp-debug.md');

        // Create .cursor/rules directory if it doesn't exist
        if (!fs.existsSync(cursorRulesDir)) {
            fs.mkdirSync(cursorRulesDir, { recursive: true });
        }

        // Generate cursor rules
        const rulesContent = generateCursorRules();
        fs.writeFileSync(rulesFilePath, rulesContent, 'utf8');

        vscode.window.showInformationMessage(
            '✅ CDP Debug initialized! Cursor can now automatically fetch debugging data.',
            'Open Rules',
            'Start Debugging'
        ).then(selection => {
            if (selection === 'Open Rules') {
                vscode.workspace.openTextDocument(rulesFilePath).then(doc => {
                    vscode.window.showTextDocument(doc);
                });
            } else if (selection === 'Start Debugging') {
                openChromeWithConnection();
            }
        });

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to initialize project: ${error}`);
    }
}

async function openChromeWithConnection() {
    if (mcpServer && legacyServer && chromeLauncher) {
        vscode.window.showWarningMessage('CDP Debug is already running');
        return;
    }

    try {
        outputChannel.clear();
        outputChannel.show(true);

        // Step 1: Launch Chrome with debugging
        outputChannel.appendLine('🚀 Starting Chrome with debugging...');
        chromeLauncher = new ChromeLauncher({
            port: 9222,
            userDataDir: path.join(require('os').tmpdir(), 'cdp-cursor-debug')
        });

        await chromeLauncher.launch();
        
        // Wait a moment for Chrome to fully start
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 2: Check and configure MCP if needed
        const mcpConfigurator = new CursorMCPConfigurator(vscode.extensions.getExtension('cdp-debug.cdp-debug-cursor')?.extensionPath || __dirname);
        const isMCPConfigured = await mcpConfigurator.isConfigured();
        
        if (!isMCPConfigured) {
            const response = await vscode.window.showInformationMessage(
                '🤖 Configure MCP for better Cursor AI integration?',
                'Auto-Configure MCP',
                'Use HTTP API Only',
                'Manual Setup'
            );

            if (response === 'Auto-Configure MCP') {
                const configured = await mcpConfigurator.autoConfigureMCP();
                if (configured) {
                    vscode.window.showInformationMessage(
                        '✅ MCP configured! Please restart Cursor to activate MCP tools.',
                        'Restart Cursor',
                        'Continue with HTTP'
                    ).then(selection => {
                        if (selection === 'Restart Cursor') {
                            vscode.commands.executeCommand('workbench.action.reloadWindow');
                        }
                    });
                } else {
                    outputChannel.appendLine('⚠️ MCP auto-configuration failed, falling back to HTTP API');
                }
            } else if (response === 'Manual Setup') {
                const instructions = mcpConfigurator.getManualSetupInstructions();
                const tempFile = path.join(require('os').tmpdir(), 'cdp-mcp-manual-setup.md');
                fs.writeFileSync(tempFile, instructions);
                vscode.workspace.openTextDocument(tempFile).then(doc => {
                    vscode.window.showTextDocument(doc);
                });
            }
        }

        // Step 3: Start both servers (hybrid approach)
        outputChannel.appendLine('🔧 Starting CDP Servers (MCP + HTTP)...');
        
        let mcpStarted = false;
        let httpStarted = false;

        // Try to start MCP server
        try {
            const mcpServerPath = path.join(__dirname, 'cdp-mcp-server.js');
            mcpProcess = spawn('node', [mcpServerPath], {
                env: {
                    ...process.env,
                    CDP_PORT: '9222',
                    TARGET_RE: '.*'
                },
                stdio: ['pipe', 'pipe', 'pipe']
            });

            mcpProcess.stdout?.on('data', (data) => {
                outputChannel.appendLine(`MCP: ${data.toString()}`);
            });

            mcpProcess.stderr?.on('data', (data) => {
                outputChannel.appendLine(`MCP Error: ${data.toString()}`);
            });

            mcpProcess.on('exit', (code) => {
                outputChannel.appendLine(`MCP Server exited with code ${code}`);
                mcpProcess = null;
            });

            await new Promise(resolve => setTimeout(resolve, 1000));
            mcpStarted = true;
            outputChannel.appendLine('✅ MCP Server started');
        } catch (error) {
            outputChannel.appendLine(`⚠️ MCP Server failed to start: ${error}`);
        }

        // Step 4: Create shared CDP connection first
        mcpServer = new CDPMCPServer(9222, '.*');
        const connected = await mcpServer.connectToCDP();
        
        if (!connected) {
            throw new Error('Failed to connect to Chrome DevTools Protocol. Make sure Chrome is running and has an active tab.');
        }
        
        outputChannel.appendLine('✅ CDP connection established');

        // Step 5: Start HTTP server with shared connection
        try {
            legacyServer = new CDPDebugServer(3100, 9222, '.*');
            // Don't let HTTP server create its own CDP connection
            await legacyServer.startServer();
            // Force the HTTP server to use our established connection
            await legacyServer.connectToCDP();
            httpStarted = true;
            outputChannel.appendLine('✅ HTTP API Server started on port 3100');
        } catch (error) {
            outputChannel.appendLine(`⚠️ HTTP Server failed to start: ${error}`);
            // HTTP server failure is not critical since MCP is working
        }

        // Update status and show success message
        updateStatusBar(true);
        
        let statusMessage = '✅ CDP Debug connected! ';
        if (mcpStarted && httpStarted) {
            statusMessage += 'MCP + HTTP servers running.';
        } else if (mcpStarted) {
            statusMessage += 'MCP server running.';
        } else if (httpStarted) {
            statusMessage += 'HTTP API server running.';
        }

        vscode.window.showInformationMessage(
            statusMessage,
            'View Output',
            'Test Tools'
        ).then(selection => {
            if (selection === 'View Output') {
                outputChannel.show();
            } else if (selection === 'Test Tools') {
                const testMessage = mcpStarted ? 
                    'MCP tools available! Try: "Check for console errors"' :
                    'HTTP API available! Try: "Check for console errors"';
                vscode.window.showInformationMessage(testMessage);
            }
        });

    } catch (error) {
        outputChannel.appendLine(`❌ Error: ${error}`);
        vscode.window.showErrorMessage(`Failed to start CDP Debug: ${error}`);
        await cleanup();
    }
}

async function stopConnection() {
    try {
        outputChannel.appendLine('🛑 Stopping CDP Debug...');
        
        await cleanup();
        updateStatusBar(false);
        
        vscode.window.showInformationMessage('CDP Debug stopped');
        outputChannel.appendLine('✅ CDP Debug stopped successfully');
        
    } catch (error) {
        vscode.window.showErrorMessage(`Error stopping CDP Debug: ${error}`);
        outputChannel.appendLine(`❌ Error stopping: ${error}`);
    }
}

async function cleanup() {
    if (mcpProcess) {
        try {
            mcpProcess.kill();
            mcpProcess = null;
        } catch (error) {
            console.error('Error stopping MCP process:', error);
        }
    }

    if (mcpServer) {
        try {
            await mcpServer.disconnect();
        } catch (error) {
            console.error('Error disconnecting MCP server:', error);
        }
        mcpServer = null;
    }

    if (legacyServer) {
        try {
            await legacyServer.disconnect();
        } catch (error) {
            console.error('Error disconnecting legacy server:', error);
        }
        legacyServer = null;
    }

    if (chromeLauncher) {
        try {
            await chromeLauncher.stop();
        } catch (error) {
            console.error('Error stopping Chrome:', error);
        }
        chromeLauncher = null;
    }
}

async function copyMCPConfiguration(context: vscode.ExtensionContext) {
    const mcpServerPath = path.join(context.extensionPath, 'out', 'cdp-mcp-server.js');
    
    const mcpConfig = {
        "cursor-browser-inspector": {
            "command": "node",
            "args": [mcpServerPath],
            "env": {
                "CDP_PORT": "9222",
                "TARGET_RE": ".*"
            }
        }
    };

    const configJson = JSON.stringify(mcpConfig, null, 2);
    
    // Copy to clipboard
    await vscode.env.clipboard.writeText(configJson);
    
    // Show instructions
    const instructions = `
# ✅ MCP Configuration Copied to Clipboard!

## Next Steps:

1. **Open or create** ~/.cursor/mcp.json
2. **Add this inside** the "mcpServers" object:

${configJson}

3. **Save the file**
4. **Restart Cursor** completely
5. **Test**: Ask Cursor "Check for console errors"

## Complete Example:

\`\`\`json
{
  "mcpServers": {
    ${configJson.split('\n').slice(1, -1).join('\n    ')}
    // ... your other MCP servers ...
  }
}
\`\`\`

## MCP File Locations:
- **macOS/Linux**: ~/.cursor/mcp.json
- **Windows**: %USERPROFILE%\\.cursor\\mcp.json

The configuration is now in your clipboard - just paste it! 📋
`;

    // Show instructions in new document
    const doc = await vscode.workspace.openTextDocument({
        content: instructions,
        language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
    
    vscode.window.showInformationMessage(
        '✅ MCP configuration copied to clipboard!',
        'Open MCP Setup Guide'
    ).then(selection => {
        if (selection === 'Open MCP Setup Guide') {
            const guidePath = path.join(context.extensionPath, 'MCP-SETUP-GUIDE.md');
            vscode.workspace.openTextDocument(guidePath).then(doc => {
                vscode.window.showTextDocument(doc);
            });
        }
    });
}

function showMCPConfigurationInstructions(mcpServerCommand: string) {
    const instructions = `
# Configure CDP Debug MCP Server in Cursor

## Step 1: Open Cursor Settings
1. Open Cursor Settings (Cmd/Ctrl + ,)
2. Search for "MCP" or go to "Extensions" > "MCP"

## Step 2: Add MCP Server
Add this configuration:

**Server Name**: cdp-debug-server
**Command**: ${mcpServerCommand}
**Args**: (leave empty)
**Environment**: 
  CDP_PORT=9222
  TARGET_RE=.*

## Step 3: Restart Cursor
After adding the MCP server, restart Cursor for changes to take effect.

## Step 4: Test
Try asking: "Check for console errors" or "Show recent network requests"
Cursor should now use the MCP tools automatically!
`;

    // Create a temporary file with instructions
    const tempFile = path.join(require('os').tmpdir(), 'cdp-mcp-setup.md');
    fs.writeFileSync(tempFile, instructions);
    
    // Open the instructions
    vscode.workspace.openTextDocument(tempFile).then(doc => {
        vscode.window.showTextDocument(doc);
    });
}

function openServerDashboard() {
    vscode.window.showInformationMessage(
        'MCP Server runs on stdio (no HTTP dashboard). Use MCP tools instead!',
        'Configure MCP',
        'View Output',
        'Learn More'
    ).then(selection => {
        if (selection === 'Configure MCP') {
            const mcpServerPath = path.join(__dirname, 'cdp-mcp-server.js');
            showMCPConfigurationInstructions(`node "${mcpServerPath}"`);
        } else if (selection === 'View Output') {
            outputChannel.show();
        } else if (selection === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse('https://modelcontextprotocol.io/'));
        }
    });
}

function updateStatusBar(isRunning: boolean) {
    if (isRunning) {
        statusBarItem.text = '$(debug-start) CDP: Connected';
        statusBarItem.tooltip = 'CDP Debug Server is running\nClick to stop';
        statusBarItem.command = 'cdp-debug.stopConnection';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    } else {
        statusBarItem.text = '$(debug-disconnect) CDP: Off';
        statusBarItem.tooltip = 'CDP Debug Server is not running\nClick to start';
        statusBarItem.command = 'cdp-debug.openChromeWithConnection';
        statusBarItem.backgroundColor = undefined;
    }
}

function generateCursorRules(): string {
    return `# CDP Debug Server - Hybrid MCP + HTTP Integration

## Context
This project uses CDP Debug Server for automated browser debugging. The extension captures console logs and network requests from Chrome in real-time and exposes them via both MCP tools and HTTP API.

## Available Debugging Methods

### Method 1: MCP Tools (Preferred)
If MCP is configured, use these tools directly:

**Core Debugging Tools:**
- \`check_connection_status\` - Verify CDP server connection
- \`get_console_logs\` - Get browser console logs (params: limit, type)
- \`get_network_requests\` - Get network requests (params: limit, url_pattern, method)
- \`get_failed_requests\` - Get failed requests (params: limit, status_code)
- \`get_server_stats\` - Get debugging statistics
- \`clear_debug_data\` - Clear stored data

**Browser Automation Tools:**
- \`execute_javascript\` - Run any JavaScript in the browser page (params: code, return_value)
- \`get_page_html\` - Get HTML of page or specific element (params: selector)
- \`capture_screenshot\` - Take screenshot of current page (params: full_page)
- \`get_page_info\` - Get page URL, title, dimensions, scroll position

### Method 2: HTTP API (Fallback)
If MCP tools are not available, use these HTTP endpoints:

**Server Status:**
\`\`\`bash
curl -s http://localhost:3100/health | jq
\`\`\`

**Get Console Logs:**
\`\`\`bash
curl -s http://localhost:3100/api/logs?type=error&limit=10 | jq
curl -s http://localhost:3100/api/logs?limit=20 | jq
\`\`\`

**Get Network Requests:**
\`\`\`bash
curl -s http://localhost:3100/api/network?limit=10 | jq
curl -s http://localhost:3100/api/network?url=login&limit=5 | jq
\`\`\`

**Get Failed Requests:**
\`\`\`bash
curl -s http://localhost:3100/api/responses?status=404&limit=5 | jq
curl -s http://localhost:3100/api/responses?status=500&limit=5 | jq
\`\`\`

**Clear Data:**
\`\`\`bash
curl -X POST http://localhost:3100/api/clear
\`\`\`

## Debugging Workflow

### Automatic Method Detection
Try MCP tools first, fallback to HTTP API if MCP is not available.

### Before analyzing any bug:
1. **Check connection** (MCP: \`check_connection_status\` OR HTTP: \`curl -s http://localhost:3100/health\`)
2. If not running, use VS Code command: "CDP: Open Chrome With Cursor Connection"
3. Choose appropriate method based on availability

### When user reports an error:
**MCP Approach (Preferred):**
- Use \`get_console_logs\` tool with \`type: "error"\` and \`limit: 5\`
- Use \`get_failed_requests\` tool to find 4xx/5xx responses

**HTTP Fallback:**
- \`curl -s http://localhost:3100/api/logs?type=error&limit=5 | jq\`
- \`curl -s http://localhost:3100/api/responses | jq '.responses[] | select(.status >= 400)'\`

### When debugging specific features (e.g., "login broken"):
**MCP Approach (Preferred):**
- Use \`get_console_logs\` tool and filter results for login-related messages
- Use \`get_network_requests\` tool with \`url_pattern: "login"\`

**HTTP Fallback:**
- \`curl -s http://localhost:3100/api/logs | jq '.logs[] | select(.message | test("login"; "i"))'\`
- \`curl -s http://localhost:3100/api/network?url=login&limit=5 | jq\`

## MCP Tools Reference

| Tool | Description | Parameters |
|------|-------------|------------|
| \`check_connection_status\` | Server status and connection info | - |
| \`get_console_logs\` | Console logs from browser | \`limit\`, \`type\` |
| \`get_network_requests\` | Network requests with responses | \`limit\`, \`url_pattern\`, \`method\` |
| \`get_failed_requests\` | Failed requests (4xx, 5xx) | \`limit\`, \`status_code\` |
| \`get_server_stats\` | Aggregated statistics | - |
| \`clear_debug_data\` | Clear all stored data | - |

## Examples

### Example 1: Debug Login Failure
1. Use \`get_console_logs\` tool with \`type: "error"\` to find JavaScript errors
2. Use \`get_network_requests\` tool with \`url_pattern: "login"\` to get login API calls
3. Analyze the response status, request payload, and response body

### Example 2: Find Slow Requests
1. Use \`get_network_requests\` tool with \`limit: 50\`
2. Look for requests with high \`duration\` values (>1000ms)
3. Identify performance bottlenecks

### Example 3: Check CORS Issues
1. Use \`get_console_logs\` tool with \`type: "error"\`
2. Look for messages containing "cors" or "cross-origin"
3. Use \`get_failed_requests\` tool to see blocked requests

### Example 4: Monitor API Health
1. Use \`get_failed_requests\` tool to see all failed API calls
2. Use \`get_network_requests\` tool with \`url_pattern: "api"\` to see API performance
3. Check for patterns in failures

### Example 5: Test Login Flow (Automation)
1. Use \`get_page_html\` tool with \`selector: "#login-form"\` to find form structure
2. Use \`execute_javascript\` with \`code: "document.querySelector('#email').value = 'test@example.com'"\`
3. Use \`execute_javascript\` with \`code: "document.querySelector('#password').value = 'test123'"\`
4. Use \`execute_javascript\` with \`code: "document.querySelector('#login-button').click()"\`
5. Use \`get_console_logs\` to check for errors
6. Use \`get_network_requests\` with \`url_pattern: "login"\` to verify API call
7. Use \`capture_screenshot\` to verify result page

### Example 6: Verify Feature After Code Change
1. Use \`get_page_info\` to see current page state
2. Use \`execute_javascript\` to interact with the feature
3. Use \`capture_screenshot\` to verify visual result
4. Use \`get_console_logs\` to check for new errors

## Best Practices

### Debugging Data:
- **Always use MCP tools** to fetch real browser data before suggesting fixes
- The server stores the last 1000 items per type (console logs, requests, responses)
- Response bodies are captured for JSON responses < 50KB
- Use \`clear_debug_data\` tool to clear old data when starting fresh debugging sessions
- Server automatically reconnects if Chrome tab changes

### Browser Automation:
- **Use \`execute_javascript\`** to do anything: click, fill forms, navigate, read state
- **Use \`get_page_html\`** to understand page structure and find selectors
- **Use \`capture_screenshot\`** to verify visual results (AI can analyze images)
- **Use \`get_page_info\`** to verify navigation and page state
- Combine tools creatively - AI has full browser control via JavaScript

### Automation Examples:
- Click button: \`execute_javascript({ code: "document.querySelector('#btn').click()" })\`
- Fill input: \`execute_javascript({ code: "document.querySelector('#email').value = 'test@test.com'" })\`
- Read text: \`execute_javascript({ code: "document.querySelector('#username').textContent" })\`
- Navigate: \`execute_javascript({ code: "window.location.href = '/dashboard'" })\`
- Wait for element: \`execute_javascript({ code: "!!document.querySelector('#loaded')" })\` (retry until true)

## When to Use MCP Tools

### Debugging (Passive Observation):
- User reports JavaScript errors → \`get_console_logs\` with \`type: "error"\`
- Debugging API request/response issues → \`get_network_requests\`, \`get_failed_requests\`
- Investigating performance problems → \`get_network_requests\` to check duration
- Understanding execution flow → \`get_console_logs\` for application logs
- Tracking race conditions → \`get_network_requests\` to see request timing
- Analyzing authentication/authorization problems → \`get_failed_requests\` with status codes

### Automation (Active Testing):
- User asks to test a feature → \`execute_javascript\` to interact with UI
- User wants to verify code changes → \`get_page_html\` + \`execute_javascript\` + \`capture_screenshot\`
- User asks "does X work?" → Use automation tools to test and report back
- User wants visual verification → \`capture_screenshot\` (AI can analyze images)
- User asks to fill a form → \`execute_javascript\` to set values and submit

## Important Notes

- MCP tools provide direct access to browser debugging data via Model Context Protocol
- Data is captured in real-time from the Chrome instance launched by the extension
- All timestamps are in milliseconds since epoch
- The server automatically detects and connects to active Chrome tabs
- Data is stored in memory and cleared when the server restarts
- Use \`check_connection_status\` tool to verify connection before debugging

This gives you real context about what's happening in the browser instead of guessing based on code analysis alone.`;
}

export function deactivate() {
    cleanup();
}