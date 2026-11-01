// Chooses the screen transition the way iOS moves between screens:
// tabs cross-fade, sub-pages push in from the right and pop back out,
// games and the session rise like a full-screen modal and drop away.
// No transition at all when motion is off.
const TABS = ['/', '/words', '/tank', '/progress', '/settings']
const isTab = (path: string) => TABS.includes(path.replace(/\/$/, '') || '/')
const isModal = (path: string) => path.startsWith('/games/') || path === '/session'

export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return
  if (!document.documentElement.classList.contains('rien-motion')) {
    to.meta.pageTransition = false
    return
  }
  let name = 'fade'
  if (isModal(to.path) && !isModal(from.path)) name = 'modal'
  else if (isModal(from.path) && !isModal(to.path)) name = 'dismiss'
  else if (isTab(from.path) && !isTab(to.path)) name = 'push'
  else if (!isTab(from.path) && isTab(to.path)) name = 'pop'
  to.meta.pageTransition = { name, mode: 'out-in' }
})
