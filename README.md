# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- Pieza reto **`N` (tuerca)**: una pieza de 3×3 con un hueco vacío en el centro, rodeado por sus propios bloques. Al fijarse, esa celda central queda inaccesible para el resto de piezas, así que la fila que la contiene no puede completarse hasta que el resto del tablero a su alrededor se despeje.
- **Power-up bomba**: cada `5` líneas eliminadas, la siguiente pieza es una bomba (bloque único con animación de pulso). Al fijarse, en vez de sumarse al tablero, destruye un área de **3×3** centrada en su posición de aterrizaje y suma puntos extra por celda despejada.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Pausa** y **Game Over** con opción de reinicio.
- **Toggle de tema claro/oscuro**: modo oscuro por defecto, con un switch en el panel lateral para cambiar a modo claro. La preferencia se guarda en `localStorage`.
- **Tabla de records (Top 5)**: panel lateral con las 5 mejores puntuaciones guardadas localmente, más las estadísticas de mejor combo (líneas simultáneas) y máximo de líneas alcanzadas en una partida. Al perder, si la puntuación entra en el top 5 se pide el nombre del jugador para guardarla, resaltando la fila recién añadida.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `P`       | Pausar / reanudar                 |

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con el switch de tema (`#theme-toggle`), `SCORE`, `LINES`, `LEVEL`, vista de la siguiente pieza, la tabla de records **TOP 5** (`#leaderboard-list`, stats de mejor combo/máx. líneas y botón `#reset-leaderboard-btn`) y la lista de controles.
- Un overlay para los estados **PAUSA** y **GAME OVER**, que en Game Over puede incluir el formulario de nuevo record (`#new-record-box`: input de nombre + botón `#save-record-btn`).

### 2. `style.css`

Aporta el aspecto visual con estética _retro arcade_, con **modo oscuro por defecto**. Todos los colores están definidos como variables CSS (custom properties) en `:root`; la clase `body.light` las sobrescribe para el modo claro. Incluye tipografía monoespaciada para los marcadores, _backdrop blur_ en los overlays y los estilos del switch de tema (`.switch`).

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–8) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas, donde `0` marca una celda vacía dentro de la forma. Para rotar se calcula la transposición + reverso de filas (`rotateCW`). La pieza `N` (tuerca) usa este mismo mecanismo de "hueco = 0" para su celda central, sin necesitar lógica especial.
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.
- **Power-up bomba** (`randomPiece(forceBomb)`, `explodeBomb`, `drawBombBlock`, `drawExplosion`): `clearLines` detecta cuándo el contador de `lines` cruza un múltiplo de `BOMB_LINES_INTERVAL` (5) y marca `bombPending`; `spawn` consume esa marca para generar la siguiente pieza como bomba (un único bloque con color especial `BOMB_COLOR`, dibujado con un pulso). Al fijarse, `lockPiece` la enruta a `explodeBomb()` en vez de `merge()`: vacía las celdas del área 3×3 centrada en su posición final (recortada a los bordes del tablero), suma `BOMB_SCORE_PER_CELL` puntos por celda despejada y guarda el estado en `explosion` para que `draw()` dibuje un breve destello (`drawExplosion`, con fade-out de `EXPLOSION_DURATION` ms).
- **Tema claro/oscuro** (`applyTheme`): alterna la clase `light` en `<body>` según el estado del switch `#theme-toggle`, persiste la elección en `localStorage` (clave `theme`) y por defecto usa modo oscuro si no hay preferencia guardada. El color de la grilla del canvas (`drawGrid`) se lee dinámicamente de la variable CSS `--grid-line-color` para respetar el tema activo.
- **Tabla de records (Top 5)** (`loadLeaderboard`, `saveLeaderboard`, `renderLeaderboard`, `qualifiesForTop5`, `saveNewRecord`): el top 5 se guarda como un array JSON en `localStorage['tetris-leaderboard']` (siempre ordenado por puntuación descendente y truncado a 5 elementos; una clave ausente o con JSON inválido se trata como lista vacía sin lanzar error). `renderLeaderboard()` vuelca esa lista y las estadísticas al DOM y se invoca al cargar la página, tras cada línea despejada (para refrescar el combo en vivo) y tras guardar/resetear records. `clearLines()` compara el número de líneas despejadas de una sola vez contra `localStorage['tetris-best-combo']` y lo actualiza si es mayor; `endGame()` hace lo propio con el total de líneas de la partida contra `localStorage['tetris-max-lines']`. Si al perder la puntuación califica para el top 5 (`qualifiesForTop5`), `endGame()` muestra el formulario de nombre dentro del overlay; al guardar (`saveNewRecord`) se añade `{name, score, lines, level, date}` a la lista, se persiste y la fila nueva se resalta temporalmente (`.top-entry-new`) en el panel. El botón "Resetear records" borra las tres claves de `localStorage` y vuelve a renderizar el estado vacío.

### Flujo del juego

```
init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (toggle dark/light theme)
├── game.js         # Toda la lógica del Tetris (~300 líneas)
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `COLORS`       | Paleta de colores por tipo de pieza      | 9 colores (incl. bomba) |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |
| `BOMB_LINES_INTERVAL` | Líneas entre apariciones de la bomba | `5`             |
| `BOMB_SCORE_PER_CELL` | Puntos por celda destruida por la bomba | `20`         |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

### `localStorage`

| Clave                  | Contenido                                                          |
| ----------------------- | ------------------------------------------------------------------- |
| `theme`                 | `'light'` o `'dark'`, preferencia del toggle de tema.               |
| `tetris-leaderboard`    | Array JSON (máx. 5) de `{name, score, lines, level, date}`, top 5.  |
| `tetris-best-combo`     | Entero: mayor cantidad de líneas despejadas de una sola vez.        |
| `tetris-max-lines`      | Entero: mayor total de líneas alcanzado en una partida.             |

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
