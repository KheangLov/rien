// Builds the skill model (useLearner) once the first screen is up and the
// phone is idle, so the first round already has it and opening the app never
// waits for it.
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    const start = () => void useLearner().catch(error => console.warn('[rien] skill model', error))
    if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 4000 })
    else setTimeout(start, 1500)
  })
})
