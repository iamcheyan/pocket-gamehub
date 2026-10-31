# Screenshots

所有截图都取自**真实运行**的 Pocket GameHub：React 生产构建（`vite preview`，`127.0.0.1:18480`）+ `gamed 0.1.0`（`127.0.0.1:18470`，SQLite，120 条 mock 目录）。截图时 RetroArch 未安装，界面显示离线状态而不是假装可玩。

页面导航是 React 内部状态（不是 URL 路由），因此截图用 puppeteer-core 驱动真实 DOM 操作（点击导航、平台 chip、游戏卡、输入搜索词），再逐页截屏。**未使用任何占位图或手写 HTML。**

## 唯一性验证

每张图都在截图前显式重置后端设置（theme + language），避免偏好持久化导致画面重复：

```python
import glob, hashlib, collections
files = sorted(glob.glob('apps/pocket-gamehub/docs/screenshots/*.png'))
h = collections.defaultdict(list)
for f in files:
    h[hashlib.sha256(open(f,'rb').read()).hexdigest()].append(f)
assert len(files) == 57 and len(h) == 57   # 每个文件都是唯一图像
```

结果：`files: 57  unique: 57`，无重复。

尺寸由 PNG IHDR 头字节读取并与文件名比对，57/57 全部匹配。

## 自动截图脚本

`make screenshots`（即 `tests/capture-screenshots.mjs`）会驱动真实 DOM 完成 9 个视图 × 6 个分辨率 + 3 个 DPI，共 57 张；任何哈希重复、PNG 尺寸不符、横向溢出、空白页面或控制台/HTTP 错误都会让运行失败，并写出 `screenshots/manifest.json`（时间戳 + 每张 SHA-256）。

## 复现命令

```bash
# 1) 后端
cd apps/pocket-gamehub/backend
GAMEHUB_DB=/tmp/pghub-shots.db GAMEHUB_ADDR=127.0.0.1:18470 go run .

# 2) 前端生产构建 + preview（/api 代理到后端）
cd apps/pocket-gamehub/frontend
npm install && npm run build
GAMEHUB_API_TARGET=http://127.0.0.1:18470 npx vite preview --host 127.0.0.1 --port 18480 --strictPort

# 3) 单张截图示例
"$CHROME_BIN" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=480,320 --screenshot=home-480x320.png http://127.0.0.1:18480/
```

## 分辨率与 DPI

六种分辨率：320×240、480×320（RG34XX 主目标）、640×480、720×720、1280×720、1920×1080。

DPI 用 `deviceScaleFactor` 1.5 / 2 / 3 在 480×320 逻辑视口下验证（`dpi-1.5x-720x480.png`、`dpi-2x-960x640.png`、`dpi-3x-1440x960.png`；1x 与 `home-480x320.png` 相同故不重复保存）。三张放大图均可读、布局一致，根字号恒为 16px，说明布局由 rem/clamp 驱动而非固定 px 网格。

## 视图定义（每张图的前置状态）

| 视图 | 前置操作 | 主题 | 语言 |
|---|---|---|---|
| `home` | 无（默认首页） | light | en |
| `library` | 点击 Library 导航 | light | en |
| `platform-list` | Library → 点击 `GBA` 平台 chip（结果标题变为 GBA） | light | en |
| `detail` | Library → 点击首张游戏卡 | light | en |
| `search` | 点击 Search → 输入 `Mario` | light | en |
| `collections` | 点击 Collections 导航 | light | en |
| `settings` | 点击 Settings 导航 | light | en |
| `dark` | 设置 theme=dark | dark | en |
| `light` | 设置 theme=light、language=zh | light | zh |

`light` 与 `home` 不同：前者是简体中文界面，后者是英文；`dark` 与两者都不同。

## 文件清单

尺寸由 PNG IHDR 头字节读取并与文件名逐一比对，57/57 全部匹配。

