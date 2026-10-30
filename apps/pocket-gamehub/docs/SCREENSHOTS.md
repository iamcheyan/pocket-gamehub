# Screenshots

所有截图均取自**真实运行**的 Pocket GameHub，使用 Chromium 无头模式对 `http://127.0.0.1:18480` 上的 Vue/React 生产构建（`vite preview`）截图；后端为 `gamed 0.1.0`（`127.0.0.1:18470`，SQLite + 120 款 mock 目录），截图时 `retroarch` 未安装，界面因此显示离线状态而非假装可玩。

页面导航是 React 内部状态（非 URL 路由），所以截图通过 puppeteer-core 驱动真实 DOM 点击（导航按钮、首张游戏卡、主题分段按钮、搜索框输入）后再截屏，未使用任何占位图或手写 HTML。

## 复现命令

```bash
# 1) 后端（独立端口，避免与其它项目冲突）
cd apps/pocket-gamehub/backend
GAMEHUB_DB=/tmp/pghub-shots.db GAMEHUB_ADDR=127.0.0.1:18470 go run .

# 2) 前端生产构建 + preview（代理 /api 到后端）
cd apps/pocket-gamehub/frontend
npm install && npm run build
GAMEHUB_API_TARGET=http://127.0.0.1:18470 npx vite preview --host 127.0.0.1 --port 18480 --strictPort

# 3) 截图（示例，单一视图与分辨率）
chromium --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=480,320 --screenshot=home-480x320.png http://127.0.0.1:18480/
```

完整 9 视图 × 4 分辨率由 puppeteer-core 脚本驱动真实点击后逐页截屏。

## 视图矩阵（9 视图 × 4 分辨率 = 36 张）

| 视图 | 说明 |
|---|---|
| `home` | Home：Continue Playing 主视觉区 + 快捷入口 + 游戏网格 |
| `library` | Library：全平台筛选、分类标签、游戏网格 |
| `platform-list` | Library 内的平台 chip 列表（GB/GBA/GBC/NDS/NES…） |
| `detail` | Game Detail：封面、标题、描述、Genre、Release Date |
| `search` | Search：输入 `Mock` 后的真实匹配结果 |
| `collections` | Collections 列表页 |
| `settings` | Settings：Theme 与 Language（English/简体中文/日本語） |
| `dark` | Dark 主题（`data-theme="dark"`） |
| `light` | Light 主题（`data-theme="light"` + `.light` 类） |

## 文件清单与 PNG 头自检

尺寸由 PNG IHDR 头校验（`file` 读取），与文件名一致：

| 文件 | 分辨率 | 视图/主题 |
|---|---:|---|
| `home-320x240.png` | 320×240 | Home / light |
| `library-320x240.png` | 320×240 | Library / light |
| `platform-list-320x240.png` | 320×240 | Platform list / light |
| `detail-320x240.png` | 320×240 | Game detail / light |
| `search-320x240.png` | 320×240 | Search / light |
| `collections-320x240.png` | 320×240 | Collections / light |
| `settings-320x240.png` | 320×240 | Settings / light |
| `dark-320x240.png` | 320×240 | Home / dark |
| `light-320x240.png` | 320×240 | Home / light |
| `home-480x320.png` | 480×320 | Home / light（主优化目标 RG34XX） |
| `library-480x320.png` | 480×320 | Library / light |
| `platform-list-480x320.png` | 480×320 | Platform list / light |
| `detail-480x320.png` | 480×320 | Game detail / light |
| `search-480x320.png` | 480×320 | Search / light |
| `collections-480x320.png` | 480×320 | Collections / light |
| `settings-480x320.png` | 480×320 | Settings / light |
| `dark-480x320.png` | 480×320 | Home / dark |
| `light-480x320.png` | 480×320 | Home / light |
| `home-720x720.png` | 720×720 | Home / light |
| `library-720x720.png` | 720×720 | Library / light |
| `platform-list-720x720.png` | 720×720 | Platform list / light |
| `detail-720x720.png` | 720×720 | Game detail / light |
| `search-720x720.png` | 720×720 | Search / light |
| `collections-720x720.png` | 720×720 | Collections / light |
| `settings-720x720.png` | 720×720 | Settings / light |
| `dark-720x720.png` | 720×720 | Home / dark |
| `light-720x720.png` | 720×720 | Home / light |
| `home-1280x720.png` | 1280×720 | Home / light |
| `library-1280x720.png` | 1280×720 | Library / light |
| `platform-list-1280x720.png` | 1280×720 | Platform list / light |
| `detail-1280x720.png` | 1280×720 | Game detail / light |
| `search-1280x720.png` | 1280×720 | Search / light |
| `collections-1280x720.png` | 1280×720 | Collections / light |
| `settings-1280x720.png` | 1280×720 | Settings / light |
| `dark-1280x720.png` | 1280×720 | Home / dark |
| `light-1280x720.png` | 1280×720 | Home / light |

## 截图过程中发现并修复的真实缺陷

1. **导航被详情页覆盖**：打开 Game Detail 后点击任意侧栏导航，`selected` 未清除，界面仍停留在详情页。已在导航 onClick 中先 `setSelected(null)`。
2. **Light 主题完全不生效**：CSS 以 `.light` 类定义浅色调色板，而 `App.tsx` 只设置 `data-theme` 属性，选择器永不匹配。现已同时切换 `data-theme` 与 `.light` 类，浅色主题真实生效（见 `light-*.png` 与 `dark-*.png` 对比）。
3. **320×240 首屏看不到游戏**：平台 chip 行与标题占满竖向空间。已在 `max-height:300px` 下隐藏冗余平台 chip 行（下拉框仍可筛选），游戏网格回到首屏。

## 已知限制

- 320×240 下底部导航栏占用 49px，游戏卡列表首行可见但需滚动查看更多；浏览 → 详情 → 收藏/启动流程均可达。
- 截图时 RetroArch 未安装，故 Launch 按钮呈现不可用状态（这是真实行为，非渲染缺陷）。
