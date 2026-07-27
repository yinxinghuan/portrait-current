# 技术文档

## 1. 技术栈

- Vite 6 + TypeScript。
- Three.js 0.98.0，与上游一致。
- GLSL / glslify：机械展开原 vertex shader 的 simplex 模块。
- Canvas 2D：只为可读图生成 64×64 touch texture 和头像预处理。
- DOM/CSS 高密度随机点阵蒙版：显示不能由 Canvas/WebGL 读回的真实平台 R2 头像。
- 原生 Pointer Events + Raycaster / 矩形 UV 映射。

## 2. 目录结构

- `src/main.ts`：身份回退、头像裁切、实例几何、raycast、覆盖状态和主循环。
- `src/TouchTexture.ts`：原 64×64 触摸轨迹的 TypeScript 移植。
- `src/shaders/`：固定上游 shaders 与机械编译产物。
- `public/baseline/`：只供 `?baseline=1` 使用的 5 张上游示例。
- `public/alteru-default-avatar.jpg`：用户指定的黑白塑封 U 回退头像。
- `public/THIRD_PARTY_NOTICES.txt`：上游条款、Three 与 WebGL Noise notices。
- `_qa/capture.mjs`：默认头像、调试头像、基线、平台桥 + 无 CORS 头像和双尺寸完成态。

## 3. 核心模块

身份解析顺序为 `?avatar_url=` → canonical Aigram 资料接口的 `data.head_url`
→ AlterU 默认头像。资料成功与像素可读性分开判断。平台 R2 头像不设置
`crossOrigin=anonymous`：浏览器成功显示后，用同一 URL 只构建一张连续 CSS
背景；另一个不接触照片的 720×720 内存画布生成 180×180 随机圆粒 alpha
蒙版，再应用灰度、温和对比和曝光提升。该路径既不污染 Canvas，也避免 32×32
碎片造成的大马赛克、照片重复和分区接缝，让彩色生活照回到原作的单色粒子语法。仅当真实头像 URL 无法加载时才使用
默认头像。CORS 可读的调试图和本地图按 center-cover 解码到 180×180，
基线保持 320×180 原尺寸；CPU 复制上游的 Y 翻转暗像素剔除，GPU texture
保持 Three 默认 flipY。

每个可见像素对应一个 instanced quad，shader 根据纹理灰度、随机数、simplex
noise、深度和 64×64 touch texture 计算位置与尺寸。迁移时发现现代 glslify
会把导出函数命名为 `snoise`，而上游源码调用旧生成名 `snoise_1_2`；源调用改为
声明的 alias `snoise2`，编译后算法文本与 MIT 模块一致。

产品适配使用横纵 FOV 的最小值让正方头像完整进入竖屏；基线仍按原作以高度
铺满。12 格中触达 9 格后把 `uRandom` 从 2 收束到 0.35、`uDepth` 从 4
收束到 1.5。平台蒙版由 CSS `background-size:cover` 保持正向裁切，覆盖进度
让整张点阵肖像从 1.018 倍、84% 不透明度连续收束到 1 倍、100%；重复触摸显示电流环。

## 4. 扩展点

- 改粒子算法：编辑 `src/shaders/particle.vert|frag`，build 会重编 vertex。
- 改头像裁切/尺寸：编辑 `prepareImage()`、`createParticleMask()` 与 `.portrait-mask`。
- 改完成规则：编辑 `renderCoverage()` 的 9 格阈值。
- 改触摸波：编辑 `src/TouchTexture.ts` 的 size、maxAge、radius。
- 接入新身份源：只修改 `resolveProductImage()`，保持既定回退顺序与失败检测。

## 5. 启动交接

`index.html` 的内联点阵桥先于模块和头像请求绘制。WebGL 路径在 `particleMesh` 已存在且 `renderer.render()` 完成后交接；平台路径在真实头像加载、连续点阵蒙版挂载并完成一个动画帧后交接。两者都设置 `body[data-visual-ready=true]`，再移除启动桥。
