const CHARSET = "01ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*+-=<>/\\|?~".split("");
const CELL_SIZE = 16;
const FONT_SIZE = 13;
const EDGE_PADDING = 20;
const JITTER_AMOUNT = CELL_SIZE * 0.35;
const CIRCLE_RADIUS_RATIO = 0.85;
const CIRCLE_BAND_THICKNESS = 0.02;
const CIRCLE_COLOR = "#ff0000";
const DIM_ALPHA = 0.15;

const HEART_SCALE_PX = 90;
const HEART_COLOR = "#ff69b4";
const HEART_DIP_FACTOR = 2;
const HEART_BASE_SCALE = 1.3;

const HEART_HALF_WIDTH_PX = 111;
const HEART_HALF_HEIGHT_TOP_PX = 123;
const HEART_HALF_HEIGHT_BOTTOM_PX = 89;
const HEX_FILL_MARGIN_PX = HEART_SCALE_PX * 0.75;
const HEX_FILL_CENTER_OFFSET_Y_PX = (HEART_HALF_HEIGHT_TOP_PX - HEART_HALF_HEIGHT_BOTTOM_PX) / 2;
const HEX_FILL_RADIUS_X_PX = HEART_HALF_WIDTH_PX + HEX_FILL_MARGIN_PX;
const HEX_FILL_RADIUS_Y_PX = (HEART_HALF_HEIGHT_TOP_PX + HEART_HALF_HEIGHT_BOTTOM_PX) / 2 + HEX_FILL_MARGIN_PX;
const HEX_FILL_COLOR = "#6699ff";

const INNER_TRAVEL_MS = 700;
const TENSION_MS = 1000;
const REST_GAP_MS = 500;
const BEAT_MS = 300;
const BEAT_MAX_SCALE = 1.6;
const TENSION_MAX_SCALE = 1;
const TENSION_SHAKE_PX = 3;
const TENSION_SHAKE_MIN_RATIO = 0.5;

const CLOCK_POINT_COUNT = 12;
const CLOCK_SLOTS_PER_POINT = 4;
const CLOCK_SLOT_COUNT = CLOCK_POINT_COUNT * CLOCK_SLOTS_PER_POINT;
const CLOCK_BAND_THICKNESS_PX = CELL_SIZE * 2;
const CLOCK_POINT_ARC_PX = CELL_SIZE * 8;
const CLOCK_STEP_MS = 1000;
const CLOCK_COLOR = "#ffd23f";
const CLOCK_RING_GAP_PX = CELL_SIZE * 1;
const CLOCK_POINT_SCALE = 1.3;

const GAP_WAVE_SPEED_PX_PER_MS = 0.6;
const GAP_WAVE_MAX_SCALE = 1.5;

// Snooze glyphs ride the same radial wave as the rest of the field (arrival
// scales with distance from center), so they light up as the wave passes
// through rather than on their own timer. Only a random subset ever lights —
// the rest stay dim — so the lit pattern still looks organic each pass.
const SNOOZE_IDLE_ALPHA = 0.3;
const SNOOZE_COLOR_RGB = "102, 255, 153";
const SNOOZE_SPIRAL_TIGHTNESS = 6;
const SNOOZE_SPIRAL_SECTOR_COUNT = 8;
const SNOOZE_PLAID_FREQ = 0.05;
// Wing outline as [t, radiusFactor] keyframes, t: 0 = tip, 1 = body/shoulder.
// Cosine-eased between points, so the curve visibly arcs from full span at
// the tip, dips inward hard at the wrist, then flares before closing at body.
const SNOOZE_WING_PROFILE = [
  [0, 1],
  [0.22, 0.95],
  [0.45, 0.5],
  [0.65, 0.78],
  [1, 0],
];
const SNOOZE_WING_JAG_FREQ = 40; // ripples along the trailing edge
const SNOOZE_WING_JAG_AMOUNT = 0.5;
const SNOOZE_SHAPE_COUNT = 3;

const CURRENCY_PLACEHOLDER = "¤";
const CURRENCY_SYMBOLS = ["€", "$", "£", "¥", "₹", "₩", "฿", "₴"];

const PRICEOVERVIEW_SAMPLE = `{
    "success": true,
    "lowest_price": "0,03${CURRENCY_PLACEHOLDER}",
    "volume": "435",
    "median_price": "0,01${CURRENCY_PLACEHOLDER}"
}`;

