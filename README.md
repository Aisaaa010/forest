# 森间 · Forest & Stillness

一个纯前端的森林风景观察与放松空间。使用 HTML、CSS、JavaScript、Canvas 和 Web Audio API，无运行时依赖、无后端。

## 启动

```sh
npm run dev
```

打开 http://127.0.0.1:5173 。也可以直接打开 `index.html`；推荐通过本地服务器体验图片下载与浏览器存储。

```sh
npm run check
npm run build
```

`dist/` 可以放在任何静态网站托管服务。

## 功能

- 三种森林氛围：晨雾松林、雨落青苔、萤火之境。共享一张森林艺术背景，通过取景、调色和粒子呈现不同心情。
- 晨光、午后、夜晚与晴朗、薄雾、小雨自由组合。
- 浏览器实时合成微风、鸟鸣、溪流和雨声，每个声部独立调节。
- 沉浸观察、风景明信片 PNG 下载、拾光收藏和场景重访。
- 1 / 3 / 5 分钟呼吸练习：4 秒吸气，6 秒呼气，可随时结束。
- 移动端布局、键盘操作、减少动态效果偏好。

收藏只存储在当前浏览器的 localStorage。自然声音为合成音效，景色为艺术场景；Google Fonts 为可选字体加载，离线时使用系统字体。

## 文件

- `index.html`：页面、语义结构、弹窗和 SVG 图标。
- `styles.css`：响应式样式与氛围动画。
- `app.js`：场景、声音、粒子、呼吸、收藏和明信片。
- `assets/forest.png`：项目内森林图片。
- `scripts/serve.mjs`：本地开发服务器，不属于网站运行时。
- `scripts/build.mjs`：生成静态站点。

## 图片来源

森林主视觉由内置 ImageGen 工具生成，提示词保存在 `assets/image-prompt.txt`。
