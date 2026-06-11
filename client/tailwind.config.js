/** @type {import('tailwindcss').Config} */

// ─── Tema Catán ──────────────────────────────────────────────────────────────
// Decisión global ÚNICA (brief fase 3 §6): tema OSCURO "madera/noche".
//  - Fondo: océano azul profundo (vive en index.css como capa fija de body).
//  - Superficies: madera oscura cálida, SÓLIDAS (nada de texto sobre el agua).
//  - Acento dorado RESERVADO para títulos, código de sala e insignias.
//  - La escala `neutral` se sobreescribe completa con tintes cálidos
//    (arena/pergamino en los claros, nogal en los oscuros) para que TODO el
//    texto y los controles existentes adopten el tema sin tocar componentes.
//    Las luminosidades replican la escala neutral original → cero regresión
//    de contraste (verificado AA, ver tabla en el mensaje de entrega).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutros cálidos (sustituyen al gris frío de Tailwind en toda la app).
        // 50–300: arena/pergamino para texto sobre madera. 700–950: nogal.
        neutral: {
          50: '#f8f1e3',
          100: '#f0e6d2',
          200: '#ddcfb4',
          300: '#c5b290',
          400: '#a28b6d',
          500: '#87715a',
          600: '#6b573f',
          700: '#51402e',
          800: '#392c1f',
          900: '#251d14',
          950: '#191310',
        },
        // Identidad de jugadores (piezas reales de Catán). Cada color tiene
        // base + 400 (acentos sobre dark) / 600 (bordes). Espejado en
        // lib/playerColors.ts para estilos inline.
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
        // Recursos — paleta de las cartas: terracota, bosque, pastura, trigo,
        // pizarra. Consistente entre íconos (assets/icons.tsx), fichas y conteos.
        resource: {
          brick: '#c4663f',
          lumber: '#3a8049',
          wool: '#cfd8c2',
          grain: '#e6c453',
          ore: '#6c7682',
        },
        // Océano (el mar que rodea el tablero). El fondo real vive en
        // index.css; estos tokens existen para acentos puntuales y overlays.
        ocean: {
          deep: '#07243a',
          DEFAULT: '#0c3553',
          high: '#176087',
        },
        // Dorado: SOLO títulos, código de sala, victoria e insignias.
        gold: {
          light: '#ecc35f',
          DEFAULT: '#d9a93e',
          deep: '#a87b22',
        },
        // Superficies de madera oscura, SÓLIDAS y elevadas sobre el océano.
        // Tokens semánticos: los componentes no inventan su bg-white/[0.0X].
        surface: {
          DEFAULT: '#14100c', // base profunda (raramente usada directa)
          1: '#1f1812', // tarjeta nivel 1 (paneles colapsables, secciones)
          2: '#271e15', // tarjeta nivel 2 (mano, acciones, cards del lobby)
          3: '#2f2419', // tarjeta nivel 3 (inputs, chips, botones secundarios)
          4: '#3a2c1e', // tarjeta nivel 4 (chips destacados, estados fuertes)
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        // Display con aire de mapa/aventura para títulos, código de sala y
        // "GANADOR". Stack 100% local (la app corre en LAN sin internet):
        // serifs humanistas presentes en iOS/macOS/Windows/Android.
        display: [
          '"Iowan Old Style"',
          '"Palatino Linotype"',
          'Palatino',
          '"Book Antiqua"',
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          'serif',
        ],
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
        // Sombras suaves para superficies de madera sobre el océano.
        'soft': '0 1px 0 0 rgba(255,235,200,0.05) inset, 0 1px 2px 0 rgba(0,0,0,0.45)',
        'card': '0 1px 0 0 rgba(255,235,200,0.06) inset, 0 4px 14px -4px rgba(0,0,0,0.55)',
        // Sensación madera/piedra en botones: filo iluminado arriba, canto
        // oscuro abajo, caída corta. Barata (sin blur grande) para listas.
        'wood': 'inset 0 1px 0 rgba(255,235,200,0.08), inset 0 -1px 0 rgba(0,0,0,0.45), 0 2px 5px -1px rgba(0,0,0,0.5)',
        'cta': '0 6px 18px -4px rgba(16, 185, 129, 0.45), 0 1px 0 0 rgba(255,255,255,0.15) inset, 0 -2px 0 0 rgba(0,0,0,0.18) inset',
        'cta-amber': '0 6px 18px -4px rgba(245, 158, 11, 0.45), 0 1px 0 0 rgba(255,255,255,0.15) inset, 0 -2px 0 0 rgba(0,0,0,0.18) inset',
        // Medalla/sello para insignias: aro interior dorado + relieve.
        'medal': 'inset 0 0 0 1px rgba(217,169,62,0.35), inset 0 1px 0 rgba(255,235,200,0.18), 0 1px 3px rgba(0,0,0,0.5)',
      },
      ringColor: {
        // Foco dorado: visible tanto sobre madera como sobre océano.
        focus: 'rgba(236, 195, 95, 0.9)',
      },
    },
  },
  plugins: [],
};