const PRICEHISTORY_SAMPLE = `{
  "success": true,
  "price_prefix": "",
  "price_suffix": "${CURRENCY_PLACEHOLDER}",
  "prices": [
    [
      "Jul 02 2014 01: +0",
      283.697,
      "2"
    ],
    [
      "May 19 2020 01: +0",
      1621.348,
      "1"
    ],
    [
      "Aug 13 2020 01: +0",
      1625.398,
      "1"
    ],
    [
      "Sep 28 2020 01: +0",
      1690.921,
      "1"
    ],
    [
      "Mar 16 2023 01: +0",
      1662.859,
      "1"
    ]
  ]
}`;

const ORDERSHISTOGRAM_SAMPLE = `{
    "success": 1,
    "sell_order_count": 0,
    "sell_order_price": null,
    "sell_order_table": null,
    "buy_order_count": "2",
    "buy_order_price": "0,03${CURRENCY_PLACEHOLDER}",
    "buy_order_table": [
        {
            "price": "0,03${CURRENCY_PLACEHOLDER}",
            "quantity": "2"
        }
    ],
    "highest_buy_order": "3",
    "lowest_sell_order": null,
    "buy_order_graph": [
        [
            0.03,
            2,
            "2 buy orders at 0,03${CURRENCY_PLACEHOLDER} or higher"
        ]
    ],
    "sell_order_graph": [],
    "graph_max_y": 2,
    "graph_min_x": 0.03,
    "graph_max_x": 0,
    "price_prefix": "",
    "price_suffix": "${CURRENCY_PLACEHOLDER}"
}`;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let glyphs = [];
let maxNormDist = 1;
let clockAngleTolerance = 0;
let clockBandOuterNorm = 0;
let clockAvgRadiusPx = 1;
let outsideRuns = [];
let lastOutsideCycleIndex = -1;
let snoozeShapeQueue = [];
let currentSnoozeShapeIndex = 0;
let lastSnoozeShapeCycleIndex = -1;
let ellipseRadiusX = 1;
let ellipseRadiusY = 1;
let clockBandInnerNorm = 0;
const OUTSIDE_SHIFT_TOKENS_PER_WAVE = 23;

const codeSources = { heart: [], clock: [], hex: [], ring: [], outside: [], snooze: [] };

