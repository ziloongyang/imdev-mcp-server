#!/usr/bin/env node
/**
 * 环信 IM SDK MCP Server 入口
 */

import { EaseIMServer } from './server.js';
import { startHttpServer } from './http.js';

async function main() {
  const transport = (process.env.MCP_TRANSPORT ?? 'stdio').toLowerCase();
  if (transport === 'http' || transport === 'streamable-http') {
    await startHttpServer();
    return;
  }
  if (transport !== 'stdio') {
    throw new Error(`不支持的 MCP_TRANSPORT: ${transport}（可选: stdio, http）`);
  }
  const server = new EaseIMServer();
  await server.start();
}

main().catch((error) => {
  console.error('❌ 服务器启动失败:', error);
  process.exit(1);
});
