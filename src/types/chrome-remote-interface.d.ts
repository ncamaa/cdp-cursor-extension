declare module 'chrome-remote-interface' {
  interface Target {
    id: string;
    title: string;
    url: string;
    type: string;
    description?: string;
    devtoolsFrontendUrl?: string;
    faviconUrl?: string;
    webSocketDebuggerUrl?: string;
  }

  interface Version {
    Browser: string;
    'Protocol-Version': string;
    'User-Agent': string;
    'V8-Version': string;
    'WebKit-Version': string;
    webSocketDebuggerUrl: string;
  }

  interface CDPOptions {
    target?: string;
    port?: number;
    host?: string;
    secure?: boolean;
    useHostName?: boolean;
    alterPath?: (path: string) => string;
  }

  interface CDPClient {
    Runtime: {
      enable(): Promise<void>;
      consoleAPICalled(callback: (params: any) => void): void;
      exceptionThrown(callback: (params: any) => void): void;
    };
    Network: {
      enable(): Promise<void>;
      requestWillBeSent(callback: (params: any) => void): void;
      responseReceived(callback: (params: any) => void): void;
      loadingFinished(callback: (params: any) => void): void;
      loadingFailed(callback: (params: any) => void): void;
      getResponseBody(params: { requestId: string }): Promise<any>;
    };
    close(): Promise<void>;
  }

  function CDP(options?: CDPOptions): Promise<CDPClient>;

  namespace CDP {
    function List(options?: { port?: number; host?: string }): Promise<Target[]>;
    function Version(options?: { port?: number; host?: string }): Promise<Version>;
  }

  export = CDP;
}
