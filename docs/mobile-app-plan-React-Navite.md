# mobile-app-plan.md — App móvil nativa de Catán Assistant

> Plan de implementación para convertir el cliente web en una **app móvil descargable e instalable** (Android/iOS), usando **React Native + Expo**. El backend (`server/`) **no se modifica**: la app móvil es solo otro cliente del mismo Socket.IO + REST. Este documento es un plan; **no se ha escrito código todavía**.

---

## 0. Resumen ejecutivo

- **¿Es posible con React Native?** Sí, sin reservas. La arquitectura actual lo facilita: el cliente es delgado (renderiza la vista que manda el servidor y emite eventos), así que **toda la lógica de dominio, validación y anti-trampas se queda en el backend** y se reutiliza tal cual.
- **Qué se reutiliza casi sin tocar:** `types.ts`, `socket.ts`, `api.ts`, `store.ts` (Zustand funciona igual en RN), `lib/spanish.ts`, `lib/playerColors.ts`. ~1,500 líneas de lógica portan con cambios mínimos (`localStorage` → `AsyncStorage`).
- **Qué se reescribe:** la **capa visual** — ~40 componentes + 5 pantallas (~12,900 líneas) construidos con primitivas web (`div`/`button`/`svg`/`img`) y Tailwind (`className`). En RN se reconstruyen con `View`/`Text`/`Pressable`/`Image` y estilos RN. El **comportamiento** de cada uno ya está resuelto; solo cambia el "pintado".
- **Backend:** **cero cambios funcionales.** Solo ajustes de despliegue/CORS para aceptar conexiones desde la app empacada (ya no es "mismo origen").
- **Esfuerzo estimado:** 3–5 semanas de una persona para paridad completa de funcionalidad, repartido en fases incrementales (ver §7).

### Alternativas consideradas (y por qué RN, si lo eliges)

| Opción | Reescritura UI | Resultado | Cuándo conviene |
|---|---|---|---|
| **A. Capacitor** (envolver `client/dist`) | ~0 | APK/IPA que corre la webview con el código actual | Quieres un instalable **ya**, mínimo esfuerzo |
| **B. PWA instalable** | ~0 (manifest + service worker) | "Agregar a inicio" sin tienda | Aún más rápido, sin pasar por tiendas |
| **C. React Native + Expo** ← **este plan** | Alta (capa visual) | App **verdaderamente nativa** | Quieres rendimiento/UX nativa, push nativo, presencia en tiendas |

> Recomendación honesta: si el objetivo es solo "descargarla e instalarla en el celular cuanto antes", **A o B** te lo dan en días envolviendo lo que ya existe. **C (React Native)** es la inversión correcta si quieres una app nativa de verdad y mantenerla a largo plazo. El resto de este documento detalla **C**.

---

## 1. Por qué la arquitectura actual ayuda

El `context.md §2` lo deja claro y lo confirmé leyendo el código:

- **El servidor manda una vista ya cocinada** (`socket/views.ts`): el cliente nunca calcula reglas, solo dibuja `view.state` y emite eventos (`turn:rollNumber`, `build`, `trade:*`, etc.). Toda esa superficie de eventos (`context.md §7`) es **agnóstica al transporte visual** → se reutiliza igual en RN.
- **Privacidad y anti-trampas viven en el server** (manos privadas, vistas personalizadas). La app móvil no hereda ningún riesgo nuevo: sigue recibiendo solo lo que le toca.
- **`store.ts` (Zustand)** ya centraliza todo el estado del cliente y el cableado del socket (`wireSocket`). Zustand **no depende del DOM** → funciona idéntico en RN.
- **`socket.io-client` y `fetch`** existen en React Native con la misma API. El reconnect, los acks (`emitWithAck`) y el handshake con JWT (`auth.token`) portan sin cambios de lógica.

En otras palabras: **el "cerebro" del cliente ya está separado de su "cara".** RN reemplaza la cara.

---

## 2. Qué se reutiliza vs. qué se reescribe (inventario)

### 2.1 Se porta casi sin cambios (capa lógica → paquete compartido)

