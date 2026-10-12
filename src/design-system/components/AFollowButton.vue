<script setup lang="ts">
import AIcon from './AIcon.vue'

withDefaults(
  defineProps<{
    following: boolean
    /** "chip" = round overlay on a poster, "button" = full label button. */
    appearance?: 'chip' | 'button'
    size?: 'md' | 'lg'
    loading?: boolean
    /** Chip only: render in flow (not absolutely positioned on a poster). */
    inline?: boolean
    /** Chip only: 26px instead of 34px. */
    small?: boolean
    /** Chip only: a menu is open behind it, so the plus turns into an x. */
    open?: boolean
  }>(),
  { appearance: 'button', size: 'md', loading: false, inline: false, small: false, open: false },
)
const emit = defineEmits<{ toggle: [] }>()

function onClick(ev: Event) {
  ev.stopPropagation()
  ev.preventDefault()
  emit('toggle')
}
</script>

<template>
  <button
    v-if="appearance === 'chip'"
    type="button"
    class="a-follow-chip"
    :class="{
      'a-follow-chip--on': following,
      'a-follow-chip--inline': inline,
      'a-follow-chip--small': small,
      'a-follow-chip--open': open,
    }"
    :aria-label="following ? 'Unfollow' : open ? 'Close' : 'Follow'"
    :aria-pressed="following"
    :aria-expanded="following ? undefined : open || undefined"
    :disabled="loading"
    @click="onClick"
  >
    <AIcon
      :name="loading ? 'spinner' : following ? 'check' : 'plus'"
      :size="16"
      :stroke-width="2.4"
    />
  </button>
  <button
    v-else
    type="button"
    class="a-follow"
    :class="[`a-follow--${size}`, { 'a-follow--on': following }]"
    :aria-pressed="following"
    :disabled="loading"
    @click="onClick"
  >
    <AIcon
      :name="loading ? 'spinner' : following ? 'check' : 'plus'"
      :size="16"
      :stroke-width="2.4"
    />
    {{ following ? 'Following' : 'Follow' }}
  </button>
</template>

<style scoped>
.a-follow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--primary);
  background: var(--primary);
  color: var(--on-primary);
  font-size: 14px;
  font-weight: 600;
  transition:
    background var(--dur-fast),
    color var(--dur-fast),
    border-color var(--dur-fast);
}
.a-follow--lg {
  height: 44px;
  padding: 0 20px;
  border-radius: var(--radius-lg);
  font-size: 14.5px;
}
.a-follow--on {
  background: transparent;
  color: var(--fg);
  border-color: var(--line2);
}
.a-follow--on:hover {
  background: var(--hover);
}
.a-follow:disabled {
  opacity: 0.7;
}

.a-follow-chip {
  position: absolute;
  right: 8px;
  top: 8px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 0;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(6px);
  transition:
    background var(--dur-fast),
    transform var(--dur) var(--ease);
  z-index: 1;
}
.a-follow-chip:hover {
  transform: scale(1.06);
}
.a-follow-chip--on {
  background: var(--primary);
  color: var(--on-primary);
}
.a-follow-chip--open,
.a-follow-chip--open:hover {
  background: transparent;
  transform: rotate(135deg);
}
.a-follow-chip--inline {
  position: relative;
  flex: none;
}
.a-follow-chip:disabled {
  opacity: 0.7;
}
.a-follow-chip--small {
  width: 26px;
  height: 26px;
}
.a-follow-chip--small :deep(svg) {
  width: 13px;
  height: 13px;
}
</style>
