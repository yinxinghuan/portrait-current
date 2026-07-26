# 海报制作溯源

- 制作接口：Aigram transit `POST https://chat.aiwaves.tech/aigram/api/gen-image`
- 请求 Origin：`https://aigram.app`
- 初次生成：`https://cdn.aiwaves.tech/prod/telegram/avatar/0/1785069318353511.webp`
- 清理重绘：以初次生成图为 `ref_url`，移除伪 UI、按钮、数字和杂字
- 最终源图：`https://cdn.aiwaves.tech/prod/telegram/avatar/0/1785069563464383.webp`
- 本地交付：`public/poster.png`，1024×1024 PNG
- 缩略图检查：160×160 下仍可辨识人物、粒子流与标题

最终图由平台生成的栅格图直接转换为 PNG；不是 SVG、Canvas、CSS 图形或游戏截图。
