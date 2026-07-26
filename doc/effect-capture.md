# Effect Capture — 图像实例粒子与离屏触摸场

## 机制

CPU 读取图像像素，剔除暗背景后为每个可见像素生成一个 instanced quad，
offset 对应像素坐标。vertex shader 重采样原图，加入确定性随机、simplex
深度噪声，并读取 64×64 动态触摸纹理做局部 X/Y/Z 推力；fragment shader
按原图灰度绘制圆形粒子。

## 最小接口

- 输入：可读图像、`uRandom/uDepth/uSize`、64×64 触摸纹理。
- 几何：InstancedBufferGeometry 的 `pindex/offset/angle`。
- 交互：相机 raycast → 图像平面 UV → TouchTexture trail。
- 生命周期：异步图像失败回退、resize、DPR 上限、隐藏页暂停。

## 性能

基线最多 320×180=57,600 实例；产品 180×180=32,400 实例，且暗像素继续
剔除。两档手机均验证。低档优先把产品输入降到 144×144 或 DPR 1，不得换成
CSS pixelation、静态点阵图或 Canvas 粒子近似。

## 许可证与隐私边界

源自 Bruno Imbrizi / Codrops，fixed revision
`efe300f9cd2b976da377ed43e9f50662fb575bf7`；允许集成/build upon，
禁止 as-is 再发布或插件化出售。Three 和 Ashima/Stefan MIT notice 必须随包。
技能不得缓存、上传或跨会话保存玩家头像；图像只在当前浏览器内存中处理。

## 技能化结论

已在 Portrait Current 中完成源码级还原、头像个性化、跨域失败回退、真实触摸
闭环和两档验证。可晋升 `interactive-image-particle-field`，只封装实例几何、
shader、touch texture、图像合同、性能分档和许可/隐私边界，不携带覆盖玩法、
HUD、基线样图或品牌。

