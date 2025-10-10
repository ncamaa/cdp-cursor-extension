import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export class CursorMCPConfigurator {
  private extensionPath: string;

  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
  }

  /**
   * Automatically configure the MCP server in Cursor settings
   */
  async autoConfigureMCP(): Promise<boolean> {
    try {
      const cursorConfigPath = this.getCursorConfigPath();
      if (!cursorConfigPath) {
        return false;
      }

      const mcpConfig = this.generateMCPConfig();
      await this.updateCursorSettings(cursorConfigPath, mcpConfig);
      
      return true;
    } catch (error) {
      console.error('Failed to auto-configure MCP:', error);
      return false;
    }
  }

  /**
   * Get the path to Cursor's settings.json
   */
  private getCursorConfigPath(): string | null {
    const homeDir = os.homedir();
    const platform = process.platform;

    let configDir: string;

    if (platform === 'darwin') {
      configDir = path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'User');
    } else if (platform === 'win32') {
      configDir = path.join(homeDir, 'AppData', 'Roaming', 'Cursor', 'User');
    } else {
      configDir = path.join(homeDir, '.config', 'Cursor', 'User');
    }

    const settingsPath = path.join(configDir, 'settings.json');
    
    // Check if Cursor config directory exists
    if (!fs.existsSync(configDir)) {
      return null;
    }

    return settingsPath;
  }

  /**
   * Generate MCP server configuration
   */
  private generateMCPConfig(): MCPServerConfig {
    const serverPath = path.join(this.extensionPath, 'out', 'cdp-mcp-server.js');
    
    return {
      command: 'node',
      args: [serverPath],
      env: {
        CDP_PORT: '9222',
        TARGET_RE: '.*'
      }
    };
  }

  /**
   * Update Cursor's settings.json with MCP configuration
   */
  private async updateCursorSettings(settingsPath: string, mcpConfig: MCPServerConfig): Promise<void> {
    let settings: any = {};

    // Read existing settings if file exists
    if (fs.existsSync(settingsPath)) {
      try {
        const settingsContent = fs.readFileSync(settingsPath, 'utf8');
        settings = JSON.parse(settingsContent);
      } catch (error) {
        console.error('Failed to parse existing settings:', error);
        settings = {};
      }
    }

    // Add or update MCP servers configuration
    if (!settings.mcpServers) {
      settings.mcpServers = {};
    }

    settings.mcpServers['cdp-debug-server'] = mcpConfig;

    // Write updated settings
    const settingsJson = JSON.stringify(settings, null, 2);
    
    // Ensure directory exists
    const settingsDir = path.dirname(settingsPath);
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }

    fs.writeFileSync(settingsPath, settingsJson, 'utf8');
  }

  /**
   * Check if MCP server is already configured
   */
  async isConfigured(): Promise<boolean> {
    const cursorConfigPath = this.getCursorConfigPath();
    if (!cursorConfigPath || !fs.existsSync(cursorConfigPath)) {
      return false;
    }

    try {
      const settingsContent = fs.readFileSync(cursorConfigPath, 'utf8');
      const settings = JSON.parse(settingsContent);
      
      return settings.mcpServers && settings.mcpServers['cdp-debug-server'];
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove MCP configuration from Cursor settings
   */
  async removeMCPConfig(): Promise<boolean> {
    try {
      const cursorConfigPath = this.getCursorConfigPath();
      if (!cursorConfigPath || !fs.existsSync(cursorConfigPath)) {
        return true; // Nothing to remove
      }

      const settingsContent = fs.readFileSync(cursorConfigPath, 'utf8');
      const settings = JSON.parse(settingsContent);

      if (settings.mcpServers && settings.mcpServers['cdp-debug-server']) {
        delete settings.mcpServers['cdp-debug-server'];
        
        // Remove mcpServers object if empty
        if (Object.keys(settings.mcpServers).length === 0) {
          delete settings.mcpServers;
        }

        const settingsJson = JSON.stringify(settings, null, 2);
        fs.writeFileSync(cursorConfigPath, settingsJson, 'utf8');
      }

      return true;
    } catch (error) {
      console.error('Failed to remove MCP config:', error);
      return false;
    }
  }

  /**
   * Get user-friendly setup instructions
   */
  getManualSetupInstructions(): string {
    const serverPath = path.join(this.extensionPath, 'out', 'cdp-mcp-server.js');
    
    return `
# Manual MCP Setup for CDP Debug Server

## Step 1: Open Cursor Settings
1. Open Cursor Settings (Cmd/Ctrl + ,)
2. Search for "MCP" 
3. Click "Edit in settings.json"

## Step 2: Add MCP Server Configuration
Add this to your settings.json:

\`\`\`json
{
  "mcpServers": {
    "cdp-debug-server": {
      "command": "node",
      "args": ["${serverPath}"],
      "env": {
        "CDP_PORT": "9222",
        "TARGET_RE": ".*"
      }
    }
  }
}
\`\`\`

## Step 3: Restart Cursor
Completely restart Cursor for the MCP server to be recognized.

## Step 4: Test
Ask Cursor: "Check for console errors" - it should use MCP tools automatically!
`;
  }
}



