// How good a set of predictions is, on answers the model did not learn from.

const clamp = (p: number) => Math.min(1 - 1e-7, Math.max(1e-7, p))

// Average log loss (lower is better); labels may be fractional (0.6 = nearly right).
export function logLoss(p: readonly number[], y: readonly number[]): number {
  if (p.length === 0) return 0
  let sum = 0
  for (let i = 0; i < p.length; i++) sum -= y[i]! * Math.log(clamp(p[i]!)) + (1 - y[i]!) * Math.log(1 - clamp(p[i]!))
  return sum / p.length
}

// Share of answers whose right or wrong was called correctly (labels ≥ 0.5 count as right).
export function accuracy(p: readonly number[], y: readonly number[]): number {
  if (p.length === 0) return 0
  let hits = 0
  for (let i = 0; i < p.length; i++) if ((p[i]! >= 0.5) === (y[i]! >= 0.5)) hits++
  return hits / p.length
}

// Area under the ROC curve: the chance a right answer was given a higher
// prediction than a wrong one (0.5 = guessing, 1 = perfect). Computed from
// average ranks (Mann–Whitney), so tied predictions count half.
export function auc(p: readonly number[], y: readonly number[]): number {
  const order = p.map((value, i) => ({ value, right: y[i]! >= 0.5 })).sort((a, b) => a.value - b.value)
  const rights = order.filter(o => o.right).length
  const wrongs = order.length - rights
  if (!rights || !wrongs) return 0.5
  let rankSum = 0
  for (let i = 0; i < order.length;) {
    let j = i
    while (j < order.length && order[j]!.value === order[i]!.value) j++
    const averageRank = (i + 1 + j) / 2
    for (let k = i; k < j; k++) if (order[k]!.right) rankSum += averageRank
    i = j
  }
  return (rankSum - rights * (rights + 1) / 2) / (rights * wrongs)
}
