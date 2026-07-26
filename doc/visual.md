# Visual Direction

## Thesis

手指不是在擦拭照片，而是在一股像素电流中重新发现自己的脸。

## Original Baseline

固定 revision `efe300f9cd2b976da377ed43e9f50662fb575bf7`：Three.js 0.98、320×180 示例图、CPU 暗像素剔除、InstancedBufferGeometry、原 particle shaders、64×64 touch texture 与默认参数。`?baseline=1` 保留示例图并允许轻触切换 5 张原样样本。

## Product Composition

头像以正方形裁切占画面中部，黑底粒子保持主体唯一。HUD 放在访客壳下方安全区；12 格进度用细线短格显示。底部文案和重置不覆盖下巴区域。

## Personalization

图像回退顺序：

1. `?avatar_url=` 调试覆盖；
2. Aigram 当前玩家资料 `data.head_url`；
3. 用户指定的黑白塑封 `U` 默认头像。

资料接口固定为 `/note/telegram/user/get/info/by/telegram_id?telegram_id=…`。
平台头像缺失、CORS 不可读或像素读取失败时必须明确回退；不得继续用原样图伪装个性化。`?baseline=1` 是唯一使用原示例图的默认入口。头像方向由浏览器解码后按 center-cover 绘入 180×180，保持 RGB 色彩空间与正向显示。

## System

- 色彩：黑 `#050505`、灰白粒子、进度电蓝 `#8FD8FF`。
- 字体：系统 grotesk / CJK fallback，HUD 等宽小字。
- 控件：Pointer Events，画布 `touch-action:none`，重置至少 44px。
- 动效：只使用原 shader 噪声、触摸波、参数插值与 160–220ms HUD 反馈。
- 图标：不用 emoji；本作没有功能图标。

## Anti-patterns

不把头像只放 HUD；不继续用原示例图驱动产品粒子；不使用 CSS pixelation、Canvas 点阵近似、倒计时、分数、照片背景或玻璃卡片。

## Acceptance

390×844 与 320×568 必须覆盖：基线示例、调试头像覆盖、默认头像回退、9/12 完成态；确认头像不倒置、不拉伸、不溢出，粒子触摸波和重置可达。