function pickRandomChar() {
  return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

function stripPythonComments(text) {
  return text
    .replace(/"""[\s\S]*?"""/g, " ")
    .replace(/'''[\s\S]*?'''/g, " ")
    .replace(/#.*$/gm, "");
}

function extractGlyphTokens(text) {
  return stripPythonComments(text).match(/[A-Za-z_][A-Za-z0-9_]*|[0-9]+(?:\.[0-9]+)?|\S/g) || [];
}

codeSources.outside = extractGlyphTokens(
  `${PRICEOVERVIEW_SAMPLE} ${PRICEHISTORY_SAMPLE} ${ORDERSHISTOGRAM_SAMPLE}`
);

async function loadCodeSources() {
  codeSources.heart = extractGlyphTokens(CEREBRO_SRC);
  codeSources.clock = extractGlyphTokens(CLOCKWORK_SRC);
  codeSources.hex = extractGlyphTokens(SQLINSERTS_SRC + DATACLASSES_SRC);
  codeSources.ring = extractGlyphTokens(RATELIMITER_SRC);
  codeSources.snooze = extractGlyphTokens(SNOOZER_SRC);
}

function createTokenCursor(tokens) {
  return { tokens, ptr: 0, offset: 0 };
}

// Packs a run of `length` cells with whole tokens where they fit (e.g. "import"
// across 6 free cells), falling back to a mid-token char split only when a
// token is wider than the remaining run. Keeps region text in source order,
// wrapping a space between consecutive whole tokens for readability.
function fillRunFromCursor(cursor, cells, charField = "char", currField = "isCurrencySymbol") {
  const length = cells.length;
  if (!cursor.tokens.length) {
    for (let i = 0; i < length; i++) cells[i][charField] = pickRandomChar();
    return;
  }
  let i = 0;
  while (i < length) {
    if (cursor.ptr >= cursor.tokens.length) {
      cursor.ptr = 0;
      cursor.offset = 0;
    }
    const token = cursor.tokens[cursor.ptr];
    const remainingInToken = token.length - cursor.offset;
    const remainingInRun = length - i;

    if (cursor.offset === 0 && remainingInToken <= remainingInRun) {
      for (let k = 0; k < remainingInToken; k++) {
        cells[i + k][charField] = token[k];
        cells[i + k][currField] = token[k] === CURRENCY_PLACEHOLDER;
      }
      i += remainingInToken;
      cursor.ptr += 1;
      cursor.offset = 0;
      if (i < length) {
        cells[i][charField] = " ";
        i += 1;
      }
    } else {
      const take = Math.min(remainingInRun, remainingInToken);
      for (let k = 0; k < take; k++) {
        const c = token[cursor.offset + k];
        cells[i + k][charField] = c;
        cells[i + k][currField] = c === CURRENCY_PLACEHOLDER;
      }
      cursor.offset += take;
      i += take;
      if (cursor.offset >= token.length) {
        cursor.ptr += 1;
        cursor.offset = 0;
      }
    }
  }
}

function regionKeyOf(cell) {
  if (cell.isOnCircle) return "ring";
  if (cell.isInClockBand || cell.isInGapBand) return "clock";
  if (cell.isInHeart) return "heart";
  if (cell.isInHexFill) return "hex";
  if (cell.isOutsideCircle) return "outside";
  return "snooze";
}

function createGlyph(x, y, char, normDist, isOnCircle, isOutsideCircle, isInClockBand, isInGapBand, angle, isInHeart, isInHexFill, isCurrencySymbol, isSnooze, snoozeShapeLit) {
  return {
    x,
    y,
    char,
    normDist,
    isOnCircle,
    isOutsideCircle,
    isInClockBand,
    isInGapBand,
    angle,
    isInHeart,
    isInHexFill,
    isCurrencySymbol,
    isSnooze,
    snoozeShapeLit,
    // Outer-area ripple: "prev" is what's showing now, "next" is the upcoming
    // wave's content. drawGlyph swaps a glyph from prev to next the instant
    // this wave's outward pulse reaches it, so the text change rides the wave
    // outward instead of cutting over everywhere at once.
    charPrev: char,
    isCurrencySymbolPrev: isCurrencySymbol,
    charNext: char,
    isCurrencySymbolNext: isCurrencySymbol,
  };
}

function isPointInHeart(hx, hy) {
  const f = Math.pow(hx * hx + hy * hy - 1, 3) - HEART_DIP_FACTOR * hx * hx * hy * hy * hy;
  return f <= 0;
}

function computeHexagonBoundaryRadius(theta, circumradius) {
  const sector = Math.PI / 3;
  const halfSector = sector / 2;
  let a = ((theta % sector) + sector) % sector;
  a = Math.abs(a - halfSector);
  return (circumradius * Math.cos(halfSector)) / Math.cos(a);
}

function normalizeAngleDiff(diff) {
  return Math.atan2(Math.sin(diff), Math.cos(diff));
}

const REGION_INFO = {
  heart: {
    label: "Orchestrator",
    tooltip: "cerebro.py — coordinates every scheduler + rate limiter",
    detail: "The heart is the orchestrator (cerebro.py): backend entry point for the market tracker, spins up and coordinates every scheduler through one shared rate limiter.",
  },
  hex: {
    label: "Persistence Layer",
    tooltip: "Pydantic models + SQL inserts into Postgres/TimescaleDB",
    detail: "The hexagon is the persistence layer: Pydantic models (dataClasses.py) validate each API response shape, then SQLinserts.py routes them into Postgres/TimescaleDB tables.",
  },
  ring: {
    label: "Rate Limiter",
    tooltip: "Sliding-window log — blocks until a request slot frees up",
    detail: "The outer ring is the rate limiter (RateLimiter.py): a sliding-window log that makes acquire_token() wait until a slot inside the request window frees up. It shakes while holding callers back.",
  },
  clock: {
    label: "Clockwork Scheduler",
    tooltip: "Fixed hourly pull — price history at :30 past the hour",
    detail: "The clock band is the clockwork scheduler (clockworkScheduler.py): fires price-history calls at :30 past every UTC hour, matching Steam's own hourly update lag.",
  },
  snooze: {
    label: "Urgency Scheduler",
    tooltip: "snoozerScheduler.py — most overdue item runs first",
    detail: "Despite the name, this scheduler (snoozerScheduler.py) is the urgent one: it scores live items (price overview, order books) by how overdue they are and always runs the highest-urgency one first.",
  },
  outside: {
    label: "Market Data",
    tooltip: "Sample Steam Market API JSON responses",
    detail: "The outer field renders literal sample JSON from Steam's priceoverview, pricehistory, and ordershistogram endpoints — the raw shape of the data the system exists to move.",
  },
};

function computeRegionAtPoint(px, py) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const nx = (px - centerX) / ellipseRadiusX;
  const ny = (py - centerY) / ellipseRadiusY;
  const normDist = Math.hypot(nx, ny);
  const isOnCircle = Math.abs(normDist - 1) < CIRCLE_BAND_THICKNESS;
  const isOutsideCircle = normDist > 1 && !isOnCircle;
  const ringInnerEdge = 1 - CIRCLE_BAND_THICKNESS;
  const isInClockBand = !isOnCircle && normDist >= clockBandInnerNorm && normDist <= clockBandOuterNorm;
  const isInGapBand = !isOnCircle && normDist > clockBandOuterNorm && normDist < ringInnerEdge;
  const hx = (px - centerX) / HEART_SCALE_PX;
  const hy = -(py - centerY) / HEART_SCALE_PX;
  const isInHeart = isPointInHeart(hx, hy);
  const dx = px - centerX;
  const rawDy = py - centerY;
  const dy = rawDy + HEX_FILL_CENTER_OFFSET_Y_PX;
  const hexSx = dx;
  const hexSy = dy * (HEX_FILL_RADIUS_X_PX / HEX_FILL_RADIUS_Y_PX);
  const hexTheta = Math.atan2(hexSy, hexSx);
  const hexBoundary = computeHexagonBoundaryRadius(hexTheta, HEX_FILL_RADIUS_X_PX);
  const hexDist = Math.hypot(hexSx, hexSy);
  const isInHexFill = !isInHeart && hexDist <= hexBoundary;

  if (isOnCircle) return "ring";
  if (isInClockBand || isInGapBand) return "clock";
  if (isInHeart) return "heart";
  if (isInHexFill) return "hex";
  if (isOutsideCircle) return "outside";
  return "snooze";
}

function buildGlyphGrid() {
  glyphs = [];
  outsideRuns = [];
  lastOutsideCycleIndex = -1;
  snoozeShapeQueue = [];
  lastSnoozeShapeCycleIndex = -1;
  maxNormDist = 1;
  const usableWidth = canvas.width - EDGE_PADDING * 2;
  const usableHeight = canvas.height - EDGE_PADDING * 2;
  const cols = Math.floor(usableWidth / CELL_SIZE) + 1;
  const rows = Math.floor(usableHeight / CELL_SIZE) + 1;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  ellipseRadiusX = (canvas.width / 2) * CIRCLE_RADIUS_RATIO;
  ellipseRadiusY = (canvas.height / 2) * CIRCLE_RADIUS_RATIO;
  clockAvgRadiusPx = (ellipseRadiusX + ellipseRadiusY) / 2;
  const clockBandThicknessNorm = CLOCK_BAND_THICKNESS_PX / clockAvgRadiusPx;
  const clockRingGapNorm = CLOCK_RING_GAP_PX / clockAvgRadiusPx;
  const clockBandOuter = 1 - CIRCLE_BAND_THICKNESS - clockRingGapNorm;
  const clockBandInner = clockBandOuter - clockBandThicknessNorm;
  clockBandOuterNorm = clockBandOuter;
  clockBandInnerNorm = clockBandInner;
  clockAngleTolerance = CLOCK_POINT_ARC_PX / clockAvgRadiusPx / 2;

  const cursors = {
    ring: createTokenCursor(codeSources.ring),
    clock: createTokenCursor(codeSources.clock),
    heart: createTokenCursor(codeSources.heart),
    hex: createTokenCursor(codeSources.hex),
    outside: createTokenCursor(codeSources.outside),
    snooze: createTokenCursor(codeSources.snooze),
  };

  const snoozeSpiralSectorWidth = (2 * Math.PI) / SNOOZE_SPIRAL_SECTOR_COUNT;

  for (let row = 0; row < rows; row++) {
    const rowCells = [];
    for (let col = 0; col < cols; col++) {
      const x = EDGE_PADDING + col * CELL_SIZE + (Math.random() - 0.5) * JITTER_AMOUNT;
      const y = EDGE_PADDING + row * CELL_SIZE;
      const nx = (x + CELL_SIZE / 2 - centerX) / ellipseRadiusX;
      const ny = (y + CELL_SIZE / 2 - centerY) / ellipseRadiusY;
      const normDist = Math.hypot(nx, ny);
      const isOnCircle = Math.abs(normDist - 1) < CIRCLE_BAND_THICKNESS;
      const isOutsideCircle = normDist > 1 && !isOnCircle;
      const isInClockBand = !isOnCircle && normDist >= clockBandInner && normDist <= clockBandOuter;
      const ringInnerEdge = 1 - CIRCLE_BAND_THICKNESS;
      const isInGapBand = !isOnCircle && normDist > clockBandOuter && normDist < ringInnerEdge;
      const angle = Math.atan2(ny, nx);
      const hx = (x + CELL_SIZE / 2 - centerX) / HEART_SCALE_PX;
      const hy = -(y + CELL_SIZE / 2 - centerY) / HEART_SCALE_PX;
      const isInHeart = isPointInHeart(hx, hy);
      const dx = x + CELL_SIZE / 2 - centerX;
      const rawDy = y + CELL_SIZE / 2 - centerY;
      const dy = rawDy + HEX_FILL_CENTER_OFFSET_Y_PX;
      const hexSx = dx;
      const hexSy = dy * (HEX_FILL_RADIUS_X_PX / HEX_FILL_RADIUS_Y_PX);
      const hexTheta = Math.atan2(hexSy, hexSx);
      const hexBoundary = computeHexagonBoundaryRadius(hexTheta, HEX_FILL_RADIUS_X_PX);
      const hexDist = Math.hypot(hexSx, hexSy);
      const isInHexFill = !isInHeart && hexDist <= hexBoundary;

      const cell = {
        x, y, char: " ", normDist, isOnCircle, isOutsideCircle,
        isInClockBand, isInGapBand, angle, isInHeart, isInHexFill,
        isCurrencySymbol: false,
      };
      cell.regionKey = regionKeyOf(cell);
      cell.isSnooze = cell.regionKey === "snooze";
      cell.snoozeShapeLit = cell.isSnooze
        ? [
            // 1: archimedean spiral arms
            mod2(Math.floor((angle + normDist * SNOOZE_SPIRAL_TIGHTNESS) / snoozeSpiralSectorWidth)) === 0,
            // 2: plaid / lattice (sine product in pixel space)
            Math.sin(dx * SNOOZE_PLAID_FREQ) * Math.sin(rawDy * SNOOZE_PLAID_FREQ) > 0,
            // 3: owl wings (lemniscate lobes, wrist dip, jagged trailing edge)
            normDist < computeWingRadius(angle, ringInnerEdge),
          ]
        : null;
      rowCells.push(cell);
      maxNormDist = Math.max(maxNormDist, normDist);
    }

    const outsideRunBounds = [];
    let runStart = 0;
    while (runStart < rowCells.length) {
      const key = rowCells[runStart].regionKey;
      let runEnd = runStart + 1;
      while (runEnd < rowCells.length && rowCells[runEnd].regionKey === key) runEnd++;
      const run = rowCells.slice(runStart, runEnd);
      fillRunFromCursor(cursors[key], run);
      if (key === "outside") outsideRunBounds.push([runStart, runEnd]);
      runStart = runEnd;
    }

    const rowGlyphs = [];
    for (const cell of rowCells) {
      const glyph = createGlyph(cell.x, cell.y, cell.char, cell.normDist, cell.isOnCircle, cell.isOutsideCircle, cell.isInClockBand, cell.isInGapBand, cell.angle, cell.isInHeart, cell.isInHexFill, cell.isCurrencySymbol, cell.isSnooze, cell.snoozeShapeLit);
      rowGlyphs.push(glyph);
      glyphs.push(glyph);
    }
    for (const [s, e] of outsideRunBounds) {
      outsideRuns.push(rowGlyphs.slice(s, e));
    }
  }
}

// Re-reads the outer JSON area from a shifted starting point each wave cycle,
// so the whole outer field's text moves on, not just its currency symbol. The
// old "next" content (already fully revealed by last wave's pulse) becomes
// the new "prev" baseline; drawGlyph then reveals "next" per-glyph as this
// wave's pulse passes over it, so the swap rides the wave outward.
function refillOutsideRuns(cycleIndex) {
  for (const run of outsideRuns) {
    for (const glyph of run) {
      glyph.charPrev = glyph.charNext;
      glyph.isCurrencySymbolPrev = glyph.isCurrencySymbolNext;
    }
  }
  const tokens = codeSources.outside;
  if (!tokens.length) return;
  const cursor = createTokenCursor(tokens);
  cursor.ptr = (cycleIndex * OUTSIDE_SHIFT_TOKENS_PER_WAVE) % tokens.length;
  for (const run of outsideRuns) {
    fillRunFromCursor(cursor, run, "charNext", "isCurrencySymbolNext");
  }
}

function resizeCanvasToWindow() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  buildGlyphGrid();
}

