import { computed, ref } from 'vue'

const MIN_LENGTH = 8

/** New password + confirmation with the validation messages shared by Register and Reset. */
export function usePasswordPair() {
  const password = ref('')
  const confirm = ref('')
  const passwordError = computed(() =>
    password.value && password.value.length < MIN_LENGTH
      ? `Use at least ${MIN_LENGTH} characters.`
      : null,
  )
  const confirmError = computed(() =>
    confirm.value && confirm.value !== password.value ? 'Passwords do not match.' : null,
  )
  const valid = computed(
    () => password.value.length >= MIN_LENGTH && !passwordError.value && !confirmError.value,
  )
  return {
    password,
    confirm,
    passwordError,
    confirmError,
    valid,
    hint: `At least ${MIN_LENGTH} characters.`,
  }
}
