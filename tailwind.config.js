module.exports = {
  content: ['./public/index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        'gl-lightblue': '#BEC4E5',
        'gl-blue': '#A3ACE0',
        'gl-darkblue': '#283380',
        'gl-deep-blue': '#010A33',
        'gl-blueberry': '#5368E6',
        'gl-muted-blue': '#434971',
        'gl-lightgray': '#E7E9F3',
        'gl-gray': '#BEC4E5',
        'gl-lightgreen': '#57CF7E',
        'gl-green': '#3B9158'
      }
    }
  },
  plugins: []
}
