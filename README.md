# PRISM

把一张图像显影为可旋转、可呼吸、可定格带走的三维粒子作品。

![PRISM 工作台](docs/media/prism-workspace.png)

PRISM 是一间浏览器里的图像暗房。图片只在本地解码与采样，数万个颜色粒子由自定义 shader 实时渲染。界面退到两侧，中央完整留给作品。

它不是 Particular Drift 那样的 2D 流场参数台，也不是 20 个滑杆的物理沙盒。导入之后先自动得到可辨认的立体浮雕，再用气质或一次「灵感」决定感觉，最后在定格模式里把这一刻带走。

## 为什么做它

多数图像粒子工具要么只是一次性特效，要么把算法名词摊在画布上。PRISM 选择更克制的路径：

- 作品拥有独立舞台，常驻文字很轻、很暗
- 五种连续形态：浮雕、波面、星尘、漩涡、流场
- 气质与灵感代替参数墙
- 定格后导出 2× PNG / WebP，以及不含原图的 JSON 配方

## 已实现

- 选择、拖放、粘贴导入；PNG / JPEG / WebP / AVIF，最大 30 MB
- 透明度、深色背景与亮度自适应采样
- 浮雕 / 波面 / 星尘 / 漩涡 / 流场，连续插值而不是硬切
- 显影、潮汐、游离、余烬；自定义气质本地保存，同名覆盖
- 灵感取样：在设计过的气质空间里抖动，而不是打乱全部物理量
- 景深、流动、粒径，以及折叠的辉光 / 色温 / 饱和
- 旋转、滚轮与双指缩放、光标粒子场、散开与暂停
- 自动 / 轻盈 / 均衡 / 精致质量档
- 定格模式、2× PNG、WebP、JSON 配方、URL hash 复现
- 换图时先解构再揭示
- 键盘路径、减少动效、错误反馈、320px 与矮横屏

## 开始使用

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

打开终端显示的本地地址。生产构建：

```bash
npm run build
npm run preview
```

浏览器验收（先启动开发服务器）：

```bash
npm run test:ui
```

Windows 默认查找 Chrome；其他系统可通过 `CHROME_PATH` 指定 Chromium。

## 操作

| 操作 | 结果 |
| --- | --- |
| 拖动 / 单指 | 旋转 |
| 滚轮 / 双指 | 缩放 |
| `Ctrl/Cmd + O` | 选择图片 |
| 粘贴 | 导入剪贴板图片 |
| `Space` | 画布聚焦时暂停 |
| `R` | 灵感 |
| `?` | 快捷键图例 |
| 方向键 | 画布聚焦时旋转 |
| `S` | 定格模式下导出 PNG |
| `Escape` | 关闭当前层或复位 |

## 技术结构

- Vite + 原生 HTML / CSS / JavaScript
- Three.js `Points` + `ShaderMaterial`
- EffectComposer + UnrealBloomPass
- GSAP 驱动 uniform 与界面过渡
- Playwright Core 做多视口回归

所有粒子一次 draw call。质量档限制采样、DPR 与辉光。详见 [架构说明](docs/ARCHITECTURE.md)。

## 文档

- [产品需求](docs/PRD.md)
- [竞品与技术调研](docs/MARKET_RESEARCH.md)
- [逐步优化记录](docs/OPTIMIZATION_LOG.md)
- [架构说明](docs/ARCHITECTURE.md)
- [参与开发](CONTRIBUTING.md)

## 隐私

图片只在当前浏览器中解码、采样和渲染，不上传。自定义气质写入 localStorage。导出的配方和 URL hash 不含原图数据。

## 许可

[MIT](LICENSE)
