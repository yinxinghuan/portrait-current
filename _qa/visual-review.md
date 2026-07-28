# Game Visual QA Report

## Context

- Game/build: Portrait Current
- Review target: 平台无 CORS 彩色玩家头像路径
- Viewports: 390×844、320×568
- Evidence: `ui/*-platform-motion-idle.png`、`ui/*-platform-motion-peak.png`、
  `ui/*-platform-complete.png`

## Executive assessment

- Decision: Pass
- First-pass P1: 无 CORS 玩家头像只有静态点阵和整体缩放，手指没有改变头像
  内部的粒子位置，在手机上等同于无动态交互。
- Fix: 保留真实头像的 tainted Canvas，先合成 180×180 随机圆粒，再通过
  36×36 网格执行局部径向推开、切向涡流、弹簧回位和阻尼。
- Remaining P0/P1/P2: 0 / 0 / 0

## Scorecard

| Category | Score | Evidence |
|---|---:|---|
| Hierarchy | 5 | 黑底中头像仍是唯一主视觉 |
| Coherence | 5 | 彩色照片已统一为上游高反差单色语法 |
| Readability | 4 | 完成态轮廓清楚，暗部自然隐入背景 |
| Game feel | 5 | 同帧局部推力、位移峰值、持续动态帧和回弹均有自动证据 |
| Asset quality | 5 | 使用真实玩家头像，不以默认图伪装 |
| Responsive UX | 5 | 两档手机尺寸无溢出或控件遮挡 |
| Polish | 4 | 圆粒密度与上游接近；无 CORS 路径以细网格近似逐粒位移 |

## Foundation audit

- 无功能 Emoji；原有 44px 重置按钮、安全区、双语与 reduced-motion 保持不变。
- `avatarSource=player`、`avatarRenderer=masked-particles`、720px 动态画布、
  黑白滤镜、触摸前后像素差、240ms 动态帧数、位移峰值、回弹比例、9/12
  完成和重置按钮均由自动 QA 断言。

## Iteration evidence

- First pass: commit `5ba4b03` 的连续静态点阵蒙版。
- Recheck: `390x844-platform-motion-idle.png`、
  `390x844-platform-motion-peak.png`、`390x844-platform-complete.png`，
  以及对应的 320×568 三帧。

## Final recommendation

- Final average: 4.7 / 5
- Categories below 3: none
- Decision: Pass
