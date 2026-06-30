# cambios-CC-plan-4.md — 4ª tanda C&K (julio 2026)

> `cambios.txt` se conserva como fuente; este es el plan. Rama: `main`. Prioridad: bugs.

## Bug único

**El ícono de Ciencia se ve más pequeño que Comercio/Política.**

**Diagnóstico (medido con PIL sobre el alfa):** los tres íconos de disciplina son
lienzos de 256×256, pero el contenido visible (medallón) ocupa distinto porcentaje:
- `comercio.png`: bbox 246×248 → **96%** del lienzo.
- `politica.png`: bbox 246×248 → **96%** del lienzo.
- `ciencia.png`: bbox 162×164 → **63%** del lienzo (mucho margen transparente).

Por eso, al renderizarse al mismo tamaño en px, el medallón de Ciencia se ve ~⅓ más
chico. (No es un problema de CSS: el cableado en `icons.tsx` ya renderiza los tres
con el mismo `DisciplineGlyph` y tamaño.)

**Fix (visual-designer; ejecutado vía PIL por ser pixel-exacto):** normalizar
`ciencia.png` para que su contenido llene el mismo ~96% que las otras dos: recortar
al bounding box del alfa, re-escalar el medallón a ~248px (lado mayor) y centrarlo en
un lienzo transparente de 256×256. Verificar re-midiendo (debe quedar ~96%) y con el
build del cliente.

## Reparto por agente
- **visual-designer / orquestador:** la normalización del asset `ciencia.png` (arte/íconos es su dominio; se hace con PIL por determinismo de píxeles).
- Resto de agentes (ui-engineer, ux-writer, motion-engineer, qa-auditor, ux-architect): sin tareas — no hay cambios de código, copy, layout ni lógica.

## Verificación
- Re-medir el bbox de `ciencia.png` (~96% como comercio/politica).
- `cd client && npm run build`. Commit en `main`. Actualizar `context.md`.
