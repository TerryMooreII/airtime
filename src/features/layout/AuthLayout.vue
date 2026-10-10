<script setup lang="ts">
import { ALogo } from '@/design-system'
import { useTheme } from '@/composables/useTheme'

useTheme()
</script>

<template>
  <div class="auth">
    <div class="auth__panel">
      <ALogo class="auth__logo" />
      <div class="auth__card"><slot /></div>
      <p class="auth__foot">
        Show and episode data from
        <a href="https://www.tvmaze.com" target="_blank" rel="noopener">TVmaze</a> (CC BY-SA).
      </p>
    </div>
    <div class="auth__art" aria-hidden="true">
      <div class="auth__glow" />
      <div class="auth__tag">
        <span class="t-label auth__tagline">Never miss an episode</span>
        <span class="auth__h">Your shows, rated and on schedule.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  background: var(--bg);
}
.auth__panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  padding: 40px 32px;
  max-width: 480px;
  width: 100%;
  margin: 0 auto;
}
.auth__logo {
  align-self: flex-start;
}
.auth__card {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.auth__foot {
  font-size: 12.5px;
  color: var(--muted);
}
.auth__art {
  position: relative;
  overflow: hidden;
  background: var(--surface);
  border-left: 1px solid var(--line);
  display: flex;
  align-items: flex-end;
  padding: 48px;
}
.auth__glow {
  position: absolute;
  inset: -20%;
  background:
    radial-gradient(40% 40% at 70% 30%, var(--primary-soft), transparent 70%),
    radial-gradient(35% 35% at 20% 80%, var(--primary-soft), transparent 70%);
  filter: blur(40px);
}
.auth__tag {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 420px;
}
.auth__tagline {
  color: var(--primary-text);
}
.auth__h {
  font-size: 40px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.02;
  text-wrap: balance;
}
@media (max-width: 899px) {
  .auth {
    grid-template-columns: minmax(0, 1fr);
  }
  .auth__art {
    display: none;
  }
}
</style>
