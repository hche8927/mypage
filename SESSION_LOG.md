# Session Log — mypage (haodong.page)

**日期**: 2026-08-25 ~ 08-26 (AEST)
**范围**: 从液态玻璃视觉重构到最终收尾
**最终状态**: 浅色默认主题 / 液态玻璃卡片 + 电路板背景 / 4 个社交图标 / 双主题

---

## 一、这个 session 干了什么

### 1. 视觉体系：液态玻璃 (08-25 晚 ~ 08-26)
- 卡片全面改为 liquid-glass：半透明 paper 底 + `backdrop-filter: blur(10px)` + 1px hairline 边框 + 内侧顶部高光（`--glass-edge` inset highlight）+ 纸纹颗粒（feTurbulence 200px 平铺 + 24s 缓慢漂移动画）
- 双主题各自调参：浅色 `rgba(253,251,247,0.55)` 底；深色 `rgba(22,27,34,0.52)` 底，grain 用 screen 混合、透明度 0.045
- 背景换成电路板走线图案（64px SVG data-URI 平铺，`background-attachment: fixed` 钉在视口上，让玻璃卡片模糊的是**静止**背景——这是液态玻璃的关键）
- 主题切换图标：FA half-stroke 字形 → Freepik "Half" PNG（CC 3.0），深色下 `filter: invert(1)`

### 2. 移动菜单（dropdown）：玻璃 → 实心卡片（反复横跳后定型）
- 试过"玻璃 dropdown"多轮：blur 20px / 不透明 1.0 / 0.70-0.72 / 回退……最终**按规范放弃了**：
  **`.navbar` 自己有 backdrop-filter，就成为一个 backdrop root，其内部任何元素的 backdrop-filter 只能采样到 navbar 的平涂半透明底色，blur 等于恒等变换——玻璃下拉菜单按 CSS 规范就是死的。**
- 最终：移动端 dropdown = 实心悬浮卡片（`--menu-color`：浅 `rgba(248,245,238,0.99)` / 深 `rgba(22,27,34,0.99)`），1px 边框 + 阴影 + 12px 圆角，`width: max-content` 右贴（顶部和右各 0.5rem 等距留白）
- 桌面端无 dropdown（菜单平铺在 navbar 内），1024px 是二进制断点（与 Bulma burger 断点对齐），不存在"平板中间态"

### 3. 触屏 sticky 状态全家桶（这个 session 最大的坑，修了三轮）
触屏设备（iOS Safari 为主）会把 `:hover`/`:active`/`:focus` **粘在点过的元素上**直到点别处，导致三批症状：
1. **About 链接残留蓝色** — Bulma 全局 `a:hover { color: #485fc7 }` 特异性 (0-1-1) 高于我们的主题色规则 (0-1-0)，且触屏 hover 粘滞 → 修复规则必须**放在** `@media (hover:hover)` **外面**（正好在 query 不匹配的触屏上生效）
2. **navbar 按钮点完"按住了"**（burger/About/主题切换）→ 双保险：CSS 里 hover 背景进 `@media (hover:hover)`、focus 背景只给 `:focus-visible`、点击残留 focus 显式 `background: transparent !important`；JS 里 `touchend` 后 `setTimeout(0)` blur 被点元素（保住真实按压反馈）
3. **social 图标点完半透明+上移不还原**（用户最后报的"几个按键"）— 真凶：`.social-links a:hover, .social-links a:focus { opacity:.55; translateY(-2px) }` 把 `:focus` 和 hover 效果绑死了。修法同上：`:active` 按压 + `@media (hover:hover)` 挂 hover + `:focus:not(:focus-visible):not(:active)` 复位 + 键盘保留 focus-visible 环
   **教训：排查时先用 CDP 把 navbar 全点了一遍（干净），差点漏掉 social 行——"按钮"不一定指 navbar 按钮。**

### 4. 社交图标定稿
- LinkedIn / GitHub（FA brands）+ Google Scholar（`fa-graduation-cap`，链接 `scholar.google.com/citations?user=uAa5nxsAAAAJ&hl=en`）+ IMDb（`imdb.com/name/nm18435168/`），IMDb 放最后
- IMDb 图标迭代：outline SVG（用户否掉）→ FA solid `fa-imdb` → **官方品牌包 SVG**（brand.imdb.com Design Toolkit 下载，用户确认来源）
  - 白字抠透明第一版失败（直接删白色路径 = 黑实心块）；正解：**两条 path 合并成一条 + `fill-rule: evenodd`**，字标笔画是真正的镂空孔洞（数包围奇偶性：笔画内部计数 2 → 透明，计数器内部计数 1 → 保留黑）
  - 深色主题整图 `filter: invert(1)` → 白方块 + 深色镂空字标
- About 文字：去掉全部 `<em>`/`<b>`，纯文本

### 5. 默认主题：深色 → 浅色
- `localStorage.getItem('theme') || 'light'`（index.html head 内联 + theme.js 兜底两处）

