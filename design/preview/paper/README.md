# ima Clipper · 纸面 UI 预览稿

一个纯静态的设计预览：把弹窗的视觉语言整体换到 MarkTab 的「纸面」体系上。**不含任何业务代码改动**——`src/`、`manifest.json`、构建与发布脚本都没动，也没有新增依赖。

打开方式：直接双击 `index.html`，或在 Files 页面预览。全部相对引用，不发任何网络请求（无 CDN、无网络字体、无远程图片）。

弹窗里的英文界面文案全部照搬 `PopupApp.tsx` / `imaStatus.ts`（`Save to ima`、`ima connected / … / Ready`、`No readable content was found on this page.` 等）；正文与 Markdown 里的那篇文章是示例内容，不是界面文案。

```
design/preview/paper/
├── index.html   7 个 360×600 弹窗帧 + 预览板
├── style.css    纸面令牌（逐条照抄）+ 弹窗样式
├── app.js       预览交互：切标签、展开设置、Copy / Save / Retry 状态、360↔560 切换
└── README.md    本文件
```

---

## 一、先纠正 spec 里的两处事实

写代码前核对了仓库，有两处与 spec 的补充描述不一致，按「代码与事实优先」处理：

1. **弹窗实宽是 560px，不是 360px。**
   `src/ui/popup/PopupApp.tsx` 的根节点是 `w-[560px]`，`popup.css` 里 `html, body, #root` 都写死 `width: 560px`。spec 说「宽度由 CSS 决定」是对的，但取值是 560。
   本稿按 spec 要求出 **360px** 主图（当作窄宽度压力测试），并在 ① 帧右上角提供 **560px 切换**，同一份标记在两档宽度下对照。
   **我的建议：正式改造保留 560px。** 这个弹窗的主要工作是读正文，360px 下正文只剩约 40 字符/行，比现在的 560px 明显局促；纸面视觉与宽度无关，不需要为了换皮而收窄。是否收窄请你拍板。

2. **现有视觉与纸面令牌是全面冲突，不是微调。**
   现在的 `popup.css` 是：绿色 accent（`#0f9f6e`）、玻璃拟态（`backdrop-filter: blur(28px)`）、渐变背景（两团径向绿光）、16px 大圆角、`translate` + `scale` 的按压缩放和 220ms 入场动画、按钮上的多层阴影。
   纸面令牌禁止其中大部分：`--shadow-1/2: none`、`--rail-blur/--scrim-blur: 0`、交互反馈只许变色、圆角上限 8px。所以本稿是**重画**，不是改色。

---

## 二、令牌怎么用

颜色、字号、间距、圆角、动效全部来自 `tokens.css`，`style.css` 顶部就是逐条转抄的副本，没有新造取值。

照搬的：

- 全部浅色 / 深色颜色令牌，变量名与令牌一致（`--canvas`、`--surface-1`、`--accent`…），深色只在 `[data-theme='dark']` 下覆盖。
- 字号阶梯（xs 12 / sm 13 / md 14 / lg 15 / xl 17 / 2xl 24）、行高 1.2 / 1.4 / 1.65、字距 tight −0.01em 与 caps 0.06em。
- 间距 4px 基准、圆角 xs 2 / sm 4 / lg 6 / xl 8、控件高度 32 / 36 / 40。
- 动效时长与 `--ease-out`；`--shadow-1/2: none`；`--shadow-3` 只给 tooltip（本稿唯一浮层，见「反馈」一节）。
- 焦点环 `0 0 0 2px var(--surface-2), 0 0 0 4px var(--focus)`，无过渡。
- 字体：`--font-serif` 只用于品牌行、页面标题、视图标题；正文与控件一律 sans；Markdown 与代码用 mono。

**为 360px 做的判断（不是新令牌，是令牌的取舍）：**

