<script setup lang="ts">
defineProps<{
  title: string;
  eyebrow?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <aside class="context-panel">
    <header class="context-panel-header">
      <div>
        <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
        <h2>{{ title }}</h2>
      </div>
      <button class="icon-button" type="button" aria-label="关闭" @click="emit('close')">×</button>
    </header>
    <div class="context-panel-body">
      <slot />
    </div>
  </aside>
</template>
