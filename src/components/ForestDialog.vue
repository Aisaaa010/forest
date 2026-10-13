<script setup>
import { ref, watch, onMounted } from "vue";
import ForestIcon from "./ForestIcon.vue";

const model = defineModel({ type: Boolean, default: false });
const props = defineProps({ closeLabel: { type: String, default: "关闭" } });
const emit = defineEmits(["close"]);
const element = ref(null);
const synchronize = () => {
  if (!element.value) return;
  if (model.value && !element.value.open) element.value.showModal();
  else if (!model.value && element.value.open) element.value.close();
};
watch(model, synchronize, { flush: "post" });
onMounted(synchronize);
function handleClose() {
  model.value = false;
  emit("close");
}
function handleBackdrop(event) {
  if (event.target !== element.value) return;
  const rect = element.value.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    model.value = false;
}
</script>

<template>
  <dialog ref="element" @close="handleClose" @click="handleBackdrop">
    <button
      class="dialog-close"
      :aria-label="props.closeLabel"
      @click="model = false"
    >
      <ForestIcon name="close" />
    </button>
    <slot />
  </dialog>
</template>