| 位置 | 现实现 | 本稿 | 理由 |
| --- | --- | --- | --- |
| 抓取模式徽标 | `rounded-full` 彩色胶囊 | 2px 方角纸签 + 9.5px 全大写 + 0.06em 字距 | 令牌规定 999px 只给开关轨道/滑块；徽标是标签不是控件 |
| 状态指示 | `status-icon-chip`（图标底片） | 6px 实色方点（success / warning / error / 中性） | 同上，圆形状态点会破坏「只有开关是圆角」的规则；方点在纸面上更像印刷标记 |
| 卡片 | 半透明白 + `backdrop-filter` + 多层阴影 | `--surface-1` + 1px `--border-1` + 6px 圆角，零阴影 | 令牌明令禁止 blur 与非浮层阴影 |
| 标签页 | 滑动药丸 + 阴影指示块 + 300ms 位移 | 平面文字 + 2px accent 下划线，无位移 | 交互反馈只许变色；滑动位移属于被禁的「位移动画」 |
| 主按钮 | 黑色渐变 + inset 高光 + 阴影 + 按压缩放 | 实色 `--accent`，hover `--accent-hover`，4px 圆角 | 渐变与阴影均不在纸面体系内 |
| 滚动条 | 10px 半透明胶囊 | 9px `--border-1` 方角细条 | 与徽标同理，不给非控件 999px |
| 页面背景 | 两团径向绿光渐变 | 纯 `--canvas` | 令牌禁止铺环境渐变 |

---

## 三、逐屏说明

### ① Reader · 正文

- 品牌行：`ima Clipper` 用衬线 15px/600，右侧一条 1px 竖线后跟 9px 全大写 `WEB CLIPPER`，替代原来的绿点 + 灰字。
- 页面标题：衬线 17px/1.2，最多两行（`-webkit-line-clamp: 2`）。原来是一行截断，长标题会丢信息。
- 元信息：`every.to · 14:32 · 842 words · 3 images`，用 `·`（`--border-2`）分隔，去掉一排灰胶囊。右侧留 `Auto` 纸签。
- 标签页：Reader / Markdown / Preview 三段文字，激活态 accent 下划线；`Home/End/←/→` 键盘行为不变。
- 正文：卡片 `--surface-1` + 1px `--border-1` + 6px 圆角，内文 13px/1.65 `--text-2`，首段 13.5px `--text-1`；标题 sans 600；引用左边 2px `--border-2`；行内代码 `--surface-3`；代码块 `--surface-3` + 线框（不再用近黑底）；列表用方点；图片位置用虚线占位块（预览不发网络请求）。
- 交互：点 Copy → 按钮变 accent 实底 + `Copied` + 对勾；URL / 标题 / 下载三个图标按钮点完在原地短暂显示 accent 对勾；点 560px 切换看同一设计在现有宽度下是否成立（此时正文限宽 60ch，避免长行）。

### ② Markdown · 可编辑源码

- 输入区改成「稿纸」：`--surface-2` 底、1px 线框、4px 圆角、mono 11.5px/1.65，`tab-size: 2`。
- 顶部一行：左侧 9.5px 全大写 `EDITABLE MARKDOWN`，右侧 11px `842 words ready to refine`（沿用现有文案）。
- 标签页 Markdown / Preview 可切换，Preview 是同结构的只读渲染。两者共用同一套正文排版，避免「编辑时和预览时长得不一样」。

### ③ ima 保存 · 成功

- 页脚从玻璃浮层改成纸面下沿：`--surface-1` 底 + 顶部 1px `--border-1`，不再有 `--shadow` 和圆角。
- 状态行：`ima connected / Reading list / Ready`，前面 6px success 方点，右侧齿轮；整行 `text-overflow: ellipsis` + `title` 兜底（现有 `formatImaStatusLine` 的文案原样保留）。
- 知识库选择：32px 高、4px 圆角、自绘 chevron（纯 CSS 边框旋转，不用图片）。
- Save to ima：整行宽 36px 高，实色 accent。点下去 → `Saving`（图标旋转 850ms）→ `Saved`（`--success-soft` 底 + `--success` 字 + success 描边），状态行末尾同时变成 `Saved`。成功态同时出现在状态行与按钮两处，没有浮层提示条。
- 设置默认收起，齿轮可展开（`hidden` 切换，不做高度动画——纸面只给浮层和瞬时提示做动效，而这里连浮层都不需要）。

### ④ ima 保存 · 失败 + 设置展开