function mod2(n) {
  return ((n % 2) + 2) % 2;
}

function sampleWingProfile(t) {
  const points = SNOOZE_WING_PROFILE;
  for (let i = 0; i < points.length - 1; i++) {
    const [t0, r0] = points[i];
    const [t1, r1] = points[i + 1];
    if (t <= t1 || i === points.length - 2) {
      const localT = t1 === t0 ? 0 : Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
      const eased = (1 - Math.cos(localT * Math.PI)) / 2;
      return r0 + (r1 - r0) * eased;
    }
  }
  return points[points.length - 1][1];
}

function computeWingRadius(angle, span) {
  const foldedAngle = Math.min(Math.abs(angle), Math.PI - Math.abs(angle)); // 0 at tip, PI/2 at body
  const t = foldedAngle / (Math.PI / 2);
  let r = span * sampleWingProfile(t);

  // flight-feather jag on the bottom/trailing edge only
  if (Math.sin(angle) > 0) {
    const phase = (angle * SNOOZE_WING_JAG_FREQ) / (2 * Math.PI);
    const triangleWave = Math.abs(2 * (phase - Math.floor(phase + 0.5)));
    r *= 1 - SNOOZE_WING_JAG_AMOUNT * (1 - triangleWave);
  }

  return r;
}

function getActiveSnoozeShapeIndex(cycleIndex) {
  if (cycleIndex === lastSnoozeShapeCycleIndex) {
    return currentSnoozeShapeIndex;
  }
  lastSnoozeShapeCycleIndex = cycleIndex;

  if (snoozeShapeQueue.length === 0) {
    snoozeShapeQueue = Array.from({ length: SNOOZE_SHAPE_COUNT }, (_, i) => i);
    for (let i = snoozeShapeQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [snoozeShapeQueue[i], snoozeShapeQueue[j]] = [snoozeShapeQueue[j], snoozeShapeQueue[i]];
    }
    if (snoozeShapeQueue[0] === currentSnoozeShapeIndex) {
      [snoozeShapeQueue[0], snoozeShapeQueue[1]] = [snoozeShapeQueue[1], snoozeShapeQueue[0]];
    }
  }

  currentSnoozeShapeIndex = snoozeShapeQueue.shift();
  return currentSnoozeShapeIndex;
}

