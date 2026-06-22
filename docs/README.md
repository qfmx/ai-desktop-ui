# AI-Workspace 文档索引

本目录是项目的规格和工程文档入口。文档按 spec 风格组织：先说明目标、范围、功能契约，再说明架构、接口、数据、开发和发布流程。

## 阅读顺序

1. [PROJECT_SPEC.md](PROJECT_SPEC.md)  
   项目定位、范围、技术栈、目录边界和当前状态。
2. [FEATURE_SPEC.md](FEATURE_SPEC.md)  
   智能问答、知识库、模型配置、历史、系统设置等功能规格。
3. [ARCHITECTURE.md](ARCHITECTURE.md)  
   Tauri 桌面壳、React 前端、FastAPI 后端、SQLite 和向量索引之间的关系。
4. [API_SPEC.md](API_SPEC.md)  
   当前后端 HTTP API、请求响应、流式接口和前端调用映射。
5. [DATA_SPEC.md](DATA_SPEC.md)  
   SQLite 表、配置项、种子数据、向量索引和运行时数据目录。
6. [DEVELOPMENT.md](DEVELOPMENT.md)  
   本地依赖安装、启动、常用命令、验证方式和开发注意事项。
7. [PACKAGING.md](PACKAGING.md)  
   Windows 打包、PyInstaller sidecar、Tauri bundle、产物收集和发布验证。

## 项目快速事实

- 产品名：`AI-Workspace`
- 当前版本：`1.0.1`
- 桌面框架：Tauri 2
- 前端：React 19、TypeScript、Vite 7、Lucide React
- 后端：Python 3.11+、FastAPI、Uvicorn、aiosqlite、httpx、NumPy
- 后端地址：`http://127.0.0.1:18888`
- 前端开发端口：`http://localhost:1420`
- 本地开发一键启动：`.\scripts\dev.ps1`
- Windows 打包：`pnpm package:windows`

## 当前实现边界

项目已经实现桌面壳、五个主工作区、FastAPI 后端、SQLite 本地持久化、模型供应商管理、基础 RAG 检索、SSE 流式问答和 Windows 打包。

也存在一些前端占位或未完全贯通的能力：顶部全局搜索、安全审计按钮、通知按钮、知识库页面新建/上传入口、设置页的数据导入导出按钮，目前没有完整后端动作或页面事件闭环。后续开发应以本目录的 spec 文档作为变更入口。