- 错误用两级：顶部 error 提示块（error-soft 底 + error 描边 + 标题/说明），状态行 detail 段转 `--error`，Save 按钮变 `Retry save`（error-soft 底 + error 描边）。点 Retry 会再走一次 Saving → 失败，验证状态机。
- 设置展开：Client ID 独占一行，API Key 与 `Save Connection` 同一行（输入 32px 高、按钮同高，省下 40px），标签 9.5px 全大写。
- **代价要说清**：设置展开后页脚 175px → 300px，正文区 288px → 163px（正文卡片只剩 66px）。这是现有弹窗的真实行为（正文 `flex: 1` 被压缩），不是预览画法。可选出路：设置改成浮层 / 抽屉（纸面允许 `--shadow-3` 的浮层），或页脚整体可滚动。属于交互改动，本稿不替你定。

### ⑤ Fallback · 抓不到正文

- `Fallback` 纸签用 warning 色，不用红色——降级不是错误。
- 警告块：warning-soft + warning 描边 + 两级文字（沿用现有文案 `Some content could not be extracted.` / `Select exact text, then reopen the clipper.`）。
- 空白态：22px 线稿图标 + 13px（`--fs-sm`）标题 + 11.5px 说明，主动作 `Select Area`，次要动作 `Refresh`（ghost）。Save 与 Copy/Download 明确禁用：`--surface-3` 底 + `--text-3` 文字 + 1px 线框，不用 `opacity` 半透明。

### ⑥ 未连接 ima · 首次使用

- 状态行改为 `Connect ima to save directly` + 中性方点；设置默认展开（首次使用必须填），Save 禁用。
- Copy / 下载 / 打开 ima 仍然可用——剪藏本身不依赖 ima，这条要在界面上看得出来。
- 点齿轮收起设置，可验证正文多出两行。

### ⑦ 深色令牌 · Reader

- 只用深色令牌渲染 Reader，验证结构没有浅色硬编码（accent-soft 徽标、链接、引用、代码块、卡片、按钮全部跟随）。
- 深色令牌表里没有 success / warning / error，所以本帧刻意不出现这三种语义色；真要做深色主题，需要补这三组（或沿用浅色，会有对比度问题）——这是下一轮的事。

### 反馈：为什么删掉了浮层提示条

初稿做过一条浮在页脚上方的提示条（`--shadow-3` + 淡入淡出），实测在 360×600 里有两个问题：设置展开时它盖住仅剩 66px 的正文卡片；收起时它也压住正文最后两行。纸面体系里反馈本来就是「颜色变化」而不是新开一层，所以改成：

- 控件自身变色：Copy → `Copied` + 对勾；URL / 标题 / 下载 → 原地短暂显示 accent 对勾（1.4s）；Save → `Saving` → `Saved` / `Retry save`。
- 状态行同步：保存成功时 `ima connected / Reading list / Saved`（`formatImaStatusLine` 现有行为），失败时 detail 段转 `--error`，并配一条 error 提示块。
- 无障碍播报沿用现有的 `sr-only` `aria-live` 区域，不靠浮层。

代价：`--shadow-3` 只剩 tooltip 一处浮层，视觉上少了一点「即时奖励」。如果后续确实需要，提示条应该挂在动作行上方而不是页脚上方，并且只出现在正文卡片之外。

---

## 四、开放问题：我的回答

**1. 要不要深色主题？**

现状：没有主题切换。`popup.css` 写死 `color-scheme: light`，`PopupApp.tsx` 里没有任何 `matchMedia('(prefers-color-scheme)')` 或主题状态。

建议本轮**不做切换**：先把令牌以 `:root` + `[data-theme='dark']` 的形式落地（成本近乎为零），弹窗固定浅色；等有人真在暗环境用再说。⑦ 帧证明令牌够用，不需要改结构。如果要做，缺的是 success/warning/error 的深色取值，得回 MarkTab 补，别在这里自己调。

**2. 「复制 / 下载 / 打开 ima」压成图标行，还是保留文字行？**

选择：**Copy 保留文字，其余全部 28px 图标 + tooltip。**

- 360px 下可用宽 332px。五个文字按钮（Select Area / Copy / Copy URL / Copy Title / Download / Open ima）实测需要 400px 以上，必然折成两行，吃掉约 40px 正文高度——那是两行正文。
- `Copy` 是最高频动作，且它的状态文案（`Copied`）必须能被读到，所以保留文字 + 图标；其余四个用 28px 图标，hover/focus 出 tooltip（`--shadow-3`，唯一允许的浮层阴影），并保留 `aria-label` 与 `title`。
- 现状其实已经是这样（URL / Title / Download / Open ima 本来就是图标按钮，只有 Copy 有文字），本稿只是把尺寸统一到 28px、补上 tooltip、并把 Copy 从黑色主按钮降级成 accent 描边按钮——一屏里只留一个实色主按钮（Save to ima）。