function computeBeatEase(sinceArrivalMs) {
  if (sinceArrivalMs < 0 || sinceArrivalMs >= BEAT_MS) {
    return 0;
  }
  return Math.pow(Math.sin((sinceArrivalMs / BEAT_MS) * Math.PI), 2);
}

function computeGlyphState(glyph, cycleTimeMs, cycleMs, cycleIndex) {
  const releaseStartMs = INNER_TRAVEL_MS + TENSION_MS;

  if (glyph.isOnCircle) {
    const arrivalMs = INNER_TRAVEL_MS;
    if (cycleTimeMs < arrivalMs) {
      return { scale: 1, alpha: 1, shakeX: 0, shakeY: 0 };
    }
    if (cycleTimeMs < releaseStartMs) {
      const tensionProgress = (cycleTimeMs - arrivalMs) / TENSION_MS;
      const scale = 1 + tensionProgress * (TENSION_MAX_SCALE - 1);
      const shakeAmount = (TENSION_SHAKE_MIN_RATIO + (1 - TENSION_SHAKE_MIN_RATIO) * tensionProgress) * TENSION_SHAKE_PX;
      return {
        scale,
        alpha: 1,
        shakeX: (Math.random() - 0.5) * 2 * shakeAmount,
        shakeY: (Math.random() - 0.5) * 2 * shakeAmount,
      };
    }
    return { scale: 1, alpha: 1, shakeX: 0, shakeY: 0 };
  }

  if (glyph.isOutsideCircle) {
    const arrivalMs = releaseStartMs + (glyph.normDist - 1) * INNER_TRAVEL_MS;
    const ease = computeBeatEase(cycleTimeMs - arrivalMs);
    return {
      scale: 1 + ease * (BEAT_MAX_SCALE - 1),
      alpha: DIM_ALPHA + ease * (1 - DIM_ALPHA),
      shakeX: 0,
      shakeY: 0,
      hasArrived: cycleTimeMs >= arrivalMs,
    };
  }

  if (glyph.isInHeart) {
    const ease = computeBeatEase(cycleTimeMs);
    return { scale: HEART_BASE_SCALE + ease * (BEAT_MAX_SCALE - 1), alpha: 1, shakeX: 0, shakeY: 0 };
  }

  if (glyph.isInHexFill) {
    // Persistence layer only fires once data's actually landed — sync its
    // beat to the outside layer's arrival (releaseStartMs), not the inward wave.
    const ease = computeBeatEase(cycleTimeMs - releaseStartMs);
    return { scale: 1 + ease * (BEAT_MAX_SCALE - 1), alpha: 1, shakeX: 0, shakeY: 0 };
  }

  if (glyph.isSnooze) {
    const shapeIndex = getActiveSnoozeShapeIndex(cycleIndex);
    const isLitThisCycle = glyph.snoozeShapeLit[shapeIndex];
    if (!isLitThisCycle) {
      return { scale: 1, alpha: SNOOZE_IDLE_ALPHA, shakeX: 0, shakeY: 0 };
    }
    const arrivalMs = glyph.normDist * INNER_TRAVEL_MS;
    let sinceArrivalMs = cycleTimeMs - arrivalMs;
    if (sinceArrivalMs < 0) sinceArrivalMs += cycleMs;

    let ease;
    if (sinceArrivalMs < BEAT_MS) {
      // quick rise to peak
      ease = Math.sin((sinceArrivalMs / BEAT_MS) * (Math.PI / 2));
    } else {
      // slow dim back down until next wave arrives
      const decayMs = cycleMs - BEAT_MS;
      const decayProgress = (sinceArrivalMs - BEAT_MS) / decayMs;
      ease = (Math.cos(decayProgress * Math.PI) + 1) / 2;
    }

    return {
      scale: 1 + ease * (BEAT_MAX_SCALE - 1),
      alpha: SNOOZE_IDLE_ALPHA + ease * (1 - SNOOZE_IDLE_ALPHA),
      shakeX: 0,
      shakeY: 0,
    };
  }

  const arrivalMs = glyph.normDist * INNER_TRAVEL_MS;
  const ease = computeBeatEase(cycleTimeMs - arrivalMs);
  return { scale: 1 + ease * (BEAT_MAX_SCALE - 1), alpha: 1, shakeX: 0, shakeY: 0 };
}

