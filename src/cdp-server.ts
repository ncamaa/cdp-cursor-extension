#!/usr/bin/env node

import CDP from 'chrome-remote-interface';
import express, { type Request, type Response } from 'express';
import cors from 'cors';

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

class CDPDebugServer {
  private client: any = null;
  private consoleLogs: ConsoleLog[] = [];
  private networkRequests: NetworkRequest[] = [];
  private networkResponses: NetworkResponse[] = [];
  private requestMap = new Map<string, NetworkRequest>();
  
  private maxStoredItems = 1000; // Prevent memory issues
  private app = express();
  private serverPort: number;
  private cdpPort: number;
  private targetPattern: RegExp;

  constructor(serverPort = 3100, cdpPort = 9222, targetPattern = '.*') {
    this.serverPort = serverPort;
    this.cdpPort = cdpPort;
    this.targetPattern = new RegExp(targetPattern, 'i');
    
    this.setupExpressApp();
  }

  private setupExpressApp(): void {
    this.app.use(cors());
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        connected: this.client !== null,
        stats: {
          consoleLogs: this.consoleLogs.length,
          networkRequests: this.networkRequests.length,
          networkResponses: this.networkResponses.length
        }
      });
    });

    // Get last N console logs
    this.app.get('/api/logs', (req: Request, res: Response) => {
      const limit = Number.parseInt(req.query.limit as string || '20', 10);
      const type = req.query.type as string;
      
      let logs = this.consoleLogs;
      if (type) {
        logs = logs.filter(log => log.type === type);
      }
      
      res.json({
        total: logs.length,
        limit,
        logs: logs.slice(-limit).reverse() // Most recent first
      });
    });

    // Get last N network requests
    this.app.get('/api/requests', (req: Request, res: Response) => {
      const limit = Number.parseInt(req.query.limit as string || '20', 10);
      const method = req.query.method as string;
      const urlPattern = req.query.url as string;
      
      let requests = this.networkRequests;
      
      if (method) {
        requests = requests.filter(req => req.method === method.toUpperCase());
      }
      
      if (urlPattern) {
        const regex = new RegExp(urlPattern, 'i');
        requests = requests.filter(req => regex.test(req.url));
      }
      
      res.json({
        total: requests.length,
        limit,
        requests: requests.slice(-limit).reverse()
      });
    });

    // Get last N network responses
    this.app.get('/api/responses', (req: Request, res: Response) => {
      const limit = Number.parseInt(req.query.limit as string || '20', 10);
      const status = req.query.status as string;
      const urlPattern = req.query.url as string;
      
      let responses = this.networkResponses;
      
      if (status) {
        const statusCode = Number.parseInt(status, 10);
        responses = responses.filter(res => res.status === statusCode);
      }
      
      if (urlPattern) {
        const regex = new RegExp(urlPattern, 'i');
        responses = responses.filter(res => regex.test(res.url));
      }
      
      res.json({
        total: responses.length,
        limit,
        responses: responses.slice(-limit).reverse()
      });
    });

    // Get matched request/response pairs
    this.app.get('/api/network', (req: Request, res: Response) => {
      const limit = Number.parseInt(req.query.limit as string || '20', 10);
      const urlPattern = req.query.url as string;
      
      // Match requests with their responses
      const pairs = this.networkResponses.map(response => {
        const request = this.networkRequests.find(req => req.requestId === response.requestId);
        return {
          request,
          response,
          duration: response.duration
        };
      });
      
      let filtered = pairs;
      if (urlPattern) {
        const regex = new RegExp(urlPattern, 'i');
        filtered = pairs.filter(pair => 
          pair.response && regex.test(pair.response.url)
        );
      }
      
      res.json({
        total: filtered.length,
        limit,
        network: filtered.slice(-limit).reverse()
      });
    });

    // Get specific request by ID
    this.app.get('/api/requests/:id', (req: Request, res: Response) => {
      const request = this.networkRequests.find(r => r.id === req.params.id);
      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }
      res.json(request);
    });

    // Get specific response by ID
    this.app.get('/api/responses/:id', (req: Request, res: Response) => {
      const response = this.networkResponses.find(r => r.id === req.params.id);
      if (!response) {
        return res.status(404).json({ error: 'Response not found' });
      }
      res.json(response);
    });

    // Clear all stored data
    this.app.post('/api/clear', (req: Request, res: Response) => {
      this.consoleLogs = [];
      this.networkRequests = [];
      this.networkResponses = [];
      this.requestMap.clear();
      
      res.json({ message: 'All data cleared' });
    });

    // Get server stats
    this.app.get('/api/stats', (req: Request, res: Response) => {
      res.json({
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
        }
      });
    });
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
    const target = targets.find((t: any) => 
      t.type === 'page' && (
        this.targetPattern.test(t.title) || 
        this.targetPattern.test(t.url)
      )
    );

    if (!target) {
      console.error(`❌ No target found matching: ${this.targetPattern.source}`);
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

      // Try to get response body for small responses
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
        this.setupNetworkLogging()
      ]);

      console.log(`✅ Connected to Chrome DevTools Protocol`);
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to CDP:', error);
      return false;
    }
  }

  async startServer(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.serverPort, () => {
        console.log(`\n🚀 CDP Debug Server running on http://localhost:${this.serverPort}`);
        console.log(`\n📚 API Endpoints:`);
        console.log(`   GET  /health                    - Server health check`);
        console.log(`   GET  /api/logs?limit=N          - Get last N console logs`);
        console.log(`   GET  /api/requests?limit=N      - Get last N network requests`);
        console.log(`   GET  /api/responses?limit=N     - Get last N network responses`);
        console.log(`   GET  /api/network?limit=N       - Get last N request/response pairs`);
        console.log(`   GET  /api/stats                 - Get statistics`);
        console.log(`   POST /api/clear                 - Clear all stored data`);
        console.log(`\n💡 Example queries:`);
        console.log(`   curl http://localhost:${this.serverPort}/api/logs?limit=10`);
        console.log(`   curl http://localhost:${this.serverPort}/api/network?limit=5&url=api`);
        console.log(`   curl http://localhost:${this.serverPort}/api/responses?status=200`);
        console.log(`\n📡 Monitoring Chrome on port ${this.cdpPort}...`);
        console.log(`🎯 Target pattern: ${this.targetPattern.source}\n`);
        resolve();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}

async function main(): Promise<void> {
  const serverPort = Number.parseInt(process.env.SERVER_PORT || '3100', 10);
  const cdpPort = Number.parseInt(process.env.CDP_PORT || '9222', 10);
  const targetPattern = process.env.TARGET_RE || '.*';

  const server = new CDPDebugServer(serverPort, cdpPort, targetPattern);

  // Start HTTP server first
  await server.startServer();

  // Then connect to CDP
  const connected = await server.connectToCDP();
  if (!connected) {
    console.error('❌ Failed to connect to Chrome. Make sure Chrome is running with --remote-debugging-port=9222');
    process.exit(1);
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n📋 Shutting down CDP Debug Server...');
    await server.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Removed main execution block since this is now a module

export default CDPDebugServer;
