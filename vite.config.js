import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  base: "./",
  server: {
    watch: {
      ignored: ["**/_chrome/**", "**/_cdp.mjs", "**/_preview.log"],
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "three-vendor", test: /node_modules[\\/]three[\\/]/, maxSize: 450 * 1024, priority: 20 },
            { name: "vue-vendor", test: /node_modules[\\/](vue|@vue)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