---

## 五、高度账（360 × 600，浏览器实测）

| 区块 | 高度 |
| --- | --- |
| 头部（品牌行 + 标题 + 元信息 + 上下留白） | 92px |
| 标签栏（含 11px 上边距） | 45px |
| 正文区（含 10/12 内边距，卡片 266px） | 288px |
| 页脚：状态行 18 + 选择 32 + Save 36 + 内边距/间距 | 175px |

92 + 45 + 288 + 175 = 600，无横向溢出（各帧 `scrollWidth` 均为 360）。

设置展开后页脚 300px，正文区 163px（卡片 66px）——④ 帧如实呈现。

---

## 六、没覆盖的部分

- Preview 只作为 ② 帧的第二个面板，没有单独出帧。
- Loading（`Extracting this page...`）、Manual Area 结果窗口、恢复失败（`Retry` / `Back to Auto`）只在 ⑤ 帧示意了空状态，没有逐一出帧。
- 深色只出 Reader 一屏。
- 站点规则徽标（`siteRuleApplied`）在预览里没出现，落地时沿用同一枚纸签样式（`p-chip--site`）。

---

## 七、落地映射（给下一轮计划用）

预览类名 → 现有实现，方便按图改代码：

| 预览 | 现有 | 动作 |
| --- | --- | --- |
| `.p-head` / `.p-top` / `.p-brand*` | `header > .panel-shell`、`.brand-mark` / `.brand-dot` | 重写，去玻璃底与绿点 |
| `.p-title` | `h1`（`text-[18px] font-semibold`） | 换衬线 17px + 两行截断 |
| `.p-meta` / `.p-chip` | `.meta-pill` / `.source-badge-*` | 胶囊 → `·` 分隔 + 2px 纸签 |
| `.p-tabs` / `.p-tab` | `.tab-nav` / `.tab-indicator` / `.tab-button` | 删 `tab-indicator` 位移，改下划线；`handleTabKeyDown` 不动 |
| `.p-reader` | `.reader-shell` / `.reader-content` / `.content-surface` | 去渐变底，换线框卡 + 新正文排版 |
| `.p-textarea` / `.p-md` | `textarea` + `.section-label` / `.supporting-copy` | 换稿纸样式 |
| `.p-ima` / `.p-ima-status` / `.p-mark` | `.ima-panel-compact` / `.ima-status-line` / `.status-icon-chip` | 去 `backdrop-filter` 与阴影，状态图标改方点 |
| `.p-select` / `.p-input` / `.p-label` | `.ima-select` / `.ima-input` / `.settings-label` | 32px 高、4px 圆角、自绘 chevron |
| `.p-btn--primary` / `.p-save` | `.primary-button` / `.ima-save-button(-success/-error)` | 黑色渐变 → 实色 accent；success/error 改 soft 底 |
| `.p-icon` | `.icon-button` / `.toolbar-button` | 统一 28px，去 `scale` 按压 |
| `.p-btn--outline` | `.compact-primary-button`（Copy） | 改描边，保留 `Copied` 文案 |
| `.p-note` | `.status-note` / `.status-note-manual` | 改描边提示块 |
| `.p-settings`（两列栅格） | `showImaSettings` 分支里的 `grid gap-2` | Client ID 独占一行，API Key 与 `Save Connection` 同行，省 40px |
| `.p-empty` | `.empty-state` | 保留结构，换尺寸与禁用样式 |
| `.p-icon.is-confirmed` / `.p-btn--outline.is-copied` | 无（现在只有 `actionState` 的 sr-only 播报） | 新增控件级确认态：对勾 + accent-soft 底，1.4–1.6s 后复原 |

真正落地时还要一起处理的：`popup.css` 里的 `--ima-*` 变量、`html/body/#root` 的 560px 宽度（若采纳收窄）、`panel-enter` / `action-pulse` 两处位移动画、`*::-webkit-scrollbar` 的 999px 圆角。