function isGlyphOnLitClockPoint(glyph, activeAngles) {
  if (!glyph.isInClockBand) {
    return false;
  }
  for (const targetAngle of activeAngles) {
    if (Math.abs(normalizeAngleDiff(glyph.angle - targetAngle)) < clockAngleTolerance) {
      return true;
    }
  }
  return false;
}

function computeActiveClockAngles(elapsedMs) {
  const slotIndex = Math.floor(elapsedMs / CLOCK_STEP_MS) % CLOCK_SLOT_COUNT;
  const anglePerSlot = (Math.PI * 2) / CLOCK_SLOT_COUNT;
  const angles = [];
  for (let k = 0; k < CLOCK_POINT_COUNT; k++) {
    const pointBaseSlot = k * CLOCK_SLOTS_PER_POINT;
    angles.push(-Math.PI / 2 + (pointBaseSlot + slotIndex) * anglePerSlot);
  }
  return angles;
}

function isGlyphAlignedWithClockPoint(glyph, activeAngles) {
  for (const targetAngle of activeAngles) {
    if (Math.abs(normalizeAngleDiff(glyph.angle - targetAngle)) < clockAngleTolerance) {
      return true;
    }
  }
  return false;
}

function computeGapWaveScale(glyph, tickTimeMs, activeAngles, isTriggerSlot) {
  if (!isTriggerSlot || !isGlyphAlignedWithClockPoint(glyph, activeAngles)) {
    return 1;
  }
  const radialDistPx = Math.max(0, glyph.normDist - clockBandOuterNorm) * clockAvgRadiusPx;
  const arrivalMs = radialDistPx / GAP_WAVE_SPEED_PX_PER_MS;
  const ease = computeBeatEase(tickTimeMs - arrivalMs);
  return 1 + ease * (GAP_WAVE_MAX_SCALE - 1);
}

