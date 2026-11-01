// Right answers in a row within one round, shown as a combo that grows, with
// a cheer at 3, 5 and 8. A slip resets it; the best run is shown at the end.
const CHEERS: Record<number, string> = { 3: 'Nice!', 5: 'On fire!', 8: 'Unstoppable!' }

export function useCombo() {
  const combo = ref(0)
  const best = ref(0)
  const cheer = computed(() => {
    const milestones = Object.keys(CHEERS).map(Number).filter(n => combo.value >= n)
    return milestones.length ? CHEERS[Math.max(...milestones)] : undefined
  })

  function hit() {
    combo.value++
    best.value = Math.max(best.value, combo.value)
    if (CHEERS[combo.value]) haptic('success')
  }

  function miss() {
    combo.value = 0
  }

  return { combo, best, cheer, hit, miss }
}
