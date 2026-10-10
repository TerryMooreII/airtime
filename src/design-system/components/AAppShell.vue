<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import AIcon from './AIcon.vue'
import ALogo from './ALogo.vue'
import type { IconName } from '../icons'

export interface NavItem {
  id: string
  label: string
  icon: IconName
  to: RouteLocationRaw
  badge?: number
  /** On phones: a bottom tab (default) or an icon button in the header. */
  mobile?: 'tab' | 'header'
}

/**
 * Application frame from the mock: 236px sidebar with nav + "Airing soon" rail on
 * desktop, header with search, and a 5-item bottom nav on mobile.
 */
defineProps<{
  nav: NavItem[]
  activeId: string
  themeLabel: string
  themeIcon: IconName
}>()
const emit = defineEmits<{ toggleTheme: [] }>()
</script>

<template>
  <div class="a-shell">
    <aside class="a-shell__sidebar">
      <RouterLink :to="{ name: 'home' }" class="a-shell__brand"><ALogo /></RouterLink>
      <nav class="a-shell__nav" aria-label="Primary">
        <RouterLink
          v-for="n in nav"
          :key="n.id"
          :to="n.to"
          class="a-shell__navitem"
          :class="{ 'a-shell__navitem--on': n.id === activeId }"
        >
          <AIcon :name="n.icon" :size="19" />
          <span class="a-shell__navlabel">{{ n.label }}</span>
          <span v-if="n.badge" class="a-shell__navbadge">{{ n.badge > 99 ? '99+' : n.badge }}</span>
        </RouterLink>
      </nav>
      <div v-if="$slots.rail" class="a-shell__rail"><slot name="rail" /></div>
      <div class="a-shell__spacer" />
      <button type="button" class="a-shell__theme" @click="emit('toggleTheme')">
        <AIcon :name="themeIcon" :size="17" />{{ themeLabel }}
      </button>
    </aside>

    <div class="a-shell__body">
      <header class="a-shell__header">
        <RouterLink :to="{ name: 'home' }" class="a-shell__brand a-shell__brand--mobile"
          ><ALogo
        /></RouterLink>
        <div class="a-shell__search"><slot name="search" /></div>
        <div class="a-shell__spacer" />
        <RouterLink
          v-for="n in nav.filter((i) => i.mobile === 'header')"
          :key="n.id"
          :to="n.to"
          class="a-shell__headicon"
          :class="{ 'a-shell__headicon--on': n.id === activeId }"
          :aria-label="n.label"
        >
          <AIcon :name="n.icon" :size="18" />
          <span v-if="n.badge" class="a-shell__dot" />
        </RouterLink>
        <slot name="actions" />
        <button
          type="button"
          class="a-shell__theme a-shell__theme--icon"
          :aria-label="themeLabel"
          @click="emit('toggleTheme')"
        >
          <AIcon :name="themeIcon" :size="18" />
        </button>
      </header>
      <main class="a-shell__main">
        <div class="a-shell__page"><slot /></div>
      </main>
      <nav class="a-shell__bottom" aria-label="Primary">
        <RouterLink
          v-for="n in nav.filter((i) => i.mobile !== 'header')"
          :key="n.id"
          :to="n.to"
          class="a-shell__bottomitem"
          :class="{ 'a-shell__bottomitem--on': n.id === activeId }"
        >
          <span class="a-shell__bottomicon">
            <AIcon :name="n.icon" :size="22" />
            <span v-if="n.badge" class="a-shell__dot" />
          </span>
          {{ n.label }}
        </RouterLink>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.a-shell {
  display: flex;
  align-items: flex-start;
  min-height: 100vh;
  background: var(--bg);
}
.a-shell__sidebar {
  width: var(--sidebar-w);
  flex: none;
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  padding: 22px 14px 16px;
  gap: 28px;
  overflow: auto;
  /* Pinned to the viewport while the page scrolls. */
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100dvh;
  align-self: flex-start;
}
.a-shell__brand {
  display: flex;
  align-items: center;
  padding: 2px 10px;
  color: var(--fg);
}
.a-shell__brand--mobile {
  display: none;
  padding: 0;
}
.a-shell__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.a-shell__navitem {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14.5px;
  font-weight: 500;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  color: var(--muted);
  transition:
    background var(--dur-fast),
    color var(--dur-fast);
}
.a-shell__navitem:hover {
  color: var(--fg);
}
.a-shell__navitem--on {
  background: var(--primary-soft);
  color: var(--primary-text);
  font-weight: 600;
}
.a-shell__navlabel {
  flex: 1;
}
.a-shell__navbadge {
  font: 600 11px var(--font-mono);
  background: var(--primary);
  color: var(--on-primary);
  padding: 2px 6px;
  border-radius: 999px;
  min-width: 20px;
  text-align: center;
}
.a-shell__rail {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.a-shell__spacer {
  flex: 1;
}
.a-shell__theme {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--line);
  font-size: 13.5px;
  font-weight: 500;
  padding: 9px 12px;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--fg);
}
.a-shell__theme:hover {
  background: var(--hover);
}
.a-shell__theme--icon {
  display: none;
  width: 40px;
  height: 40px;
  padding: 0;
  justify-content: center;
  border-radius: var(--radius-lg);
}

.a-shell__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.a-shell__header {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: var(--head-pad);
  border-bottom: 1px solid var(--line);
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  background: var(--bg);
}
.a-shell__search {
  flex: 1;
  max-width: 440px;
  min-width: 0;
}
.a-shell__main {
  flex: 1;
  min-height: 0;
}
.a-shell__page {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--page-pad);
  animation: ad-fade-in var(--dur) var(--ease);
}
.a-shell__bottom {
  display: none;
}
.a-shell__headicon {
  display: none;
  position: relative;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  color: var(--fg);
}
.a-shell__headicon--on {
  background: var(--primary-soft);
  color: var(--primary-text);
  border-color: transparent;
}

@media (max-width: 759px) {
  .a-shell__sidebar {
    display: none;
  }
  .a-shell__brand--mobile {
    display: flex;
  }
  .a-shell__search {
    display: none;
  }
  .a-shell__theme--icon,
  .a-shell__headicon {
    display: flex;
  }
  .a-shell__header {
    padding: var(--head-pad-mobile);
  }
  .a-shell__page {
    padding: var(--page-pad-mobile);
  }
  .a-shell__body {
    padding-bottom: 72px;
  }
  .a-shell__bottom {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    border-top: 1px solid var(--line);
    background: var(--bg);
    padding: 6px 6px calc(10px + env(safe-area-inset-bottom));
    z-index: var(--z-header);
  }
  .a-shell__bottomitem {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-height: 52px;
    justify-content: center;
    color: var(--muted);
    font-size: 11px;
    font-weight: 500;
  }
  .a-shell__bottomitem--on {
    color: var(--primary-text);
    font-weight: 600;
  }
  .a-shell__bottomicon {
    position: relative;
    display: flex;
  }
  .a-shell__dot {
    position: absolute;
    top: -2px;
    right: -3px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--primary);
    border: 2px solid var(--bg);
  }
}
</style>
