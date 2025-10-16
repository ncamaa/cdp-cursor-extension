#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import CDP from 'chrome-remote-interface';

interface ConsoleLog {
  id: string;
  timestamp: number;
  type: string;
  message: string;
  location?: string;
  stackTrace?: any;
}

interface NetworkRequest {
  id: string;
  requestId: string;
  timestamp: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  postData?: string;
}

interface NetworkResponse {
  id: string;
  requestId: string;
  timestamp: number;
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  duration?: number;
}

class CDPMCPServer {
  private client: any = null;
  private consoleLogs: ConsoleLog[] = [];
  private networkRequests: NetworkRequest[] = [];
  private networkResponses: NetworkResponse[] = [];
  private requestMap = new Map<string, NetworkRequest>();
  private maxStoredItems = 1000;
  private cdpPort: number;
  private targetPattern: RegExp;
  private server: Server;

  constructor(cdpPort = 9222, targetPattern = '.*') {
    this.cdpPort = cdpPort;
    this.targetPattern = new RegExp(targetPattern, 'i');
    
    this.server = new Server(
      {
        name: 'cdp-debug-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupMCPHandlers();
  }

  private setupMCPHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_console_logs',
            description: 'Get recent console logs from the browser',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of logs to return',
                  default: 20,
                },
                type: {
                  type: 'string',
                  description: 'Filter by log type (error, warn, log, info, debug)',
                  enum: ['error', 'warn', 'log', 'info', 'debug'],
                },
              },
            },
          },
          {
            name: 'get_network_requests',
            description: 'Get recent network requests and responses',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of requests to return',
                  default: 20,
                },
                url_pattern: {
                  type: 'string',
                  description: 'Filter by URL pattern (regex)',
                },
                method: {
                  type: 'string',
                  description: 'Filter by HTTP method',
                  enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
                },
              },
            },
          },
          {
            name: 'get_failed_requests',
            description: 'Get network requests that failed (4xx, 5xx status codes)',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of failed requests to return',
                  default: 10,
                },
                status_code: {
                  type: 'number',
                  description: 'Specific status code to filter by',
                },
              },
            },
          },
          {
            name: 'get_server_stats',
            description: 'Get statistics about captured debugging data',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'clear_debug_data',
            description: 'Clear all stored console logs and network data',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'check_connection_status',
            description: 'Check if the CDP server is connected to Chrome',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'execute_javascript',
            description: 'Execute JavaScript code in the browser page context. Returns the result.',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'JavaScript code to execute',
                },
                return_value: {
                  type: 'boolean',
                  description: 'Whether to return the execution result',
                  default: true,
                },
              },
              required: ['code'],
            },
          },
          {
            name: 'get_page_html',
            description: 'Get the HTML content of the current page or a specific element',
            inputSchema: {
              type: 'object',
              properties: {
                selector: {
                  type: 'string',
                  description: 'CSS selector for specific element (optional)',
                },
              },
            },
          },
          {
            name: 'capture_screenshot',
            description: 'Capture a screenshot of the current page',
            inputSchema: {
              type: 'object',
              properties: {
                full_page: {
                  type: 'boolean',
                  description: 'Capture full scrollable page',
                  default: false,
                },
              },
            },
          },
          {
            name: 'get_page_info',
            description: 'Get current page information (URL, title, state)',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ] satisfies Tool[],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_console_logs':
            return await this.handleGetConsoleLogs(args);
          
          case 'get_network_requests':
            return await this.handleGetNetworkRequests(args);
          
          case 'get_failed_requests':
            return await this.handleGetFailedRequests(args);
          
          case 'get_server_stats':
            return await this.handleGetServerStats(args);
          
          case 'clear_debug_data':
            return await this.handleClearDebugData(args);
          
          case 'check_connection_status':
            return await this.handleCheckConnectionStatus(args);
          
          case 'execute_javascript':
            return await this.handleExecuteJavaScript(args);
          
          case 'get_page_html':
            return await this.handleGetPageHTML(args);
          
          case 'capture_screenshot':
            return await this.handleCaptureScreenshot(args);
          
          case 'get_page_info':
            return await this.handleGetPageInfo(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${error}`,
            },
          ],
        };
      }
    });
  }

  private async handleGetConsoleLogs(args: any) {
    // Ensure CDP connection is established
    if (!this.client) {
      const connected = await this.connectToCDP();
      if (!connected) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Not connected to Chrome. Make sure Chrome is running with debugging enabled and has an active tab.',
            },
          ],
        };
      }
    }

    const limit = args?.limit || 20;
    const type = args?.type;

    let logs = this.consoleLogs;
    if (type) {
      logs = logs.filter(log => log.type === type);
    }

    const result = logs.slice(-limit).reverse(); // Most recent first

    return {
      content: [
        {
          type: 'text',
          text: `Found ${result.length} console logs (total: ${logs.length}):\n\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }

  private async handleGetNetworkRequests(args: any) {
    // Ensure CDP connection is established
    if (!this.client) {
      const connected = await this.connectToCDP();
      if (!connected) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: Not connected to Chrome. Make sure Chrome is running with debugging enabled and has an active tab.',
            },
          ],
        };
      }
    }

    const limit = args?.limit || 20;
    const urlPattern = args?.url_pattern;
    const method = args?.method;

    // Match requests with their responses
    const pairs = this.networkResponses.map(response => {
      const request = this.networkRequests.find(req => req.requestId === response.requestId);
      return {
        request,
        response,
        duration: response.duration
      };
    }).filter(pair => pair.request); // Only include pairs with both request and response

    let filtered = pairs;

    if (method) {
      filtered = filtered.filter(pair => pair.request?.method === method.toUpperCase());
    }

    if (urlPattern) {
      const regex = new RegExp(urlPattern, 'i');
      filtered = filtered.filter(pair => 
        pair.response && regex.test(pair.response.url)
      );
    }

    const result = filtered.slice(-limit).reverse();

    return {
      content: [
        {
          type: 'text',
          text: `Found ${result.length} network requests (total: ${filtered.length}):\n\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }

  private async handleGetFailedRequests(args: any) {
    const limit = args?.limit || 10;
    const statusCode = args?.status_code;

    let failedResponses = this.networkResponses.filter(res => res.status >= 400);
    
    if (statusCode) {
      failedResponses = failedResponses.filter(res => res.status === statusCode);
    }

    const result = failedResponses.slice(-limit).reverse();

    return {
      content: [
        {
          type: 'text',
          text: `Found ${result.length} failed requests:\n\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }

  private async handleGetServerStats(args: any) {
    const stats = {
      connected: this.client !== null,
      consoleLogs: {
        total: this.consoleLogs.length,
        byType: this.getLogStats()
      },
      networkRequests: {
        total: this.networkRequests.length,
        byMethod: this.getRequestStats()
      },
      networkResponses: {
        total: this.networkResponses.length,
        byStatus: this.getResponseStats()
      },
      cdpPort: this.cdpPort,
      targetPattern: this.targetPattern.source
    };

    return {
      content: [
        {
          type: 'text',
          text: `CDP Debug Server Statistics:\n\n${JSON.stringify(stats, null, 2)}`,
        },
      ],
    };
  }

  private async handleClearDebugData(args: any) {
    const beforeStats = {
      consoleLogs: this.consoleLogs.length,
      networkRequests: this.networkRequests.length,
      networkResponses: this.networkResponses.length
    };

    this.consoleLogs = [];
    this.networkRequests = [];
    this.networkResponses = [];
    this.requestMap.clear();

    return {
      content: [
        {
          type: 'text',
          text: `Debug data cleared successfully!\n\nBefore: ${JSON.stringify(beforeStats, null, 2)}\nAfter: All arrays empty`,
        },
      ],
    };
  }

  private async handleCheckConnectionStatus(args: any) {
    const status: any = {
      connected: this.client !== null,
      cdpPort: this.cdpPort,
      targetPattern: this.targetPattern.source,
      dataCount: {
        consoleLogs: this.consoleLogs.length,
        networkRequests: this.networkRequests.length,
        networkResponses: this.networkResponses.length
      }
    };

    if (this.client) {
      try {
        // Try to get current targets to verify connection
        const targets = await CDP.List({ port: this.cdpPort });
        const activeTargets = targets.filter((t: any) => t.type === 'page');
        status.activeTargets = activeTargets.length;
      } catch (error) {
        status.connectionError = String(error);
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `CDP Connection Status:\n\n${JSON.stringify(status, null, 2)}`,
        },
      ],
    };
  }

  private async handleExecuteJavaScript(args: any) {
    if (!this.client) {
      const connected = await this.connectToCDP();
      if (!connected) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Not connected to Chrome. Make sure Chrome is running with debugging enabled and has an active tab.',
          }],
        };
      }
    }
    
    const code = args?.code;
    const returnValue = args?.return_value !== false;
    
    try {
      const result = await this.client.Runtime.evaluate({
        expression: code,
        returnByValue: returnValue,
        awaitPromise: true,
      });
      
      if (result.exceptionDetails) {
        return {
          content: [{
            type: 'text',
            text: `JavaScript Error: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`,
          }],
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: `Result: ${JSON.stringify(result.result.value, null, 2)}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Execution failed: ${error}`,
        }],
      };
    }
  }

  private async handleGetPageHTML(args: any) {
    if (!this.client) {
      const connected = await this.connectToCDP();
      if (!connected) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Not connected to Chrome.',
          }],
        };
      }
    }
    
    const selector = args?.selector;
    
    const code = selector 
      ? `document.querySelector('${selector}')?.outerHTML || 'Element not found'`
      : `document.documentElement.outerHTML`;
    
    try {
      const result = await this.client.Runtime.evaluate({
        expression: code,
        returnByValue: true,
      });
      
      return {
        content: [{
          type: 'text',
          text: result.result.value || 'No HTML content',
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get HTML: ${error}`,
        }],
      };
    }
  }

  private async handleCaptureScreenshot(args: any) {
    if (!this.client) {
      const connected = await this.connectToCDP();
      if (!connected) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Not connected to Chrome.',
          }],
        };
      }
    }
    
    const fullPage = args?.full_page || false;
    
    try {
      const screenshot = await this.client.Page.captureScreenshot({
        format: 'png',
        captureBeyondViewport: fullPage,
      });
      
      return {
        content: [{
          type: 'text',
          text: `Screenshot captured (base64 PNG, ${screenshot.data.length} characters)\n\nFirst 200 chars: ${screenshot.data.substring(0, 200)}...\n\nTo view: Save the base64 data to a .png file or use an online base64 decoder.`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Screenshot failed: ${error}`,
        }],
      };
    }
  }

  private async handleGetPageInfo(args: any) {
    if (!this.client) {
      const connected = await this.connectToCDP();
      if (!connected) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Not connected to Chrome.',
          }],
        };
      }
    }
    
    try {
      const result = await this.client.Runtime.evaluate({
        expression: `JSON.stringify({
          url: window.location.href,
          title: document.title,
          readyState: document.readyState,
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY
        })`,
        returnByValue: true,
      });
      
      return {
        content: [{
          type: 'text',
          text: `Page Info:\n${result.result.value}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get page info: ${error}`,
        }],
      };
    }
  }

  private getLogStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const log of this.consoleLogs) {
      stats[log.type] = (stats[log.type] || 0) + 1;
    }
    return stats;
  }

  private getRequestStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const req of this.networkRequests) {
      stats[req.method] = (stats[req.method] || 0) + 1;
    }
    return stats;
  }

  private getResponseStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const res of this.networkResponses) {
      const statusRange = `${Math.floor(res.status / 100)}xx`;
      stats[statusRange] = (stats[statusRange] || 0) + 1;
    }
    return stats;
  }

  private async findTarget(): Promise<any> {
    const targets = await CDP.List({ port: this.cdpPort });
    
    // Filter out DevTools tabs and chrome:// URLs
    const pageTargets = targets.filter((t: any) => 
      t.type === 'page' && 
      !t.url.startsWith('devtools://') && 
      !t.url.startsWith('chrome://') &&
      !t.url.startsWith('chrome-extension://')
    );
    
    // Find target matching pattern, or use first available page
    let target = pageTargets.find((t: any) => 
      this.targetPattern.test(t.title) || 
      this.targetPattern.test(t.url)
    );
    
    // If no pattern match, use the first real page tab
    if (!target && pageTargets.length > 0) {
      target = pageTargets[0];
      console.log(`🎯 No pattern match, using first available tab: ${target.title}`);
    }

    if (!target) {
      console.error(`❌ No target found. Available targets:`);
      targets.forEach((t: any) => {
        console.log(`  - ${t.id}: ${t.title} (${t.url})`);
      });
      return null;
    }

    console.log(`✅ Found target: ${target.title} (${target.url})`);
    return target;
  }

  private setupConsoleLogging(): void {
    this.client.Runtime.enable();

    this.client.Runtime.consoleAPICalled((params: any) => {
      const { type, args, timestamp, stackTrace } = params;
      
      const messages = args.map((arg: any) => {
        if (arg.value !== undefined) return String(arg.value);
        if (arg.unserializableValue) return arg.unserializableValue;
        if (arg.description) return arg.description;
        return '[Object]';
      }).join(' ');

      const log: ConsoleLog = {
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: timestamp * 1000,
        type,
        message: messages,
      };

      if (stackTrace?.callFrames.length > 0) {
        const frame = stackTrace.callFrames[0];
        log.location = `${frame.url}:${frame.lineNumber}:${frame.columnNumber}`;
        log.stackTrace = stackTrace.callFrames;
      }

      this.addConsoleLog(log);
    });

    this.client.Runtime.exceptionThrown((params: any) => {
      const { exceptionDetails } = params;
      const { exception, text } = exceptionDetails;
      
      const log: ConsoleLog = {
        id: `error-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        type: 'error',
        message: exception?.description || text || 'Unknown error',
        location: exceptionDetails.url ? 
          `${exceptionDetails.url}:${exceptionDetails.lineNumber}:${exceptionDetails.columnNumber}` : 
          undefined,
        stackTrace: exceptionDetails.stackTrace?.callFrames
      };

      this.addConsoleLog(log);
    });
  }

  private setupNetworkLogging(): void {
    this.client.Network.enable();

    this.client.Network.requestWillBeSent((params: any) => {
      const { requestId, request, timestamp } = params;
      
      const networkRequest: NetworkRequest = {
        id: `req-${Date.now()}-${Math.random()}`,
        requestId,
        timestamp: timestamp * 1000,
        method: request.method,
        url: request.url,
        headers: request.headers || {},
        postData: request.postData
      };

      this.requestMap.set(requestId, networkRequest);
      this.addNetworkRequest(networkRequest);
    });

    this.client.Network.responseReceived((params: any) => {
      const { requestId, response, timestamp } = params;
      const request = this.requestMap.get(requestId);

      const networkResponse: NetworkResponse = {
        id: `res-${Date.now()}-${Math.random()}`,
        requestId,
        timestamp: timestamp * 1000,
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: response.headers || {},
        duration: request ? (timestamp * 1000) - request.timestamp : undefined
      };

      // Try to get response body for small JSON responses
      if (response.status < 400 && 
          response.headers['content-type']?.includes('json')) {
        this.client.Network.getResponseBody({ requestId })
          .then((result: any) => {
            if (result.body && result.body.length < 50000) {
              networkResponse.body = result.base64Encoded ? 
                Buffer.from(result.body, 'base64').toString() : 
                result.body;
            }
          })
          .catch(() => {
            // Ignore body fetch errors
          });
      }

      this.addNetworkResponse(networkResponse);
    });

    this.client.Network.loadingFinished((params: any) => {
      this.requestMap.delete(params.requestId);
    });

    this.client.Network.loadingFailed((params: any) => {
      this.requestMap.delete(params.requestId);
    });
  }

  private addConsoleLog(log: ConsoleLog): void {
    this.consoleLogs.push(log);
    if (this.consoleLogs.length > this.maxStoredItems) {
      this.consoleLogs.shift();
    }
    console.log(`📝 [${log.type}] ${log.message}`);
  }

  private addNetworkRequest(request: NetworkRequest): void {
    this.networkRequests.push(request);
    if (this.networkRequests.length > this.maxStoredItems) {
      this.networkRequests.shift();
    }
    console.log(`🌐 → ${request.method} ${request.url}`);
  }

  private addNetworkResponse(response: NetworkResponse): void {
    this.networkResponses.push(response);
    if (this.networkResponses.length > this.maxStoredItems) {
      this.networkResponses.shift();
    }
    console.log(`🌐 ← ${response.status} ${response.url} (${response.duration}ms)`);
  }

  async connectToCDP(): Promise<boolean> {
    try {
      const target = await this.findTarget();
      if (!target) return false;

      this.client = await CDP({ target: target.id, port: this.cdpPort });
      
      await Promise.all([
        this.setupConsoleLogging(),
        this.setupNetworkLogging(),
        this.client.Page.enable() // Enable Page domain for screenshots
      ]);

      console.log(`✅ Connected to Chrome DevTools Protocol`);
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to CDP:', error);
      return false;
    }
  }

  async startMCPServer(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('🚀 MCP CDP Debug Server running on stdio');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}

// Export for use in extension
export default CDPMCPServer;

// Main function for standalone execution
async function main(): Promise<void> {
  const cdpPort = Number.parseInt(process.env.CDP_PORT || '9222', 10);
  const targetPattern = process.env.TARGET_RE || '.*';

  const server = new CDPMCPServer(cdpPort, targetPattern);

  // Start MCP server only - don't connect to CDP immediately
  // CDP connection will happen when tools are first used
  await server.startMCPServer();

  console.log('✅ MCP Server ready - CDP connection will be established when tools are used');

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n📋 Shutting down CDP MCP Server...');
    await server.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run if this file is executed directly (for standalone testing)
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