| Archivo actual | Cambio para RN |
|---|---|
| `client/src/types.ts` | Ninguno (TS puro). |
| `client/src/socket.ts` | Quitar el `path` relativo de proxy; usar URL absoluta del server (ver §4). |
| `client/src/api.ts` | Cambiar rutas relativas `/api/...` por `${API_BASE}/api/...`. `fetch` igual. |
| `client/src/store.ts` | Sustituir imports de `persistence.ts` (igual API, otra implementación). |
| `client/src/lib/persistence.ts` | Reescribir contra `@react-native-async-storage/async-storage` (API asíncrona) — ver §3.3. |
| `client/src/lib/spanish.ts` | Ninguno (strings puros). |
| `client/src/lib/playerColors.ts` | Ninguno (mapa hex → token). |

**Estrategia recomendada:** extraer estos a un paquete compartido (`packages/core` en monorepo, o carpeta `shared/`) para que **web y móvil consuman la misma lógica** y no se dupliquen tipos/eventos. Ver §6.

### 2.2 Se reescribe (capa visual)

Las **5 pantallas** (`LoginScreen`, `HomeScreen`, `LobbyScreen`, `GameScreen`, `ProfileScreen`) y los **~40 componentes** de `client/src/components/`. Cada uno mantiene su **lógica y props**, pero cambia:

| Web (actual) | React Native |
|---|---|
| `<div>` | `<View>` |
| `<button onClick>` | `<Pressable onPress>` |
| `<p>/<span>/texto` | `<Text>` (en RN **todo texto va dentro de `<Text>`**) |
| `<img src={pngUrl}>` | `<Image source={require(...)}>` |
| `<svg><path>` | `react-native-svg` (`<Svg><Path>`) |
| `className="..."` (Tailwind) | NativeWind (Tailwind para RN) **o** `StyleSheet` |
| `<input>` | `<TextInput>` |
| Modales (overlay con `fixed`/`z-index`) | `<Modal>` de RN o librería de bottom-sheet |
| `localStorage` síncrono | `AsyncStorage` asíncrono |
| `window`/`document`/eventos `storage` | No existen — se eliminan (ver §3) |

### 2.3 No se toca

- Todo `server/` (Express, Socket.IO, reglas, setup, persistencia, auth, friends).
- Tests del server (`*.test.ts`).
- El cliente web puede **seguir existiendo** en paralelo (la app móvil no lo reemplaza; lo acompaña).

---

## 3. Puntos técnicos que requieren decisión/adaptación

### 3.1 Estilos: NativeWind vs. StyleSheet
El tema Catán vive en `tailwind.config.js` (paleta `neutral` cálida, `player`, `resource`, `surface`, `gold`, sombras `wood`/`cta`/`medal`).
- **Opción recomendada: NativeWind v4.** Permite seguir usando clases Tailwind (`className`) en RN y **reutilizar `tailwind.config.js` casi entero**. Reduce drásticamente la reescritura visual: muchos componentes quedan con el mismo `className`.
- **Limitaciones a manejar:** sombras complejas (`box-shadow` con `inset`, usado en `shadow-wood`/`shadow-medal`) **no existen en RN** — se aproximan con `elevation` (Android) y `shadowColor/Offset/Opacity/Radius` (iOS), o gradientes con `expo-linear-gradient`. Hay que rehacer esas ~6 sombras a mano.
- Unidades: `100dvh`, `env(safe-area-inset-*)`, `min-h-screen` → `react-native-safe-area-context` + `Dimensions`/flex.

### 3.2 Iconos y assets
- **PNGs** (`assets/icons/*.png`): se importan con `require()` y `<Image>`. Portan bien; `assets/icons.tsx` se adapta cambiando el tipo de retorno (de `<img>` a `<Image>`).
- **SVGs inline** (cartas de desarrollo, insignias, el sobre de invitación en `App.tsx`): migrar a `react-native-svg`. Es mecánico (`<path d=...>` → `<Path d=...>`).
- **Fuente display** (`Iowan Old Style`/Palatino…): en móvil no hay stack de fuentes del sistema garantizado → **empacar una fuente serif** (p. ej. vía `expo-font`, una serif tipo "Spectral"/"Lora") para el look mapa/aventura de títulos, código de sala y "GANADOR".

