# 图像粒子产品与技术调研

> 调研日期：2026-09-06 · 范围：浏览器端图像粒子创作工具、粒子框架与相邻创意工具

## 结论先行

图像粒子产品大致分为三类：展示型特效、参数型编辑器、输出型创作工具。展示型产品上手快但作品无法带走；参数型编辑器能力丰富但容易变成调参面板；输出型工具通过图片/视频/嵌入代码完成传播闭环。PRISM 已经拥有区别于常见 2D 排斥效果的 2.5D/3D 空间观看体验，最有价值的方向不是增加更多同时可见的参数，而是建立「导入 → 选气质 → 微调 → 捕捉瞬间 → 导出」的完整创作回路。

## 市场样本

| 样本 | 类型 | 已验证能力 | 对 PRISM 的启发 |
| --- | --- | --- | --- |
| [ParticleFX](https://github.com/mitulgajera16/particle-effect) | 开源参数型编辑器 | 图片上传、鼠标排斥与弹簧回弹、点击涟漪、4 个内置预设、自定义预设、20+ 参数、嵌入代码导出、WebGL2 + Canvas2D 回退、本地处理 | 预设与可复用输出很重要；PRISM 应避免一次暴露 20+ 参数，把复杂性封装成少量“气质” |
| [Particular Drift](https://github.com/collidingScopes/particular-drift) | 开源输出型创作工具 | Sobel 边缘检测、Perlin/Simplex 流场、2D/3D 运动、图片和视频导出、本地处理；视频链路使用 WebCodecs 与 MP4 muxer | 边缘流场可以成为独特的新形态；视频导出证明“作品可带走”是核心，而非附属功能 |
| [Particleify](https://particleify.talizen.com/) | 浏览器端 3D 粒子生成器 | 搜索与产品页信息显示支持图片、SVG、GLB 输入以及交互 HTML、MP4 输出，创作链路完整在浏览器内 | 中期可扩展 SVG/GLB，但当前先把图片导出闭环做透 |
| [Trickle Interactive Particle Visualizer](https://trickle.so/templates/apps/interactive-particles) | 模板/展示型工具 | Three.js 图像粒子化，密度、颜色、速度与行为控制，上传、复位、响应式以及无代码再编辑 | 这些已成为品类基础能力，不能单独构成差异；PRISM 的空间构图和动效语言需要更鲜明 |
| [tsParticles](https://particles.js.org/options/plugin-polygon-mask) | 通用粒子框架 | 丰富形状、hover/click 交互、轨迹、声音、缩放与 SVG polygon mask；官方建议优化 SVG 路径并验证加载回退 | 功能覆盖很广但面向开发者配置。PRISM 应提供成品式体验，而不是框架式配置 |
| [Three.js 粒子示例](https://threejs.org/examples/?q=particle) | 技术基线 | Points sprites、动态点、波面、自定义属性、WebGPU compute 粒子等公开示例 | 单纯“点云 + 波面”已是技术基线，差异必须来自图像适配、导演式转场和输出体验 |

## 用户需求信号

从这些产品公开功能可以归纳出五个高频需求：

1. **立即得到可辨认结果**：导入后先保证主体清楚，参数只是后续修饰。
2. **通过少量预设获得明显风格变化**：预设比裸露大量物理参数更适合普通用户。
3. **光标或触摸能直接改变作品**：排斥、吸附、涟漪与流场是常见互动语言。
4. **导出或嵌入**：静态图、视频或嵌入代码决定作品能否离开工具。
5. **性能可理解**：密度/质量档、FPS 或自动降级让高质量与设备能力之间有明确关系。

## PRISM 的差异化方向

### 1. 把“模式”改造成气质，而不是技术名词

当前「浮雕 / 波面 / 星尘」描述算法。后续以作品感受组织为「显影 / 潮汐 / 游离 / 引力」，参数仍可微调，但首层选择回答“我想让它呈现什么情绪”。

### 2. 建立捕捉瞬间的工作流

新增“定格”状态：暂停运动、隐藏界面、微调构图、导出 2× PNG/WebP。视频导出作为下一步，不阻塞静态导出。导出文件附带可选 JSON 配方，方便复现。

### 3. 用导演式转场强化记忆

图片之间不直接替换。旧图先解构成粒子雾，新图从相同粒子重组；模式变换使用连续场混合。它会成为 PRISM 比单纯效果编辑器更容易被记住的地方。

### 4. 自动适配先于手动调参

分析透明度、边缘背景、对比度、长宽比和亮度分布，自动选择阈值、点数、默认粒径与曝光。高级用户可以覆盖，但新用户无需修复导入结果。

### 5. 渐进增强 WebGPU

[MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) 仍将 WebGPU 标为 Limited availability，并要求安全上下文；[Three.js WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html) 可以在不支持 WebGPU 时回退到 WebGL2。因此 PRISM 保留 WebGL 作为稳定基线，在后续实验通道中使用 WebGPU compute 扩展粒子规模，不把 WebGPU 作为当前版本前提。

## 产品取舍

### 当前纳入

- 2× 高清静态导出与无界面观赏模式。
- 三档质量/密度与自动质量建议。
- 参数预设和本地持久化。
- 触屏双指缩放。
- 粘贴图片导入。
- 画面调节：辉光、曝光、饱和度，保持折叠。
- 新形态优先做「引力」和「流场」，并继续使用连续插值。

### 暂缓

- 视频/GIF 导出：浏览器编码兼容性与测试成本高，在静态导出稳定后推进。
- GLB、视频和批量图片输入：会扩张采样管线，先验证图片创作闭环。
- 20+ 同屏参数：违背极简、作品优先的体验目标。
- WebGPU-only：当前浏览器覆盖不足，不适合作为首要架构迁移。
- 社区账号与云端画廊：与本地隐私承诺冲突，且不是单页创作价值的前提。

## 研究边界

- 调研以产品官网、官方文档和公开仓库在 2026-09-06 可见的信息为准；部分产品没有公开使用量、转化率或完整定价，本文不对市场规模做无证据估算。
- Particleify 官网在本次自动读取时出现超时，其能力来自搜索引擎抓取的官方产品页摘要，因此置信度低于可直接打开的公开仓库和文档。
- “用户需求信号”是跨样本功能频次得到的产品推断，不代表经过用户访谈或量化实验验证。

## 来源账本

| 来源 | 发布者 | 日期/状态 | 用途 | 访问情况 |
| --- | --- | --- | --- | --- |
| [ParticleFX README](https://github.com/mitulgajera16/particle-effect) | Mitul Gajera | 访问于 2026-09-06 | 功能、参数、架构、隐私与导出 | 可直接读取 |
| [Particular Drift README](https://github.com/collidingScopes/particular-drift) | collidingScopes | 访问于 2026-09-06 | 边缘检测、流场、WebCodecs、图片/视频导出 | 可直接读取 |
| [Particleify](https://particleify.talizen.com/) | Talizen | Public Beta，访问于 2026-09-06 | 输入与输出范围 | 页面超时，仅取得官方页摘要 |
| [Interactive Particle Visualizer](https://trickle.so/templates/apps/interactive-particles) | Trickle / Risk Taker | 访问于 2026-09-06 | 模板型产品功能与使用场景 | 可直接读取 |
| [tsParticles Polygon Mask](https://particles.js.org/options/plugin-polygon-mask) | tsParticles | 文档访问于 2026-09-06 | SVG mask 与插件能力 | 可直接读取 |
| [Three.js examples](https://threejs.org/examples/?q=particle) | Three.js | 文档访问于 2026-09-06 | WebGL/WebGPU 粒子技术基线 | 可直接读取 |
| [WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) | MDN contributors | 更新于 2026-09，访问于 2026-09-06 | 浏览器可用性与安全上下文限制 | 可直接读取 |
| [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html) | Three.js | 文档访问于 2026-09-06 | WebGPU/WebGL2 回退路径 | 可直接读取 |