// The clock points' mini-wave keeps traveling outward past the gap band; when
// it reaches the ring it shakes the aligned ring glyphs the same way the big
// wave's tension phase does.
function computeClockRingShake(glyph, tickTimeMs, activeAngles, isTriggerSlot) {
  if (!isTriggerSlot || !isGlyphAlignedWithClockPoint(glyph, activeAngles)) {
    return { shakeX: 0, shakeY: 0 };
  }
  const radialDistPx = Math.max(0, glyph.normDist - clockBandOuterNorm) * clockAvgRadiusPx;
  const arrivalMs = radialDistPx / GAP_WAVE_SPEED_PX_PER_MS;
  const ease = computeBeatEase(tickTimeMs - arrivalMs);
  const shakeAmount = ease * TENSION_SHAKE_PX;
  return {
    shakeX: (Math.random() - 0.5) * 2 * shakeAmount,
    shakeY: (Math.random() - 0.5) * 2 * shakeAmount,
  };
}

function currencySymbolAtCycle(cycleIndex) {
  const len = CURRENCY_SYMBOLS.length;
  return CURRENCY_SYMBOLS[((cycleIndex % len) + len) % len];
}

function drawGlyph(glyph, state, activeAngles, tickTimeMs, isTriggerSlot, cycleIndex) {
  let scale = state.scale;
  let shakeX = state.shakeX;
  let shakeY = state.shakeY;
  let char;
  if (glyph.isOutsideCircle) {
    const useNext = state.hasArrived;
    const isCurrency = useNext ? glyph.isCurrencySymbolNext : glyph.isCurrencySymbolPrev;
    if (isCurrency) {
      char = currencySymbolAtCycle(useNext ? cycleIndex : cycleIndex - 1);
    } else {
      char = useNext ? glyph.charNext : glyph.charPrev;
    }
  } else {
    char = glyph.isCurrencySymbol ? currencySymbolAtCycle(cycleIndex) : glyph.char;
  }
  if (glyph.isOnCircle) {
    ctx.fillStyle = CIRCLE_COLOR;
    const clockPulse = computeClockRingShake(glyph, tickTimeMs, activeAngles, isTriggerSlot);
    shakeX += clockPulse.shakeX;
    shakeY += clockPulse.shakeY;
  } else if (isGlyphOnLitClockPoint(glyph, activeAngles)) {
    ctx.fillStyle = CLOCK_COLOR;
    scale = CLOCK_POINT_SCALE;
  } else if (glyph.isInGapBand) {
    ctx.fillStyle = "#ffffff";
    scale = computeGapWaveScale(glyph, tickTimeMs, activeAngles, isTriggerSlot);
  } else if (glyph.isInHeart) {
    ctx.fillStyle = HEART_COLOR;
  } else if (glyph.isInHexFill) {
    ctx.fillStyle = HEX_FILL_COLOR;
  } else if (glyph.isSnooze) {
    ctx.fillStyle = `rgba(${SNOOZE_COLOR_RGB}, ${state.alpha})`;
  } else {
    ctx.fillStyle = `rgba(255, 255, 255, ${state.alpha})`;
  }

  const drawX = glyph.x + shakeX;
  const drawY = glyph.y + shakeY;

  if (scale === 1) {
    ctx.fillText(char, drawX, drawY);
    return;
  }
  const centerX = drawX + CELL_SIZE / 2;
  const centerY = drawY + CELL_SIZE / 2;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);
  ctx.fillText(char, drawX, drawY);
  ctx.restore();
}