### 3.3 Persistencia
`persistence.ts` usa `localStorage` **síncrono**. `AsyncStorage` es **asíncrono** (devuelve Promesas). Implicaciones:
- Reescribir `getSession/setSession/getAuthToken/...` como `async`.
- El arranque del store (que hoy lee sync al inicializar) debe **hidratarse en un efecto async** antes de pintar (mostrar un splash mientras hidrata). Patrón: `useEffect` que carga sesión + token y luego marca `hydrated: true`.
- El callback `auth` del socket (`socket.ts`) lee el token de forma síncrona hoy → cachear el token en memoria del store tras hidratar y que el callback lo lea de ahí.

### 3.4 Cosas web que se eliminan (no aplican en móvil)
- `App.tsx`: el listener de evento `storage` (sincronizar login entre pestañas) — **no hay pestañas** en móvil; se borra.
- `window.setTimeout`/`window.clearTimeout` → `setTimeout`/`clearTimeout` globales.
- `main.tsx` (`ReactDOM.createRoot` + `#root`) → reemplazado por el entrypoint de Expo (`registerRootComponent` / `App` raíz con `SafeAreaProvider` + `NavigationContainer`).

### 3.5 Navegación
Hoy `App.tsx` decide la pantalla con un `if/else` sobre el estado del store (no hay router). En móvil conviene **React Navigation** (native-stack) para tener back nativo, gestos y transiciones. La lógica de precedencia actual (`showLogin` → sesión de sala → JWT → invitado → login) se mapea a navegación condicional / redirecciones.

### 3.6 Toasts, notices e invitaciones
`App.tsx` los pinta como overlays `fixed`. En RN: un overlay con `position:absolute` + `SafeAreaView`, o librería (`react-native-toast-message`). Los **notices públicos anti-trampas** (`NoticeBanner`) deben seguir siendo prominentes y por encima de modales — replicar el z-order con un overlay raíz.

### 3.7 Teclado numérico y entradas
`NumericKeypad.tsx` es un teclado in-app (no usa el del sistema) → porta directo a `Pressable`s. Para `TextInput` reales (login, código de sala), usar `keyboardType="number-pad"` y manejar el `KeyboardAvoidingView`.

---

## 4. Conexión al backend (el cambio clave de despliegue)

Hoy el cliente web es **mismo origen**: Vite hace proxy de `/socket.io` y `/api` al `:3001`, y en producción Express sirve `client/dist`. Una app empacada **no tiene "mismo origen"** — debe apuntar a una **URL absoluta del servidor**.

Cambios necesarios:

1. **Config de URL base.** Introducir `API_BASE` / `SOCKET_URL` (vía `app.config.ts` / `expo-constants` / `.env`). Ej.: `https://catan.midominio.com`. En `socket.ts`: `io(SOCKET_URL, { ... })`. En `api.ts`: `fetch(\`${API_BASE}/api/...\`)`.
2. **Descubrimiento del server en LAN (caso de uso real).** La app está pensada para **partidas presenciales** — todos en la misma red. Opciones:
   - **a)** Server desplegado en internet (dominio público + TLS). Simple, funciona en cualquier red, pero requiere hosting.
   - **b)** Server en LAN (la laptop del anfitrión): la app pide al usuario la **IP:puerto del anfitrión** (o un QR que el anfitrión muestra con la URL). Encaja con el modelo "código de sala".
   - **Recomendado:** soportar ambos — un campo "servidor" recordado + opción de escanear QR.
3. **CORS / Socket.IO origins.** El server debe permitir el origen de la app. En apps empacadas el `Origin` suele ser `null`/esquema propio → configurar `cors` de Socket.IO y Express para aceptarlo. **Esto es un ajuste de config en `server/src/index.ts`, no de lógica.**
4. **TLS para producción.** WebSocket sobre `wss://` requerido si publicas en tiendas (ATS de iOS y `usesCleartextTraffic` de Android bloquean texto plano). Para LAN/local quedará el flag de cleartext en dev.
5. **JWT igual.** El handshake (`auth.token`) y el `Authorization: Bearer` no cambian — solo el host.

