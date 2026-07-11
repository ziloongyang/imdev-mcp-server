import express, { NextFunction, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { EaseIMServer } from './server.js';

function parseAllowedOrigins(value: string | undefined): Set<string> {
  return new Set((value ?? '').split(',').map(origin => origin.trim()).filter(Boolean));
}

export async function startHttpServer() {
  const host = process.env.HOST ?? '0.0.0.0';
  const port = Number(process.env.PORT ?? '3000');
  const path = process.env.MCP_PATH ?? '/mcp';
  const bearerToken = process.env.MCP_AUTH_TOKEN;
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT 必须是 1-65535 的整数，当前值: ${process.env.PORT}`);
  }
  if (!path.startsWith('/')) {
    throw new Error('MCP_PATH 必须以 / 开头');
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: process.env.HTTP_BODY_LIMIT ?? '2mb' }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.header('origin');
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, mcp-protocol-version, mcp-session-id, last-event-id');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403);
      return;
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', transport: 'streamable-http' });
  });

  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    if (bearerToken && req.header('authorization') !== `Bearer ${bearerToken}`) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const mcpServer = new EaseIMServer();
  await mcpServer.connect(transport);

  app.all(path, authenticate, async (req, res) => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP HTTP 请求处理失败:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  const httpServer = app.listen(port, host, () => {
    console.error(`🚀 EaseIM MCP Streamable HTTP 服务已启动: http://${host}:${port}${path}`);
    console.error(`❤️  健康检查: http://${host}:${port}/health`);
    if (!bearerToken) {
      console.error('⚠️  MCP_AUTH_TOKEN 未设置；公网部署前请配置 Bearer Token 或在反向代理层鉴权');
    }
  });

  const shutdown = async () => {
    httpServer.close();
    await transport.close();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
