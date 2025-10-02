import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import CDPDebugServer from './cdp-server';
import ChromeLauncher from './chrome-launcher';

let cdpServer: CDPDebugServer | null = null;
let chromeLauncher: ChromeLauncher | null = null;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    console.log('CDP Debug extension activated');

    // Create output channel for server logs
    outputChannel = vscode.window.createOutputChannel('CDP Debug Server');
    context.subscriptions.push(outputChannel);

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
    if (cdpServer && chromeLauncher) {
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

        // Step 2: Start CDP Server
        outputChannel.appendLine('🔧 Starting CDP Debug Server...');
        cdpServer = new CDPDebugServer(3100, 9222, '.*');
        
        // Redirect server logs to output channel
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        
        console.log = (message: any, ...args: any[]) => {
            outputChannel.appendLine(String(message));
            if (args.length > 0) {
                outputChannel.appendLine(args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' '));
            }
        };
        
        console.error = (message: any, ...args: any[]) => {
            outputChannel.appendLine(`ERROR: ${String(message)}`);
            if (args.length > 0) {
                outputChannel.appendLine(args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' '));
            }
        };

        // Start the server
        await cdpServer.startServer();
        
        // Try to connect to CDP
        const connected = await cdpServer.connectToCDP();
        
        // Restore console
        console.log = originalConsoleLog;
        console.error = originalConsoleError;

        if (connected) {
            updateStatusBar(true);
            vscode.window.showInformationMessage(
                '✅ CDP Debug connected! Chrome and server are running.',
                'Open Dashboard',
                'View Output'
            ).then(selection => {
                if (selection === 'Open Dashboard') {
                    openServerDashboard();
                } else if (selection === 'View Output') {
                    outputChannel.show();
                }
            });
        } else {
            throw new Error('Failed to connect to Chrome DevTools Protocol');
        }

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
    if (cdpServer) {
        try {
            await cdpServer.disconnect();
        } catch (error) {
            console.error('Error disconnecting CDP server:', error);
        }
        cdpServer = null;
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

function openServerDashboard() {
    const url = 'http://localhost:3100/health';
    vscode.env.openExternal(vscode.Uri.parse(url));
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
    return `# CDP Debug Server - Automated Debugging

## Context
This project uses CDP Debug Server for automated browser debugging. The extension captures console logs and network requests from Chrome in real-time and exposes them via a local API.

## Server Information
- **Server URL**: http://localhost:3100
- **Chrome Debug Port**: 9222
- **Status**: Check \`curl -s http://localhost:3100/health\`

## Available Debugging Tools

When debugging frontend issues, you can automatically fetch debugging data from the local CDP server.

### Quick Commands

**Check server status:**
\`\`\`bash
curl -s http://localhost:3100/health | jq
\`\`\`

**Get recent errors:**
\`\`\`bash
curl -s http://localhost:3100/api/logs?type=error&limit=10 | jq
\`\`\`

**Get console logs:**
\`\`\`bash
curl -s http://localhost:3100/api/logs?limit=20 | jq
\`\`\`

**Get network requests:**
\`\`\`bash
curl -s http://localhost:3100/api/network?limit=10 | jq
\`\`\`

**Get failed API calls:**
\`\`\`bash
curl -s http://localhost:3100/api/responses?status=404&limit=5 | jq
curl -s http://localhost:3100/api/responses?status=500&limit=5 | jq
\`\`\`

**Filter by URL pattern:**
\`\`\`bash
curl -s http://localhost:3100/api/network?url=login&limit=5 | jq
curl -s http://localhost:3100/api/network?url=api&limit=10 | jq
\`\`\`

## Debugging Workflow

### Before analyzing any bug:
1. Verify server is running: \`curl -s http://localhost:3100/health\`
2. If not running, use VS Code command: "CDP: Open Chrome With Cursor Connection"
3. Fetch recent errors if frontend issue
4. Fetch network requests if API issue
5. Analyze the real browser data

### When user reports an error:
- Auto-fetch recent errors: \`curl -s http://localhost:3100/api/logs?type=error&limit=5\`
- Check network activity: \`curl -s http://localhost:3100/api/network?limit=10\`
- Look for 4xx/5xx responses
- Analyze timing and request/response data

### When debugging specific features (e.g., "login broken"):
- Filter console logs: \`curl -s http://localhost:3100/api/logs | jq '.logs[] | select(.message | test("login"; "i"))'\`
- Filter network requests: \`curl -s http://localhost:3100/api/network?url=login\`
- Check for authentication errors
- Verify request payloads and headers

## API Endpoints Reference

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| \`GET /health\` | Server status and statistics | - |
| \`GET /api/logs\` | Console logs | \`limit\`, \`type\` (error, warn, log, info, debug) |
| \`GET /api/requests\` | Network requests | \`limit\`, \`method\`, \`url\` |
| \`GET /api/responses\` | Network responses | \`limit\`, \`status\`, \`url\` |
| \`GET /api/network\` | Request/response pairs | \`limit\`, \`url\` |
| \`GET /api/stats\` | Aggregated statistics | - |
| \`POST /api/clear\` | Clear all stored data | - |

## Examples

### Example 1: Debug Login Failure
\`\`\`bash
# Check for login-related errors
curl -s http://localhost:3100/api/logs?type=error | jq '.logs[] | select(.message | test("login"; "i"))'

# Get login API calls with full details
curl -s http://localhost:3100/api/network?url=login&limit=5 | jq '.network[] | {
  method: .request.method,
  url: .request.url,
  status: .response.status,
  duration: .duration,
  requestBody: .request.postData,
  responseBody: .response.body
}'
\`\`\`

### Example 2: Find Slow Requests
\`\`\`bash
curl -s http://localhost:3100/api/network?limit=50 | jq '.network[] | select(.duration > 1000) | {
  url: .request.url,
  method: .request.method,
  duration: .duration,
  status: .response.status
}'
\`\`\`

### Example 3: Check CORS Issues
\`\`\`bash
curl -s http://localhost:3100/api/logs?type=error | jq '.logs[] | select(.message | test("cors"; "i"))'
\`\`\`

### Example 4: Monitor API Health
\`\`\`bash
# Get all API responses with status codes
curl -s http://localhost:3100/api/network?url=api | jq '.network[] | {
  endpoint: .request.url,
  method: .request.method,
  status: .response.status,
  duration: .duration
} | select(.status >= 400)'
\`\`\`

## Best Practices

- **Always fetch real browser data** before suggesting fixes
- The server stores the last 1000 items per type
- Response bodies are captured for JSON responses < 50KB
- Use \`jq\` for better JSON formatting and filtering
- Clear old data when needed: \`curl -X POST http://localhost:3100/api/clear\`
- Server automatically reconnects if Chrome tab changes

## When to Use CDP Debug Server

Use this debugging data when:
- User reports JavaScript errors or console issues
- Debugging API request/response problems
- Investigating performance issues (slow requests)
- Understanding execution flow and timing
- Tracking down race conditions
- Analyzing network failures or CORS issues
- Debugging authentication/authorization problems

## Important Notes

- The CDP server only captures data from the Chrome instance launched by the extension
- Make sure to use the debug Chrome window for testing your application
- The server automatically detects and connects to active tabs
- Data is stored in memory and cleared when the server restarts
- All timestamps are in milliseconds since epoch

This gives you real context about what's happening in the browser instead of guessing based on code analysis alone.`;
}

export function deactivate() {
    cleanup();
}