### 6. 收尾清理（零视觉影响）
- 删死 token：`--paper-color`（双主题，仅注释引用）、`--icon-color`（双主题，零引用）
- 删死规则：深色主题 `.button.is-light` 块（HTML 里没有 `.button`）
- 修正注释中对已删 token 的引用；`--glass-blur/--glass-bg` 缩进对齐
- 净 -15 行，全部零引用，不影响任何渲染

---

## 二、重要发现 / 技术结论

1. **Backdrop root 规则（CSS Filter Effects 2）**: 元素一旦有 `backdrop-filter`，其**后代**的 backdrop-filter 只能以它为采样源（flat 填充），多层玻璃嵌套是无效的。nav 里的玻璃 dropdown 天然死路 → 标准做法是实心卡片。
2. **触屏 sticky 三兄弟**: iOS Safari 上 `:hover`/`:active`/`:focus` 点过后都会粘滞。可复用修复模板：
   - hover 效果 → `@media (hover: hover)`
   - 按压反馈 → 只用 `:active`（瞬时，按着才显示，永不粘）
   - 点击残留 focus → `:focus:not(:focus-visible):not(:active) { 复位 }`
   - 键盘可达性 → 保留 `:focus-visible` 环
   - 双保险 → `touchend` + `setTimeout(0)` blur（真实 mousedown/up 反馈不受影响）
3. **Bulma 陷阱**: 全局 `a`/`a:hover` 规则会渗透到 navbar-item 里（颜色 #485fc7 蓝、hover 底色 rgba(10,10,10,.1)），需要 `!important` 或更高特异性压住；且"压住"的规则在触屏上必须**故意放在** hover 媒体查询外。
4. **SVG 镂空**: 官方 logo "黑底+白字" 要改成 "黑底+透明字"，不能删白色 path（会变实心），要用 evenodd 单路径让字标成洞。
5. **CDP 调试工作流**（本项目验证过的）: Chrome `--remote-debugging-port=9224` + Node WebSocket 脚本；`Emulation.setDeviceMetricsOverride` 切 iPhone 390×844 和桌面 1280；`Input.dispatchMouseEvent/TouchEvent` 模拟点击后读 computed style + `document.activeElement` 判残留；`Page.captureScreenshot` clip 必须带 `scale` 字段且 clip 不能超视口（要先 scrollIntoView）。注意：CDP 的 WS 通道可能挂死（1006/超时），换 `/json/new` 开新 tab 即可恢复。
6. **像素截图对比的局限**: 页面有 24s 无限漂移动画（grain）时，任何两次截图（哪怕同版本）都有全屏亚像素差，像素 diff 不可靠；"零视觉影响"的可靠依据是**结构论证**（删除的规则零引用）+ CDP 状态断言，不是像素 diff。
7. **Hermes 环境坑**: `write_file` 写多行 JS 偶发截断 → 改用 `python3 - <<'PYEOF'` heredoc；bash heredoc 里的多行 JS 也会被截 → 同样先落盘再执行；ImageMagick 处理复杂 SVG 会静默失败（exit 0 但文件不对），关键产物要视觉复核。
8. **GitHub Pages 部署**: 每次 push 后约 40s 生效；验证用 `curl -s https://haodong.page/ | grep`。

---

## 三、最终设计参数（速查）

| 项 | 值 |
|---|---|
| 默认主题 | 浅色（localStorage 覆盖） |
| 背景 | 电路板走线 64px 平铺，fixed；浅色 #F5EFE4 底 / 深色 #0d1117 底 |
| 玻璃卡片 | blur 10px，浅 rgba(253,251,247,.55) / 深 rgba(22,27,34,.52)，hairline + inset 顶光 |
| 卡片节奏 | margin 1rem，padding 2rem，radius 12px，max-width 900px |
| navbar | sticky，玻璃，仅底部 12px 圆角；移动端全宽 |
| 断点 | 1024px（Bulma burger 断点，二进制切换） |
| 移动菜单 | 实心卡片，浅 rgba(248,245,238,.99) / 深 rgba(22,27,34,.99)，max-content 右贴 |
| 字体 | Noto Sans（正文）+ Pacifico（H.C. 标志） |
| 图标 | FA 6.5.1 + 官方 IMDb SVG（evenodd 镂空）+ Half PNG（主题切换，invert） |

## 四、文件结构

```
CNAME                 haodong.page
imdb.svg              官方 IMDb mark，单 path evenodd 镂空
index.html            单页：navbar + hero(社交图标) + About
css/styles.css        全部样式（token + 玻璃 + 状态管理 + 响应式 + 深色）
js/init.js            AOS + 移动菜单 + touchend blur
js/theme.js           主题切换（localStorage 持久化 + 图标旋转）
assets/theme-toggle.png  "Half" 图标 (CC 3.0, Freepik)
```

外部 CDN: Bulma 0.9.4 / Font Awesome 6.5.1 / AOS / Google Fonts。
