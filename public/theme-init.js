(function () {
  const m = localStorage.getItem('theme-mode')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (m === 'dark' || (m !== 'light' && prefersDark)) {
    document.documentElement.classList.add('dark')
  }
})()
