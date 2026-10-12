<template>
  <div class="a-show-grid"><slot /></div>
</template>

<style scoped>
/* The responsive poster grid used by the Library, Search and Person pages. */
.a-show-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
  gap: var(--grid-gap);
}
@media (max-width: 759px) {
  .a-show-grid {
    grid-template-columns: repeat(auto-fill, minmax(var(--card-min-mobile), 1fr));
    gap: var(--grid-gap-mobile);
  }
}
</style>
