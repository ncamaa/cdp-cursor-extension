#!/usr/bin/env node

import { spawn, ChildProcess } from 'node:child_process';
import { platform } from 'node:os';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

interface ChromeLaunchOptions {
  port?: number;
  userDataDir?: string;
  headless?: boolean;
  additionalArgs?: string[];
}

class ChromeLauncher {
  private process: ChildProcess | null = null;
  private options: Required<ChromeLaunchOptions>;

  constructor(options: ChromeLaunchOptions = {}) {
    this.options = {
      port: options.port || 9222,
      userDataDir: options.userDataDir || join(tmpdir(), 'chrome-debug'),
      headless: options.headless || false,
      additionalArgs: options.additionalArgs || []
    };
  }

  private getChromeExecutable(): string {
    const os = platform();
    
    switch (os) {
      case 'darwin': // macOS
        return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      case 'win32': // Windows
        return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      case 'linux': // Linux
        return 'google-chrome';
      default:
        throw new Error(`Unsupported platform: ${os}`);
    }
  }

  private getLaunchArgs(): string[] {
    const args = [
      `--remote-debugging-port=${this.options.port}`,
      `--user-data-dir=${this.options.userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ];

    if (this.options.headless) {
      args.push('--headless', '--disable-gpu');
    }

    // Add any additional arguments
    args.push(...this.options.additionalArgs);

    return args;
  }

  async launch(): Promise<void> {
    if (this.process) {
      console.log('⚠️  Chrome is already running');
      return;
    }

    const executable = this.getChromeExecutable();
    const args = this.getLaunchArgs();

    console.log('🚀 Launching Chrome with debugging enabled...');
    console.log(`📁 User data directory: ${this.options.userDataDir}`);
    console.log(`🔌 Debug port: ${this.options.port}`);
    console.log(`🎯 Executable: ${executable}`);
    console.log('');

    try {
      this.process = spawn(executable, args, {
        stdio: 'inherit',
        detached: false
      });

      this.process.on('error', (error) => {
        console.error('❌ Failed to launch Chrome:', error.message);
        console.log('');
        console.log('💡 Troubleshooting:');
        console.log('1. Make sure Google Chrome is installed');
        console.log('2. Check if Chrome is already running');
        console.log('3. Try closing all Chrome windows first');
        console.log('4. Verify the executable path is correct');
        console.log('');
        console.log('Alternative Chrome paths to try:');
        console.log('  macOS: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome');
        console.log('  macOS: /Applications/Chromium.app/Contents/MacOS/Chromium');
        console.log('  Linux: chromium-browser');
        console.log('  Linux: chromium');
        this.process = null;
      });

      this.process.on('exit', (code) => {
        console.log(`\n📋 Chrome exited with code: ${code}`);
        this.process = null;
      });

      // Give Chrome a moment to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (this.process && !this.process.killed) {
        console.log('✅ Chrome launched successfully!');
        console.log(`🌐 DevTools available at: http://localhost:${this.options.port}`);
        console.log('');
        console.log('💡 Next steps:');
        console.log('1. Open a webpage in Chrome');
        console.log('2. Run: pnpm run list (to see available targets)');
        console.log('3. Run: pnpm dev (to start logging)');
        console.log('');
        console.log('Press Ctrl+C to stop Chrome');
      }

    } catch (error) {
      console.error('❌ Failed to launch Chrome:', error);
      this.process = null;
    }
  }

  async stop(): Promise<void> {
    if (!this.process) {
      console.log('⚠️  Chrome is not running');
      return;
    }

    console.log('🛑 Stopping Chrome...');
    
    try {
      // Try graceful shutdown first
      this.process.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force kill if still running
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
      
      console.log('✅ Chrome stopped');
    } catch (error) {
      console.error('❌ Error stopping Chrome:', error);
    } finally {
      this.process = null;
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  getPort(): number {
    return this.options.port;
  }

  getUserDataDir(): string {
    return this.options.userDataDir;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  let port = 9222;
  let headless = false;
  let userDataDir = '';
  let additionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--port':
      case '-p':
        port = Number.parseInt(args[++i] || '9222', 10);
        break;
      case '--headless':
      case '-h':
        headless = true;
        break;
      case '--user-data-dir':
      case '-d':
        userDataDir = args[++i] || '';
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          additionalArgs.push(arg);
        }
        break;
    }
  }

  const launcher = new ChromeLauncher({
    port,
    headless,
    userDataDir: userDataDir || undefined,
    additionalArgs
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\n📋 Shutting down Chrome launcher...');
    await launcher.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await launcher.launch();
    
    // Keep the process alive
    process.stdin.resume();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

function showHelp(): void {
  console.log('Chrome Launcher for CDP Logger');
  console.log('');
  console.log('Usage: pnpm run launch [options]');
  console.log('');
  console.log('Options:');
  console.log('  -p, --port <number>        Debug port (default: 9222)');
  console.log('  -h, --headless            Run in headless mode');
  console.log('  -d, --user-data-dir <dir>  Custom user data directory');
  console.log('  --help                    Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  pnpm run launch                    # Launch with defaults');
  console.log('  pnpm run launch --port 9223        # Use custom port');
  console.log('  pnpm run launch --headless         # Run headless');
  console.log('  pnpm run launch -d /tmp/chrome     # Custom data dir');
  console.log('');
}

// Removed main execution block since this is now a module

export default ChromeLauncher;