---

## 5. Notificaciones, ciclo de vida y detalles móviles

- **Reconexión en background:** los SO matan/suspenden el socket cuando la app pasa a segundo plano. Manejar `AppState` (RN): al volver a `active`, forzar `socket.connect()` y `reconnectGame()` (ya existe la lógica de reconexión silenciosa en el store; solo se dispara desde `AppState` en vez de `onload`).
- **Mantener pantalla encendida** durante la partida (`expo-keep-awake`) — útil en juego de mesa presencial.
- **Push nativo (opcional, fase posterior):** "es tu turno", "te invitaron a una sala". Requiere `expo-notifications` + guardar el push token en el server (nuevo endpoint, **única adición real al backend**, opcional).
- **Safe areas / notch:** `react-native-safe-area-context` reemplaza los `env(safe-area-inset-*)` del CSS actual.
- **Vibración háptica** en acciones clave (tirar dado, robo) — `expo-haptics`, mejora la sensación nativa.

---

## 6. Estructura de proyecto propuesta (monorepo)

Para no duplicar la lógica entre web y móvil:

```
catan-assistant/
  server/                      # SIN CAMBIOS (salvo CORS de §4.3)
  packages/
    core/                      # NUEVO — lógica compartida web+móvil
      types.ts                 # (movido desde client/src)
      socketClient.ts          # fábrica de socket parametrizada por URL
      apiClient.ts             # fetch parametrizado por API_BASE
      store.ts                 # Zustand (sin dependencias de DOM)
      spanish.ts, playerColors.ts
      storage.ts               # INTERFAZ de persistencia (impl. inyectada)
  client/                      # web actual; pasa a consumir packages/core
  mobile/                      # NUEVO — app Expo / React Native
    app.config.ts
    src/
      screens/                 # reescritura RN de las 5 pantallas
      components/              # reescritura RN de los ~40 componentes
      assets/                  # PNGs + fuentes empacadas
      storage.native.ts        # impl. AsyncStorage de la interfaz storage
      theme/                   # tokens del tema (de tailwind.config) para NativeWind
```

> `packages/core/storage.ts` define una **interfaz** (`getSession`, `setSession`, …); web inyecta la impl. `localStorage` y móvil la de `AsyncStorage`. Así `store.ts` no sabe en qué plataforma corre. Si no quieres monorepo aún, una variante más simple es copiar `core` a `mobile/src/core` y sincronizar manualmente, aceptando la duplicación.

---

## 7. Fases de implementación (incremental, verificable)

> Cada fase deja algo **ejecutable en un dispositivo real** vía Expo Go (dev) o build de desarrollo.

### Fase 0 — Andamiaje y prueba de vida (½–1 día)
- `npx create-expo-app mobile` (TypeScript). Añadir NativeWind, `react-native-safe-area-context`, `react-navigation/native-stack`, `react-native-svg`, `@react-native-async-storage/async-storage`, `socket.io-client`, `zustand`.
- Configurar `app.config.ts` con `SOCKET_URL`/`API_BASE`.
- **Hito:** la app abre en el teléfono y **conecta al socket del server** (log "connected"). Sin UI todavía. Esto valida §4 (CORS, URL, red) antes de invertir en pantallas.

### Fase 1 — Núcleo lógico compartido (1–2 días)
- Crear `packages/core` (o copiar). Portar `types`, `store`, `socketClient`, `apiClient`, `spanish`, `playerColors`.
- Implementar `storage.native.ts` con AsyncStorage + hidratación async del store (§3.3).
- **Hito:** desde una pantalla de prueba puedo **crear/unirme a una sala** y ver el `view.state` crudo (JSON) actualizarse en tiempo real. Confirma que todo el contrato Socket.IO funciona en RN **antes** de pintar nada bonito.

