/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identidad de jugadores. Cada color tiene una variante base (cuerpo) más
        // shades 400 (más clara para acentos sobre dark) / 600 (más oscura para
        // bordes). Mantenemos la entrada raíz (player.red, player.blue, ...) por
        // compatibilidad con código existente.
        player: {
          red: '#d64545',
          'red-400': '#e26a6a',
          'red-600': '#b03434',
          blue: '#3b6dd1',
          'blue-400': '#6691e0',
          'blue-600': '#2c54a6',
          // El blanco sobre dark se tiñe levemente para no quemar la retina.
          white: '#ececec',
          'white-400': '#f5f5f5',
          'white-600': '#c8c8c8',
          orange: '#e58a3a',
          'orange-400': '#eea662',
          'orange-600': '#b96a22',
          green: '#3fa05a',
          'green-400': '#5fbb78',
          'green-600': '#2f7b44',
          // El café sobre dark sube ligeramente para mantener contraste WCAG AA.
          brown: '#9a6a4a',
          'brown-400': '#b4866a',
          'brown-600': '#7a5036',
        },
        // Recursos
        resource: {
          brick: '#b85c3a',
          lumber: '#2f6d3a',
          wool: '#cfd8c2',
          grain: '#e6c453',
          ore: '#5b6470',
        },
        // Superficies elevadas sobre dark. Tokens semánticos para que los
        // componentes no inventen su propio bg-white/[0.0X].
        surface: {
          DEFAULT: '#0f1115',
          1: '#15181f', // tarjeta nivel 1 (paneles colapsables, banco)
          2: '#1a1e26', // tarjeta nivel 2 (mano, acciones)
          3: '#21262f', // tarjeta nivel 3 (inputs, chips)
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Escala dedicada para conteos (tabular, sin variantes ligaturas).
        'count-sm': ['1.125rem', { lineHeight: '1', letterSpacing: '-0.01em', fontWeight: '700' }],
        'count': ['1.5rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'count-lg': ['1.75rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      minHeight: {
        screen: '100dvh',
      },
      boxShadow: {
        // Sombras suaves específicas para superficies sobre dark.
        'soft': '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 1px 2px 0 rgba(0,0,0,0.4)',
        'card': '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 4px 14px -4px rgba(0,0,0,0.5)',
        'cta': '0 6px 18px -4px rgba(16, 185, 129, 0.45), 0 1px 0 0 rgba(255,255,255,0.15) inset',
        'cta-amber': '0 6px 18px -4px rgba(245, 158, 11, 0.45), 0 1px 0 0 rgba(255,255,255,0.15) inset',
      },
      ringColor: {
        focus: 'rgba(110, 168, 254, 0.85)',
      },
    },
  },
  plugins: [],
};
