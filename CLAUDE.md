# Chat Management Backstage

## Project Identity

- **Description**: 聊天管理後台系統 — admin panel for chat monitoring, player management, and broadcast
- **Communication language**: 繁體中文 (comments, commit messages)
- **Code language**: English
- **Current progress**: 00_doc/tasks_01-auth-and-response.md (Phase 1 驗收中)

## Document Routing

Read the relevant document BEFORE starting any task:

| Task Type                     | Read First                                   |
| ----------------------------- | -------------------------------------------- |
| Product scope & requirements  | `00_doc/prd_00-chat_management_backstage.md` |
| Project init technical design | `00_doc/rfc_00-project_tech_stack.md`        |
| Auth & response design        | `00_doc/rfc_01-auth-and-response.md`         |

## Skill 使用指引

| 任務類型                 | 使用 Skill                                   |
| ------------------------ | -------------------------------------------- |
| 開始規劃多步驟任務       | `superpowers:writing-plans`                  |
| 執行 implementation plan | `superpowers:executing-plans`                |
| 遇到 bug / 測試失敗      | `superpowers:systematic-debugging`           |
| 宣告任務完成前           | `superpowers:verification-before-completion` |
| 前端 UI 開發             | `frontend-design` + `react-best-practices`   |

## Tech Stack

- Frontend: React 18 + Vite + TypeScript + Ant Design 5.x
- Backend: Express.js + TypeScript + SQLite (better-sqlite3) + Knex.js
- Auth: JWT + bcryptjs
- Dev: nodemon + concurrently

## Coding Conventions

- Follow SOLID CleanCode principles
- React: Follow react-best-practice skill
- All operations must be logged to operation_logs (using operationLogger afterware middleware, see rfc_02)
- No hardcoded colors — use Antd design tokens or CSS variables
- Frontend styling: 一律用 `createStyles` from `antd-style`，禁用 inline style object
  - 有用到 token（顏色/間距....）：`createStyles(({ token }) => ({...}))`
  - 純佈局無 token：`createStyles(() => ({...}))`
  - 有 token 一率使用 token
- namingPattern
  - database: all lowercase with \_
  - variable: camelCase
  - typescript type: start with uppercase T ex. TPermissonType
  - typescript interfase: start with uppercase I ex. IPermissonType
  - env key name: all uppercase with \_
- 每次執行完 task 需要針對當次改動的檔案執行 prettier format
