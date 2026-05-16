(function () {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  let m = null
  try {
    m = localStorage.getItem('theme-mode')
  } catch {
    // localStorage can throw in private mode, locked-down enterprise configs,
    // or file:// origins. Fall through to the prefers-color-scheme check.
  }
  if (m === 'dark' || (m !== 'light' && prefersDark)) {
    document.documentElement.classList.add('dark')
  }
})()
