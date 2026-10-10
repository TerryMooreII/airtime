<script setup lang="ts">
import AIcon from './AIcon.vue'

withDefaults(defineProps<{ placeholder?: string; size?: 'md' | 'lg'; autofocus?: boolean }>(), {
  placeholder: 'Search',
  size: 'md',
  autofocus: false,
})
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ focus: []; submit: [] }>()
</script>

<template>
  <label class="a-search" :class="`a-search--${size}`">
    <AIcon name="search" :size="size === 'lg' ? 18 : 16" :stroke-width="2" />
    <input
      v-model="model"
      type="search"
      class="a-search__input"
      :placeholder="placeholder"
      :autofocus="autofocus"
      autocomplete="off"
      spellcheck="false"
      @focus="emit('focus')"
      @keydown.enter="emit('submit')"
    />
    <button
      v-if="model"
      type="button"
      class="a-search__clear"
      aria-label="Clear search"
      @click="model = ''"
    >
      <AIcon name="close" :size="14" />
    </button>
  </label>
</template>

<style scoped>
.a-search {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface2);
  border-radius: var(--radius-md);
  padding: 0 12px;
  height: 38px;
  color: var(--muted);
  border: 1px solid transparent;
  transition: border-color var(--dur-fast);
}
.a-search:focus-within {
  border-color: var(--line2);
}
.a-search--lg {
  height: 48px;
  border-radius: var(--radius-lg);
  padding: 0 14px;
}
.a-search__input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fg);
  font-size: 14px;
}
.a-search--lg .a-search__input {
  font-size: 16px;
}
.a-search__input::placeholder {
  color: var(--muted);
}
.a-search__input::-webkit-search-cancel-button {
  display: none;
}
.a-search__clear {
  border: 0;
  background: transparent;
  color: var(--muted);
  display: flex;
  padding: 4px;
  border-radius: var(--radius-xs);
}
.a-search__clear:hover {
  color: var(--fg);
}
</style>
