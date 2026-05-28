export default {
  content: ['./index.html','./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        g: {
          base:    '#1a1625',
          surface: '#251e35',
          card:    '#2f2645',
          input:   '#3a2f55',
          border:  '#4a3d6a',
          muted:   '#9080b0',
          dim:     '#5e5080',
        }
      },
      fontFamily: { mono: ['ui-monospace','SFMono-Regular','monospace'] },
      animation: {
        'blink': 'blink 1.2s ease-in-out infinite',
        'wolf':  'wolfBob 2s ease-in-out infinite',
      },
    }
  },
  plugins: [],
}