| 文件 | PNG 尺寸 | 视图 / 主题·语言 |
|---|---:|---|
| `dpi-1_5x-720x480.png` | 720×480 | Home @1_5x DPR（逻辑视口 480×320） / light/en |
| `dpi-2x-960x640.png` | 960×640 | Home @2x DPR（逻辑视口 480×320） / light/en |
| `dpi-3x-1440x960.png` | 1440×960 | Home @3x DPR（逻辑视口 480×320） / light/en |
| `collections-320x240.png` | 320×240 | Collections / light/en |
| `dark-320x240.png` | 320×240 | Home（深色） / dark/en |
| `detail-320x240.png` | 320×240 | Game Detail / light/en |
| `home-320x240.png` | 320×240 | Home（英文浅色） / light/en |
| `library-320x240.png` | 320×240 | Library 全平台 / light/en |
| `light-320x240.png` | 320×240 | Home（浅色·简体中文） / light/zh |
| `platform-list-320x240.png` | 320×240 | Platform GBA 筛选 / light/en |
| `search-320x240.png` | 320×240 | Search "Mario" / light/en |
| `settings-320x240.png` | 320×240 | Settings / light/en |
| `collections-480x320.png` | 480×320 | Collections / light/en |
| `dark-480x320.png` | 480×320 | Home（深色） / dark/en |
| `detail-480x320.png` | 480×320 | Game Detail / light/en |
| `home-480x320.png` | 480×320 | Home（英文浅色） / light/en |
| `library-480x320.png` | 480×320 | Library 全平台 / light/en |
| `light-480x320.png` | 480×320 | Home（浅色·简体中文） / light/zh |
| `platform-list-480x320.png` | 480×320 | Platform GBA 筛选 / light/en |
| `search-480x320.png` | 480×320 | Search "Mario" / light/en |
| `settings-480x320.png` | 480×320 | Settings / light/en |
| `collections-640x480.png` | 640×480 | Collections / light/en |
| `dark-640x480.png` | 640×480 | Home（深色） / dark/en |
| `detail-640x480.png` | 640×480 | Game Detail / light/en |
| `home-640x480.png` | 640×480 | Home（英文浅色） / light/en |
| `library-640x480.png` | 640×480 | Library 全平台 / light/en |
| `light-640x480.png` | 640×480 | Home（浅色·简体中文） / light/zh |
| `platform-list-640x480.png` | 640×480 | Platform GBA 筛选 / light/en |
| `search-640x480.png` | 640×480 | Search "Mario" / light/en |
| `settings-640x480.png` | 640×480 | Settings / light/en |
| `collections-720x720.png` | 720×720 | Collections / light/en |
| `dark-720x720.png` | 720×720 | Home（深色） / dark/en |
| `detail-720x720.png` | 720×720 | Game Detail / light/en |
| `home-720x720.png` | 720×720 | Home（英文浅色） / light/en |
| `library-720x720.png` | 720×720 | Library 全平台 / light/en |
| `light-720x720.png` | 720×720 | Home（浅色·简体中文） / light/zh |
| `platform-list-720x720.png` | 720×720 | Platform GBA 筛选 / light/en |
| `search-720x720.png` | 720×720 | Search "Mario" / light/en |
| `settings-720x720.png` | 720×720 | Settings / light/en |
| `collections-1280x720.png` | 1280×720 | Collections / light/en |
| `dark-1280x720.png` | 1280×720 | Home（深色） / dark/en |
| `detail-1280x720.png` | 1280×720 | Game Detail / light/en |
| `home-1280x720.png` | 1280×720 | Home（英文浅色） / light/en |
| `library-1280x720.png` | 1280×720 | Library 全平台 / light/en |
| `light-1280x720.png` | 1280×720 | Home（浅色·简体中文） / light/zh |
| `platform-list-1280x720.png` | 1280×720 | Platform GBA 筛选 / light/en |
| `search-1280x720.png` | 1280×720 | Search "Mario" / light/en |
| `settings-1280x720.png` | 1280×720 | Settings / light/en |
| `collections-1920x1080.png` | 1920×1080 | Collections / light/en |
| `dark-1920x1080.png` | 1920×1080 | Home（深色） / dark/en |
| `detail-1920x1080.png` | 1920×1080 | Game Detail / light/en |
| `home-1920x1080.png` | 1920×1080 | Home（英文浅色） / light/en |
| `library-1920x1080.png` | 1920×1080 | Library 全平台 / light/en |
| `light-1920x1080.png` | 1920×1080 | Home（浅色·简体中文） / light/zh |
| `platform-list-1920x1080.png` | 1920×1080 | Platform GBA 筛选 / light/en |
| `search-1920x1080.png` | 1920×1080 | Search "Mario" / light/en |
| `settings-1920x1080.png` | 1920×1080 | Settings / light/en |

共 57 张（9 视图 × 6 分辨率 = 54，另加 3 张 DPI 缩放验证）。
## 截图过程中发现并修复的真实缺陷

1. **导航被详情页覆盖**：打开 Game Detail 后点击侧栏导航，`selected` 未清除，界面停留在详情页。已在导航 onClick 首行 `setSelected(null)`。
2. **Light 主题完全不生效**：CSS 用 `.light` 类定义浅色调色板，而 `App.tsx` 只设置 `data-theme` 属性，选择器永不匹配。现在同时切换 `data-theme` 与 `.light` 类。
3. **320×240 首屏看不到游戏**：平台 chip 行占满竖向空间。已在 `max-height:300px` 下隐藏冗余 chip 行（下拉框仍可筛选），游戏网格回到首屏。
4. **截图重复**：主题/语言持久化到 SQLite，使后续视图继承前一张的状态；且未筛选的 Library 与平台页相同。现在每次截图前显式设置 theme+language，并对平台视图实际点击筛选。

## 已知限制

- 320×240 底部导航占 49px，列表首行可见，更多内容需滚动；浏览 → 详情 → 收藏/启动流程均可达。
- 截图时 RetroArch 未安装，Launch 按钮呈不可用状态，这是真实行为。
