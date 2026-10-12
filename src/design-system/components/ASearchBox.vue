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
  min-width: 0;
  align-items: center;
  gap: var(--space-2_5);
  background: var(--surface2);
  border-radius: var(--radius-md);
  padding: 0 12px;
  height: 38px;
  color: var(--muted);
  border: 1px solid transparent;
  transition: border-color var(--dur-fast) var(--ease);
}
.a-search:focus-within {
  border-color: var(--line2);
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}
.a-search--lg {
  height: 48px;
  border-radius: var(--radius-lg);
  padding: 0 14px;
}
.a-search__input {
  flex: 1;
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fg);
  font-size: var(--text-base);
}
.a-search--lg .a-search__input {
  font-size: var(--text-md);
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
  padding: var(--space-1);
  border-radius: var(--radius-xs);
}
.a-search__clear:hover {
  color: var(--fg);
}

/* iOS zooms into inputs smaller than 16px; keep phones at 16px. */
@media (max-width: 759px) {
  .a-search__input {
    font-size: var(--text-md);
  }
}
</style>
