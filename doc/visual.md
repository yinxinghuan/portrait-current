# Visual Direction

## Thesis

手指不是在擦拭照片，而是在一股像素电流中重新发现自己的脸。

## Original Baseline

固定 revision `efe300f9cd2b976da377ed43e9f50662fb575bf7`：Three.js 0.98、320×180 示例图、CPU 暗像素剔除、InstancedBufferGeometry、原 particle shaders、64×64 touch texture 与默认参数。`?baseline=1` 保留示例图并允许轻触切换 5 张原样样本。

## Product Composition

头像以正方形 center-cover 裁切占画面中部，黑底粒子或连续动态点阵保持主体唯一。HUD 放在访客壳下方安全区；12 格进度用细线短格显示。底部文案和重置不覆盖下巴区域。

## Personalization

图像回退顺序：

1. `?avatar_url=` 调试覆盖；
2. Aigram 当前玩家资料 `data.head_url`；
3. 用户指定的黑白塑封 `U` 默认头像。

资料接口固定为 `/note/telegram/user/get/info/by/telegram_id?telegram_id=…`。
平台头像缺失或图片本身加载失败时才明确回退。平台 R2 头像能显示但没有 CORS 像素读取权限时，必须保留真实用户头像并切换到不读取照片像素的高密度动态 Canvas 路径：照片只绘制一次并允许画布 taint；180×180 随机圆粒保持分离，36×36 局部位移网格随手指推开、旋转、回弹。不得降采样为大圆点马赛克、按区域重复照片、留下拼接缝，或只把照片静态换成点阵图；灰度、温和对比和高曝光恢复原作白点承载肖像的语法。`?baseline=1` 是唯一使用原示例图的默认入口。两种渲染路径都按 center-cover 保持正向和比例。

## System

- 色彩：黑 `#050505`、灰白粒子、进度电蓝 `#8FD8FF`。
- 字体：系统 grotesk / CJK fallback，HUD 等宽小字。
- 控件：Pointer Events，画布 `touch-action:none`，重置至少 44px。
- 动效：可读图使用原 shader 噪声与触摸波；平台图使用 180×180 随机圆粒、36×36 局部推力网格、径向外推、轻微切向涡流、弹簧回位、整体尺度/曝光收束和 520ms 电流环；HUD 反馈 160–260ms。
- 图标：不用 emoji；本作没有功能图标。

## Anti-patterns

不把头像只放 HUD；不继续用原示例图驱动产品效果；不在已取得真实头像后因 CORS 换成缺省图；不使用默认图叠底伪装个性化、倒计时、分数、照片背景或玻璃卡片。

## Acceptance

390×844 与 320×568 必须覆盖：基线示例、调试头像覆盖、默认头像回退、平台桥 + 无 CORS 彩色玩家照片、触摸前、局部位移峰值、回弹后和 9/12 完成态；断言身份来源仍为 `player`，头像区域的触摸前后像素帧必须不同，240ms 内至少绘制 6 个动态帧，并检查位移峰值、回弹比例、方向、裁切、溢出和重置。

## Startup Continuity

头像接口、图像解码和粒子/动态 Canvas 构建期间显示黑底采样点阵，不露出空 canvas。只有产品头像或明确回退头像已产生可见首帧后才交给正式画面；错误文案仍在原加载层展示。