### Fase 2 — Auth + Home + Lobby (3–5 días)
- Navegación (React Navigation) con la precedencia de pantallas de `App.tsx`.
- Reescribir `LoginScreen`, `HomeScreen`, `LobbyScreen` (colores, orden de turnos, bank manager, toggles de reglas, registro de construcciones iniciales `InitialBuildSetup`).
- Tema base con NativeWind + fuente display empacada.
- **Hito:** puedo registrarme/entrar, crear sala, configurarla y llegar a `game:start` desde el teléfono.

### Fase 3 — GameScreen y el grueso de componentes (1.5–2 semanas)
- Reescribir el corazón: `GameScreen`, `HandView`, `ActionGrid`, `ConstructionTable`, `BankPanel`+`NumericKeypad`, `DiceStats`, `Log`, `RobberFlow`, `DiscardModal`, `TradeModal`/`TradeIncomingModal`, `DevCardsPanel` + pickers (Monopoly/YearOfPlenty/RoadBuilding), modales de puerto, `SpecialBuildBanner`, `PublicPlayersPanel`, `NoticeBanner`, `ContextBanner`.
- Migrar iconos PNG (`<Image>`) y SVG (`react-native-svg`).
- **Hito:** **una partida completa de extremo a extremo** desde móviles (la prueba de paridad real).

### Fase 4 — Cierre, perfil, amigos, pulido (3–5 días)
- `ProfileScreen` (avatar, displayName, color, stats), `FriendsPanel`, invitaciones, `WinnerScreen`.
- `AppState` reconnect, keep-awake, safe areas, hápticos.
- Pulido visual (sombras `wood`/`medal` aproximadas, animaciones con `react-native-reanimated`, respetar `reduce motion`).
- **Hito:** paridad funcional con el cliente web.

### Fase 5 — Empaquetado e instalación (2–3 días)
- **EAS Build** (Expo Application Services): genera `.apk`/`.aab` (Android) e `.ipa` (iOS).
- **Android:** instalar el APK directo en el dispositivo (sideload) — cumple el objetivo "descargar e instalar" sin tienda. Para Play Store: `.aab` + cuenta de desarrollador.
- **iOS:** requiere cuenta Apple Developer ($99/año) para instalar en dispositivo físico fuera de simulador (TestFlight o ad-hoc).
- TLS en el server para builds de release (§4.4).
- **Hito:** APK instalable corriendo en tu teléfono.

---

## 8. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Reescritura visual subestimada (~40 componentes) | Cronograma | NativeWind reutiliza `tailwind.config` y muchos `className`; empezar por los componentes más usados; los subagentes de UI del proyecto (`ui-engineer`, `visual-designer`) ayudan. |
| Sombras/efectos de madera no portan 1:1 | Cosmético | Aproximar con `elevation`/shadow iOS + gradientes; aceptar pequeña divergencia visual. |
| Descubrimiento del server en LAN | UX de conexión | Campo de servidor recordado + QR del anfitrión (§4.2). |
| CORS/origen de app empacada | Bloquea conexión | Resolver en Fase 0 antes de invertir en UI. |
| iOS requiere cuenta de pago | Costo/tiempo | Empezar por Android (sideload gratis); iOS después. |
| Socket suspendido en background | Reconexión | `AppState` + la lógica de reconnect ya existente en el store. |
| Duplicación de lógica web/móvil | Mantenimiento | Monorepo `packages/core` desde el inicio (§6). |

---

## 9. Decisiones que necesito que tomes antes de implementar

1. **¿React Native de verdad, o el atajo Capacitor/PWA?** (este plan asume RN; si solo quieres el instalable ya, reconsiderar A/B de §0).
2. **Hosting del server:** ¿público con dominio+TLS, o LAN con la laptop del anfitrión (o ambos)?
3. **Plataformas objetivo:** ¿solo Android primero (gratis, sideload), o también iOS (cuenta Apple)?
4. **Monorepo `packages/core` ahora**, o copiar la lógica a `mobile/` y unificar después.
5. **NativeWind** (reutiliza Tailwind) **vs. StyleSheet** nativo.

> Cuando definas estos cinco puntos, el siguiente paso es ejecutar la **Fase 0** y validar la conexión real desde un teléfono antes de escribir una sola pantalla.
