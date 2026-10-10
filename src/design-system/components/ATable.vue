<script setup lang="ts">
export interface TableColumn {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  width?: string
}
withDefaults(defineProps<{ columns: TableColumn[]; rows: Record<string, unknown>[]; rowKey?: string; loading?: boolean; emptyText?: string }>(), {
  rowKey: 'id',
  loading: false,
  emptyText: 'Nothing to show.',
})
</script>

<template>
  <div class="a-table-wrap">
    <table class="a-table">
      <thead>
        <tr>
          <th v-for="c in columns" :key="c.key" :style="{ textAlign: c.align ?? 'left', width: c.width }">{{ c.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading" class="a-table__state"><td :colspan="columns.length">Loading…</td></tr>
        <tr v-else-if="!rows.length" class="a-table__state"><td :colspan="columns.length">{{ emptyText }}</td></tr>
        <tr v-for="row in rows" v-else :key="String(row[rowKey])">
          <td v-for="c in columns" :key="c.key" :style="{ textAlign: c.align ?? 'left' }">
            <slot :name="`cell-${c.key}`" :row="row" :value="row[c.key]">{{ row[c.key] ?? '—' }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.a-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  background: var(--surface);
}
.a-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.a-table th {
  font: 600 11px var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
.a-table td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--line);
  vertical-align: middle;
}
.a-table tbody tr:last-child td {
  border-bottom: 0;
}
.a-table tbody tr:hover td {
  background: var(--hover);
}
.a-table__state td {
  text-align: center;
  color: var(--muted);
  padding: 28px;
}
</style>
