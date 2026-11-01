// The trained network run in plain JavaScript (no TensorFlow on the main
// thread): dense layers with ReLU between them and a sigmoid at the end, the
// same as the model trained in app/workers/mlTrain.ts.

export interface DenseWeights {
  // kernel[input][output], as TensorFlow.js stores a dense layer.
  kernel: number[][]
  bias: number[]
}

export interface NetWeights { layers: DenseWeights[] }

export function forward(net: NetWeights, x: readonly number[]): number {
  let values: readonly number[] = x
  net.layers.forEach((layer, index) => {
    const last = index === net.layers.length - 1
    const out = layer.bias.map((b, j) => values.reduce((sum, v, i) => sum + v * layer.kernel[i]![j]!, b))
    values = last ? out : out.map(v => Math.max(0, v))
  })
  return 1 / (1 + Math.exp(-values[0]!))
}
