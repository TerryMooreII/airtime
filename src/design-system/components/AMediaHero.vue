<script setup lang="ts">
/**
 * Hero banner with the artwork blurred behind it: a poster (or photo) on the left, kicker,
 * title and meta on the right, and whatever the page adds below (ratings, actions).
 */
withDefaults(
  defineProps<{
    title: string
    /** Image blurred behind the banner. */
    backdrop?: string | null
    kicker?: string
    meta?: string
    /** Title size: xl for shows, lg for people, md for picks. */
    size?: 'xl' | 'lg' | 'md'
    titleTag?: 'h1' | 'h2'
    /** Desktop / mobile width of the media column. */
    mediaWidth?: number
    mediaWidthMobile?: number
    align?: 'end' | 'center'
  }>(),
  { size: 'lg', titleTag: 'h1', mediaWidth: 180, mediaWidthMobile: 120, align: 'end' },
)
</script>

<template>
  <section
    class="a-hero"
    :class="[`a-hero--${size}`, `a-hero--${align}`]"
    :style="{ '--hero-media': `${mediaWidth}px`, '--hero-media-mobile': `${mediaWidthMobile}px` }"
  >
    <img v-if="backdrop" :src="backdrop" alt="" class="a-hero__bg" />
    <div class="a-hero__inner">
      <div v-if="$slots.media" class="a-hero__media"><slot name="media" /></div>
      <div class="a-hero__text">
        <slot name="above" />
        <span v-if="kicker" class="t-label a-hero__kicker">{{ kicker }}</span>
        <component :is="titleTag" class="a-hero__title">{{ title }}</component>
        <div v-if="meta" class="a-hero__meta">{{ meta }}</div>
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
.a-hero {
  position: relative;
  border-radius: var(--radius-3xl);
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line);
}
.a-hero__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(56px) saturate(1.5);
  opacity: 0.4;
  transform: scale(1.3);
}
.a-hero__inner {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  padding: 32px;
  align-items: flex-end;
}
.a-hero--center .a-hero__inner {
  align-items: center;
}
.a-hero__media {
  width: var(--hero-media);
  flex: none;
  box-shadow: var(--shadow-poster);
  border-radius: var(--radius-lg);
}
.a-hero__text {
  flex: 1 1 300px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.a-hero__kicker {
  color: var(--primary-text);
}
.a-hero__title {
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 0.98;
  text-wrap: balance;
}
.a-hero--xl .a-hero__title {
  font-size: 56px;
}
.a-hero--lg .a-hero__title {
  font-size: 48px;
}
.a-hero--md .a-hero__title {
  font-size: var(--text-hero);
  letter-spacing: -0.035em;
  line-height: 1;
}
.a-hero__meta {
  font: 500 13px var(--font-mono);
  color: var(--muted);
}
@media (max-width: 759px) {
  .a-hero__inner {
    padding: 20px;
  }
  .a-hero__media {
    width: var(--hero-media-mobile);
  }
  .a-hero--xl .a-hero__title {
    font-size: 34px;
  }
  .a-hero--lg .a-hero__title {
    font-size: 32px;
  }
  .a-hero--md .a-hero__title {
    font-size: var(--text-hero-mobile);
  }
}
</style>
