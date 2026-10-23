import { ref } from "vue";
import { scenes, phaseNames, weatherNames } from "../data/forest";

export function usePostcard(imageRef, state, notify) {
  const saving = ref(false);
  async function downloadPostcard() {
    const image = imageRef.value;
    if (!image.width || !image.height) {
      notify("3D 风景还在准备，请稍后再试。");
      return;
    }
    saving.value = true;
    try {
      const card = document.createElement("canvas");
      card.width = 1600;
      card.height = 1100;
      const ctx = card.getContext("2d");
      ctx.fillStyle = "#f5f6ef";
      ctx.fillRect(0, 0, 1600, 1100);
      const skyPalette = {
        morning: ["#b5c9b2", "#577565"],
        rain: ["#8da5a5", "#425f64"],
        snow: ["#c8d8db", "#607d8b"],
        night: ["#344f59", "#172e35"],
      }[state.scene] || ["#9eb4a4", "#425d4e"];
      const sky = ctx.createLinearGradient(0, 40, 0, 915);
      sky.addColorStop(0, skyPalette[0]);
      sky.addColorStop(1, skyPalette[1]);
      ctx.fillStyle = sky;
      ctx.fillRect(40, 40, 1520, 875);
      const targetRatio = 1520 / 875;
      const ratio = image.width / image.height;
      const cropWidth =
        ratio > targetRatio
          ? image.height * targetRatio
          : image.width;
      const cropHeight =
        ratio > targetRatio
          ? image.height
          : image.width / targetRatio;
      ctx.drawImage(
        image,
        (image.width - cropWidth) / 2,
        (image.height - cropHeight) / 2,
        cropWidth,
        cropHeight,
        40,
        40,
        1520,
        875,
      );
      ctx.filter = "none";
      const shade = ctx.createLinearGradient(0, 700, 0, 915);
      shade.addColorStop(0, "transparent");
      shade.addColorStop(1, "#102219a8");
      ctx.fillStyle = shade;
      ctx.fillRect(40, 40, 1520, 875);
      ctx.fillStyle = "#f6f7eb";
      ctx.font = '46px "Noto Serif SC", SimSun, serif';
      ctx.fillText(scenes[state.scene].title, 100, 835);
      ctx.fillStyle = "#61734f";
      ctx.font = '32px "Noto Serif SC", SimSun, serif';
      ctx.fillText("森间 · 不用抵达哪里。在这里，就很好。", 60, 995);
      ctx.fillStyle = "#939f86";
      ctx.font = "19px sans-serif";
      ctx.fillText(
        `${phaseNames[state.phase]} / ${weatherNames[state.weather]}     ${new Date().toLocaleDateString("zh-CN")}`,
        62,
        1045,
      );
      const blob = await new Promise((resolve) =>
        card.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("No image");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `森间-${scenes[state.scene].title}.png`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      notify("森林明信片已准备好下载。");
    } catch {
      notify("明信片未能生成，请稍后再试。");
    } finally {
      saving.value = false;
    }
  }
  return { saving, downloadPostcard };
}
