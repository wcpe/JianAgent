# JianAgent

<div align="center">

**Minecraft 服务器全生命周期管理平台**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](package.json)
[![PNPM](https://img.shields.io/badge/pnpm-%3E%3D9.0.0-orange)](package.json)
[![NestJS](https://img.shields.io/badge/NestJS-11.0.0-ea2845)](packages/server/package.json)
[![React](https://img.shields.io/badge/React-19.0.0-61dafb)](packages/web/package.json)

</div>

## 概述

JianAgent 是一个面向 Minecraft 服务器的综合性运维管理平台，提供从服务器进程管理、JVM 监控诊断、Minecraft Bot 自动化到资源调度的一站式解决方案。

平台采用 **前后端分离架构**，后端基于 NestJS + Fastify，前端基于 React 19 + Vite，并包含一个基于 Mineflayer 的 Bot Worker 进程以及一个 Bukkit 服务端插件（探针），形成完整的管理闭环。

---

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                     Web 前端 (React 19)                   │
│   Dashboard · 终端 · Bot 管理 · 会话 · JVM · Arthas · 监控  │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP / WebSocket
                     ▼
┌─────────────────────────────────────────────────────────┐
│                API 服务端 (NestJS + Fastify)              │
│   认证 · 会话 · JVM · 终端 · SSH · 监控 · Arthas · 插件管理  │
│   审计 · 告警 · 通知 · 文件管理 · 远程主机 · 控制面 · Bot 调度  │
└──────┬──────────────────────────────┬───────────────────┘
       │ HTTP                          │ IPC
       ▼                               ▼
┌──────────────┐            ┌──────────────────────┐
│  Bukkit 探针  │            │   Bot Worker 进程池    │
│  (TabooLib)   │            │   (Mineflayer)        │
│  进程/JVM/    │            │   自动连接/寻路/脚本执行 │
│  服务器指标    │            │   行为引擎/调试会话     │
└──────────────┘            └──────────────────────┘
```

### 核心组件

| 组件 | 技术栈 | 说明 |
|------|--------|------|
| **`@jian-agent/server`** | NestJS 11, Fastify, SQLite, WebSocket | 后端 API 服务，提供全部业务能力 |
| **`@jian-agent/web`** | React 19, Vite, TailwindCSS, Zustand, i18next | 管理后台前端 SPA |
| **`@jian-agent/bot-worker`** | Mineflayer, Node.js Worker Threads | Minecraft Bot 自动化子进程 |
| **`@jian-agent/shared-domain`** | TypeScript | 跨包共享领域类型与常量 |
| **`@jian-agent/shared-protocol`** | TypeScript | 跨进程 IPC 协议定义与事件类型 |
| **`jianagent-plugin (probe-plugin)`** | TabooLib, Kotlin, Bukkit API | 服务端探针插件，采集服务器/JVM 指标 |
| **`java-helper`** | Java, Gradle | 服务端 Java 辅助工具 |

---

## 功能特性

### 🖥️ 服务器管理
- 多服务器进程管理（启动、停止、重启）
- 终端模拟器（基于 xterm.js + node-pty）
- 日志实时采集与检索
- 启动模板与配置管理

### ☕ JVM 可观测性
- JVM 进程发现与列表
- 实时内存 / GC / 线程监控
- JVM 诊断命令执行
- **Arthas 集成**：自动下载与管理，REST + WebSocket 双通道命令执行，18 种专用 Widget（Dashboard、Thread、Jad、Memory、Trace、Stack 等），诊断可视化面板

### 🤖 Minecraft Bot 自动化
- Bot 生命周期管理（连接、重连、健康检查）
- 行为引擎与行为工厂
- 自动寻路导航
- 脚本执行引擎
- 调试会话支持
- 状态与事件上报

### 📊 监控与告警
- 实时资源指标（CPU、内存、磁盘）
- 服务器在线人数与 TPS（通过探针）
- 告警规则配置与通知
- 审计日志

### 🔌 Bukkit 探针插件
- 服务器 / JVM 指标采集
- WebSocket 双向通信
- 白名单管理
- 插件桥接

### 🛠️ 其他功能
- SSH 远程主机管理
- 文件管理（上传、下载、浏览）
- 会话管理与模板
- 端口扫描与管理
- 本地验证工具
- 国际化（i18n）
- 角色权限与认证（JWT）
- 备份与数据管理
- 控制面（Worker 调度、任务治理）

---

## 快速开始

### 环境要求

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Java** >= 17（Arthas 诊断功能需要运行时 JVM）

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-org/jian-agent.git
cd jian-agent

# 安装依赖
pnpm install

# 构建共享包
pnpm run build:shared

# 构建 Bot Worker
pnpm run prepare:server-runtime
```

### 开发

```bash
# 启动后端开发服务（端口 3400）
pnpm run dev:server

# 启动前端开发服务（端口 5173）
pnpm run dev:web
```

### 构建

```bash
# 构建所有包
pnpm run build
```

### 测试

```bash
# 运行全部测试
pnpm run test

# 前端 E2E 测试（需要先安装 Playwright 浏览器）
cd packages/web
pnpm exec playwright install chromium
pnpm run test:e2e
```

---

## 项目结构

```
jian-agent/
├── packages/
│   ├── server/              # NestJS API 服务端
│   │   └── src/
│   │       ├── arthas-adapter/   # Arthas 诊断集成
│   │       ├── auth/             # 认证与 JWT
│   │       ├── bot/              # Bot 调度管理
│   │       ├── jvm/              # JVM 监控
│   │       ├── monitoring/       # 实时监控
│   │       ├── realtime/         # WebSocket 网关
│   │       ├── ssh/              # SSH 连接
│   │       ├── terminal-session/ # 终端会话
│   │       └── ...               # 30+ 模块
│   ├── web/                 # React 管理后台
│   │   └── src/
│   │       ├── pages/            # 页面组件（代码分割）
│   │       ├── features/         # 功能模块
│   │       ├── components/       # 共享 UI 组件
│   │       ├── stores/           # Zustand 状态管理
│   │       ├── api/              # API 客户端
│   │       ├── ws/               # WebSocket 客户端
│   │       └── i18n/             # 国际化
│   ├── bot-worker/          # Mineflayer Bot 子进程
│   ├── shared-domain/       # 共享领域模型
│   └── shared-protocol/     # IPC 协议定义
├── plugin/
│   ├── api/                 # 插件 API 定义
│   ├── probe-plugin/        # Bukkit 探针插件（TabooLib）
│   └── java-helper/         # Java 辅助工具
├── docs/
│   └── superpowers/         # 开发文档与计划
└── data/                    # 运行时数据（SQLite DB 等）
```

---

## 技术栈

### 后端

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js ≥20, TypeScript |
| 框架 | NestJS 11 (Fastify) |
| 数据库 | SQLite (better-sqlite3), Drizzle ORM |
| 实时通信 | WebSocket (NestJS Gateway + platform-ws) |
| 安全 | JWT, bcrypt, Helmet, CSRF Guard |
| 终端 | node-pty, SSH2 |
| 进程管理 | pidusage |

### 前端

| 类别 | 技术 |
|------|------|
| 框架 | React 19, React Router 7 |
| 构建 | Vite 6 |
| 样式 | TailwindCSS 4 |
| 状态管理 | Zustand |
| 国际化 | i18next, react-i18next |
| 图标 | Lucide React |
| 编辑器 | CodeMirror, xterm.js |
| 图表 | Recharts |
| 虚拟列表 | TanStack Virtual |

### Minecraft 生态

| 类别 | 技术 |
|------|------|
| Bot 自动化 | Mineflayer, mineflayer-pathfinder |
| 服务端插件 | TabooLib 6, Kotlin, Bukkit API |
| JVM 诊断 | Arthas |

---

## 许可证

本项目基于 [GNU General Public License v3](LICENSE) 开源。

---

## 开发路线图

- [x] 基础服务器进程管理
- [x] JVM 监控与诊断
- [x] Arthas 深度集成
- [x] Minecraft Bot 自动化
- [x] Bukkit 探针插件
- [x] 实时 WebSocket 通信
- [ ] 集群模式支持
- [ ] Kubernetes 部署
- [ ] 插件市场
- [ ] 更多 Bot 行为模式