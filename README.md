# 森间 · Forest & Stillness

使用 Vue 3 Composition API、`<script setup>` 单文件组件和 Vite 构建的纯前端森林放松空间。无后端，收藏数据保存在当前浏览器。

## 启动与构建

```sh
npm install
npm run dev
```

开发地址：http://127.0.0.1:5173 。Vue 单文件组件需要通过开发服务器运行。

```sh
npm run check
npm run build
npm run preview
```

`check` 检查 Vue 组件与 JavaScript 语法；`build` 输出静态网站至 `dist/`；`preview` 在 http://127.0.0.1:4173 预览生产构建。

## 功能

- 晨雾松林、雨落青苔、萤火之境三种艺术氛围，共享森林图片并通过取景、调色和粒子呈现不同心情。
- 晨光 / 午后 / 夜晚及晴朗 / 薄雾 / 小雨自由组合。
- 浏览器合成微风、鸟鸣、溪流和雨声，各声部独立调整。
- 沉浸观察、PNG 明信片下载、拾光收藏及重访。
- 1 / 3 / 5 分钟呼吸练习，可随时结束。
- 手机适配、键盘操作及减少动态效果偏好。

## 项目结构

```text
src/
  App.vue                     页面与响应式状态
  main.js                     Vue 应用入口
  styles.css                  森林主题与响应式样式
  assets/                     森林图片及生成提示词
  components/
    ForestDialog.vue          v-model 控制的原生对话框
    ForestIcon.vue            可复用 SVG 图标
    IconSprite.vue            图标符号集
  composables/
    useForestAudio.js         Web Audio 合成与资源释放
    useNatureCanvas.js        雨滴 / 萤火 / 光点与生命周期
    useMomentJournal.js       收藏响应式状态与本地持久化
    useBreathing.js           呼吸节奏和计时器
    usePostcard.js            明信片生成与下载
  data/
    forest.js                 场景、天气和声音配置
public/favicon.svg
scripts/check.mjs
vite.config.js
```

界面使用 `v-for`、`v-if`、`v-model`、`@click`、`:class`、`:style` 等 Vue 模板语法；状态通过 `ref`、`reactive`、`computed` 和 `watch` 管理。Canvas、Web Audio 和下载操作使用原生浏览器 API，资源通过 Vue 生命周期清理。

森林图片由内置 ImageGen 工具生成，提示词见 `src/assets/image-prompt.txt`。Google Fonts 是可选字体请求，离线时回退到系统字体。音频为合成环境声，收藏只存储在 localStorage。
