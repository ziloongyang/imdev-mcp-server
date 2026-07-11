# 安装方案

## Docker 部署（Streamable HTTP）

服务保留原有 stdio 模式，同时支持 MCP 推荐的 Streamable HTTP 远程传输。HTTP 端点默认为 `http://服务器:3000/mcp`，健康检查为 `/health`。

```bash
cp .env.example .env
# 编辑 .env，务必替换为高强度随机 MCP_AUTH_TOKEN
docker compose up -d --build
curl http://127.0.0.1:3000/health
```

客户端连接示例：

```json
{
  "mcpServers": {
    "easeim": {
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

公网部署建议在容器前使用 Nginx、Caddy 或云负载均衡终止 HTTPS，并将请求反向代理到 `127.0.0.1:3000`。SSE 流式响应需要关闭代理缓冲并延长读取超时，例如 Nginx location：

```nginx
location /mcp {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

可用环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MCP_TRANSPORT` | `stdio` | 设为 `http` 或 `streamable-http` 开启远程服务 |
| `HOST` / `PORT` | `0.0.0.0` / `3000` | HTTP 监听地址和端口 |
| `MCP_PATH` | `/mcp` | MCP HTTP 路径 |
| `MCP_AUTH_TOKEN` | 空 | 可选 Bearer Token；公网部署必须配置或由网关鉴权 |
| `CORS_ALLOWED_ORIGINS` | 空 | 浏览器允许的 Origin，逗号分隔 |
| `HTTP_BODY_LIMIT` | `2mb` | JSON 请求体大小上限 |

不使用 Docker 时，可运行：

```bash
cd easeim-mcp-server
npm install
npm run build
MCP_TRANSPORT=http MCP_AUTH_TOKEN=YOUR_TOKEN npm start
```


## 方案 1: GitHub 直接安装 (最快)

`npm install -g "github:easemob/imdev-mcp-server"`

或指定分支/tag

`npm install -g "github:easemob/imdev-mcp-server#v1.0.0"`


---
## 方案 2: 手动配置路径 (零发布)

用户克隆repo或者下载源码
git clone https://github.com/easemob/imdev-mcp-server
cd imdev-mcp-server/easeim-mcp-server/ && npm install && npm run build

## 配置 Claude（使用绝对路径）
```Json
{
  "mcpServers": {
    "easeim":{
      "command": "node",
      "args": ["/Path/imdev-mcp-server/easeim-mcp-server/dist/index.js"],
      "env": {
          "EASEIM_TRACE_LOG": "true",
          "EASEIM_TRACE_LOG_PATH": "/Path/imdev-mcp-server/easeim-mcp-server/tmp/easeim-mcp-server.log",
          "EASEIM_SMART_ASSIST_LOG": "1",
          "EASEIM_SMART_ASSIST_LOG_PATH": "/Path/imdev-mcp-server/easeim-mcp-server/tmp/smart_assist.log",
          "EASEIM_TOOL_LOG": "1",
          "EASEIM_TOOL_LOG_PATH": "/Path/imdev-mcp-server/easeim-mcp-server/tmp/tool.log"
        }
    }
  }
}
```


## 2026-03 关键优化（文档同步）

本仓库的核心实现位于 `easeim-mcp-server/`，本次优化已同步到对应文档：

- 全平台分片刷新命令：`npm --prefix "easeim-mcp-server" run generate-all-platform-shards`
- 新增平台覆盖：`flutter`、`harmony`（含平台别名归一）
- 查询纠缠证据链分析：支持回放日志并自动输出归因报告
- 平台能力约束回答：对“当前无内容”场景直接说明并附证据

详细说明见：

- `easeim-mcp-server/README.md`
- `easeim-mcp-server/docs/TECHNICAL_OVERVIEW.md`
- `easeim-mcp-server/docs/RAW_MATERIALS_REQUIREMENTS.md`
- `easeim-mcp-server/docs/QUERY_FRICTION_ANALYSIS.md`

# 功能概览

```
┌─────────────────────────────────────────────────────────────────┐
│                    easeim-mcp-server                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   搜索引擎层    │  │   智能化层      │  │   诊断层        │ │
│  │                 │  │                 │  │                 │ │
│  │ • 文档搜索      │  │ • 意图分类      │  │ • 集成检查      │ │
│  │ • 源码搜索      │  │ • 实体提取      │  │ • 错误诊断      │ │
│  │ • 配置搜索      │  │ • 查询扩展      │  │ • Podfile 检查  │ │
│  │ • 分片搜索      │  │ • 代码生成      │  │ • 检查清单      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    核心算法层                              │ │
│  │                                                           │ │
│  │  BM25 评分 • 倒排索引 • LRU 缓存 • 歧义检测 • 上下文感知   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## MCP 工具列表（19 个）

### 基础工具（10 个）

| 工具 | 描述 |
|------|------|
| `lookup_error` | 查询错误码含义、原因和解决方案 |
| `search_api` | 搜索 API 文档，支持平台/层级过滤 |
| `search_source` | 搜索 UIKit 源码，支持组件过滤 |
| `get_guide` | 获取集成指南和最佳实践 |
| `diagnose` | 根据症状诊断错误原因 |
| `read_doc` | 读取完整 API 文档 |
| `read_source` | 读取源码文件（支持行范围） |
| `list_config_options` | 列出 Appearance 配置项 |
| `get_extension_points` | 获取可继承类和协议 |
| `get_config_usage` | 查询配置项的使用详情 |

### 智能化工具（4 个）

| 工具 | 描述 |
|------|------|
| `smart_assist` | 🧠 自然语言智能助手，**支持上下文感知**，自动理解意图和连续性问题 |
| `generate_code` | 📝 代码生成器，生成完整代码模板 |
| `explain_class` | 📖 类解释器，说明继承关系和用法 |
| `list_scenarios` | 📋 列出所有支持的开发场景 |

### 集成诊断工具（5 个）

| 工具 | 描述 |
|------|------|
| `check_integration` | 🔍 检查 Podfile 配置是否符合要求 |
| `diagnose_build_error` | 🛠️ 诊断 Xcode 构建错误 |
| `get_podfile_template` | 📄 获取推荐的 Podfile 模板 |
| `get_integration_checklist` | ✅ 获取完整集成检查清单 |
| `get_platform_requirements` | 📋 查询平台版本要求 |

---

# 精准度保障

- 最小相关性阈值：低于阈值直接视为未命中
- 歧义强制澄清：平台/层级/组件歧义不直接输出结果
- 证据绑定输出：API 文档路径、源码行号或错误码索引可追溯
