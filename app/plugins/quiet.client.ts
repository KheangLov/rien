// Sound never outlives its screen: reading aloud, recordings and listening stop
// when she goes to another screen, closes a game, or leaves the app (home
// button, app switcher, locking the phone, closing the tab).
export default defineNuxtPlugin(() => {
  const router = useRouter()
  router.beforeEach((to, from) => {
    if (to.path !== from.path) stopAllSound()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stopAllSound()
  })
  window.addEventListener('pagehide', () => stopAllSound())
})