function drawGlyphGrid(elapsedMs) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = `${FONT_SIZE}px monospace`;
  ctx.textBaseline = "top";

  const releaseStartMs = INNER_TRAVEL_MS + TENSION_MS;
  const outerTravelMs = Math.max(0, maxNormDist - 1) * INNER_TRAVEL_MS;
  const cycleMs = releaseStartMs + outerTravelMs + REST_GAP_MS;
  const cycleTimeMs = elapsedMs % cycleMs;
  const cycleIndex = Math.floor(elapsedMs / cycleMs);
  if (cycleIndex !== lastOutsideCycleIndex) {
    lastOutsideCycleIndex = cycleIndex;
    refillOutsideRuns(cycleIndex);
  }
  const activeAngles = computeActiveClockAngles(elapsedMs);
  const tickTimeMs = elapsedMs % CLOCK_STEP_MS;
  const slotIndex = Math.floor(elapsedMs / CLOCK_STEP_MS) % CLOCK_SLOT_COUNT;
  const isTriggerSlot = slotIndex === 0 || slotIndex === CLOCK_SLOT_COUNT / 2;

  for (const glyph of glyphs) {
    const state = computeGlyphState(glyph, cycleTimeMs, cycleMs, cycleIndex);
    drawGlyph(glyph, state, activeAngles, tickTimeMs, isTriggerSlot, cycleIndex);
  }
}

function runAnimationLoop(now) {
  drawGlyphGrid(now);
  requestAnimationFrame(runAnimationLoop);
}

const tooltipEl = document.getElementById("tooltip");
const infoBtn = document.getElementById("infoBtn");
const infoPanel = document.getElementById("infoPanel");
const closeInfoBtn = document.getElementById("closeInfoBtn");
const infoPanelContent = document.getElementById("infoPanelContent");

infoPanelContent.innerHTML = Object.values(REGION_INFO)
  .map(
    (info) =>
      `<div class="region-entry"><span class="region-label">${info.label}</span><span class="region-detail">${info.detail}</span></div>`
  )
  .join("");

canvas.addEventListener("mousemove", (e) => {
  const region = computeRegionAtPoint(e.clientX, e.clientY);
  const info = REGION_INFO[region];
  tooltipEl.innerHTML = `<span class="tooltip-label">${info.label}</span>${info.tooltip}`;
  tooltipEl.style.left = `${e.clientX + 16}px`;
  tooltipEl.style.top = `${e.clientY + 16}px`;
  tooltipEl.classList.remove("hidden");
});

canvas.addEventListener("mouseleave", () => {
  tooltipEl.classList.add("hidden");
});

infoBtn.addEventListener("click", () => {
  infoPanel.classList.toggle("hidden");
});

closeInfoBtn.addEventListener("click", () => {
  infoPanel.classList.add("hidden");
});

window.addEventListener("resize", resizeCanvasToWindow);
resizeCanvasToWindow();
requestAnimationFrame(runAnimationLoop);
loadCodeSources().then(resizeCanvasToWindow).catch(console.error);
