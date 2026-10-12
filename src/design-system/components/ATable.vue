<script setup lang="ts" generic="T extends object">
export interface TableColumn {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  width?: string
}

/**
 * Typed table: `rows` keeps its element type, so `#cell-*` slots receive a typed `row`
 * (no casts in the consumer). `value` is the column's raw field for the simple cases.
 */
const props = withDefaults(
  defineProps<{
    columns: TableColumn[]
    rows: T[]
    /** Field used as the row key; defaults to `id`. */
    rowKey?: keyof T & string
    loading?: boolean
    emptyText?: string
  }>(),
  { loading: false, emptyText: 'Nothing to show.' },
)
defineSlots<{ [name: `cell-${string}`]: (props: { row: T; value: unknown }) => unknown }>()

const field = (row: T, key: string) => (row as Record<string, unknown>)[key]
const keyOf = (row: T) => String(field(row, props.rowKey ?? 'id'))
</script>

<template>
  <div class="a-table-wrap">
    <table class="a-table">
      <thead>
        <tr>
          <th
            v-for="c in columns"
            :key="c.key"
            :style="{ textAlign: c.align ?? 'left', width: c.width }"
          >
            {{ c.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading" class="a-table__state">
          <td :colspan="columns.length">Loading…</td>
        </tr>
        <tr v-else-if="!rows.length" class="a-table__state">
          <td :colspan="columns.length">{{ emptyText }}</td>
        </tr>
        <tr v-for="row in rows" v-else :key="keyOf(row)">
          <td v-for="c in columns" :key="c.key" :style="{ textAlign: c.align ?? 'left' }">
            <slot :name="`cell-${c.key}`" :row="row" :value="field(row, c.key)">{{
              field(row, c.key) ?? '—'
            }}</slot>
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
  font-size: var(--text-sm);
}
.a-table th {
  font: 600 var(--text-2xs) var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  padding: var(--space-3) var(--space-3_5);
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
  padding: var(--space-7);
}
</style>
