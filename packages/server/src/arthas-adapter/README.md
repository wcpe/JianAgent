# Arthas Adapter Module

Arthas 适配器模块为 JianAgent 提供了与 Arthas 诊断工具的集成能力。

## 功能特性

- **自动下载和管理 Arthas**: 自动下载 arthas-boot.jar 到 `data/arthas/` 目录
- **进程生命周期管理**: 启动、停止、状态检查 Arthas 实例
- **HTTP API**: 通过 REST API 执行 Arthas 命令
- **WebSocket 支持**: 实时命令执行和结果推送
- **错误处理**: 完善的错误处理和超时机制

## API 端点

### REST API

#### 1. Attach 到 Java 进程
```http
POST /api/arthas/attach/:serverId
Content-Type: application/json

{
  "pid": 12345,
  "httpPort": 8563,      // 可选，默认 8563
  "telnetPort": 3658,    // 可选，默认 3658
  "tunnelServer": ""     // 可选
}
```

**响应**:
```json
{
  "success": true,
  "serverId": "server-1",
  "httpPort": 8563,
  "telnetPort": 3658
}
```

#### 2. 断开连接
```http
POST /api/arthas/detach/:serverId
```

**响应**:
```json
{
  "success": true,
  "message": "Arthas detached from server-1"
}
```

#### 3. 执行命令
```http
POST /api/arthas/execute
Content-Type: application/json

{
  "serverId": "server-1",
  "command": "dashboard",
  "timeout": 30000       // 可选，默认 30000ms
}
```

**响应**:
```json
{
  "success": true,
  "output": "...",
  "executionTime": 1234
}
```

#### 4. 获取状态
```http
GET /api/arthas/status/:serverId
```

**响应**:
```json
{
  "attached": true,
  "serverId": "server-1",
  "pid": 12345,
  "httpPort": 8563,
  "telnetPort": 3658,
  "uptime": 123456
}
```

### WebSocket API

连接到 WebSocket 命名空间: `ws://localhost:3400/arthas`

#### 事件

**客户端发送**:
- `command`: 执行命令
  ```json
  {
    "serverId": "server-1",
    "command": "dashboard",
    "timeout": 30000
  }
  ```

- `subscribe`: 订阅服务器输出
  ```json
  {
    "serverId": "server-1"
  }
  ```

- `unsubscribe`: 取消订阅
  ```json
  {
    "serverId": "server-1"
  }
  ```

**服务器发送**:
- `result`: 命令执行结果
  ```json
  {
    "success": true,
    "output": "...",
    "executionTime": 1234
  }
  ```

- `error`: 错误信息
  ```json
  {
    "error": "Error message",
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
  ```

- `subscribed`: 订阅确认
- `unsubscribed`: 取消订阅确认

## 常用 Arthas 命令

- `dashboard`: 实时数据面板
- `thread`: 查看线程信息
- `jvm`: 查看 JVM 信息
- `memory`: 查看内存信息
- `sysprop`: 查看系统属性
- `sysenv`: 查看环境变量
- `vmoption`: 查看/修改 VM 选项
- `logger`: 查看/修改日志级别
- `sc`: 查看类信息
- `sm`: 查看方法信息
- `jad`: 反编译类
- `watch`: 观察方法调用
- `trace`: 追踪方法调用路径
- `stack`: 查看方法调用堆栈
- `tt`: 时间隧道，记录方法调用

## 实现细节

### 目录结构
```
arthas-adapter/
├── arthas-adapter.module.ts    # NestJS 模块定义
├── arthas.service.ts           # 核心业务逻辑
├── arthas.controller.ts        # REST API 控制器
├── arthas.gateway.ts           # WebSocket Gateway
└── dto/
    ├── attach-server.dto.ts    # Attach DTO
    └── execute-command.dto.ts  # 命令执行 DTO
```

### 关键特性

1. **自动下载**: 首次使用时自动从阿里云下载 arthas-boot.jar
2. **进程管理**: 使用 `child_process.spawn` 启动 Arthas 进程
3. **HTTP 客户端**: 使用 Node.js 内置 `http` 模块调用 Arthas HTTP API
4. **生命周期**: 实现 `OnModuleDestroy` 确保优雅关闭所有 Arthas 实例
5. **错误处理**: 完善的错误处理和用户友好的错误消息
6. **日志**: 详细的日志记录，便于调试

### 配置

- Arthas 版本: 3.7.2
- 下载地址: https://arthas.aliyun.com/arthas-boot.jar
- 存储目录: `data/arthas/`
- 默认 HTTP 端口: 8563
- 默认 Telnet 端口: 3658
- Attach 超时: 30 秒
- 命令超时: 30 秒

## 使用示例

### 使用 curl

```bash
# 1. Attach 到 Java 进程
curl -X POST http://localhost:3400/api/arthas/attach/my-server \
  -H "Content-Type: application/json" \
  -d '{"pid": 12345}'

# 2. 执行命令
curl -X POST http://localhost:3400/api/arthas/execute \
  -H "Content-Type: application/json" \
  -d '{"serverId": "my-server", "command": "dashboard"}'

# 3. 获取状态
curl http://localhost:3400/api/arthas/status/my-server

# 4. 断开连接
curl -X POST http://localhost:3400/api/arthas/detach/my-server
```

### 使用 WebSocket (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:3400/arthas');

ws.onopen = () => {
  // 订阅服务器
  ws.send(JSON.stringify({
    event: 'subscribe',
    data: { serverId: 'my-server' }
  }));

  // 执行命令
  ws.send(JSON.stringify({
    event: 'command',
    data: {
      serverId: 'my-server',
      command: 'dashboard'
    }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Event:', message.event);
  console.log('Data:', message.data);
};
```

## 注意事项

1. 确保目标 Java 进程有足够的权限被 Arthas attach
2. 首次使用需要下载 arthas-boot.jar，可能需要一些时间
3. 每个服务器只能 attach 一个 Arthas 实例
4. 命令执行有超时限制，长时间运行的命令可能会超时
5. 模块销毁时会自动清理所有 Arthas 实例

## 故障排查

### Arthas 启动失败
- 检查 Java 进程是否存在
- 检查端口是否被占用
- 查看日志获取详细错误信息

### 命令执行超时
- 增加 timeout 参数
- 检查 Arthas HTTP API 是否正常响应

### 下载失败
- 检查网络连接
- 手动下载 arthas-boot.jar 到 `data/arthas/` 目录
