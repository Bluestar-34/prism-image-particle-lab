# 参与 PRISM 开发

## 本地检查

```bash
npm install
npm run build
```

需要执行浏览器验收时，在一个终端运行 `npm run dev`，另一个终端运行 `npm run test:ui`。测试覆盖 1440×900、1280×720、390×844、320×568 和 844×390，并验证键盘、参数、气质、质量、导入、定格与错误路径。

## 变更原则

- 作品必须拥有独立画布空间，常驻控件不能覆盖主体。
- 保持单一暖色强调；避免霓虹、过多圆角、玻璃卡片和参数墙。
- 新功能先定义默认结果和失败状态，再增加高级参数。
- 连续动画只改变 transform、opacity 或 GPU uniform；支持 `prefers-reduced-motion`。
- 每个重要阶段同步更新 `docs/OPTIMIZATION_LOG.md` 和 PRD 状态。
- 提交前重建 `dist/`，确保构建产物与源码一致。

## 提交建议

一个提交只解决一个可描述的问题，例如：

- `feat: export a 2x PNG from capture mode`
- `fix: preserve focus when closing parameters`
- `docs: explain adaptive quality thresholds`

PR 应说明触发场景、行为变化、验证命令和视觉风险。涉及界面时附桌面与移动截图。

