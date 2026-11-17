// Cloud Cat Weather - Scriptable widget
// Shows a cat dressed for the weather where you are now.
// Unit: widget parameter "C" or "F" overrides; otherwise tap the widget to switch.

const UNIT_KEY = "cloudcat_unit";
const CACHE = "cloudcat_cache.json";
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE);

// ---------- unit ----------
function getUnit() {
  const p = (args.widgetParameter || "").trim().toUpperCase();
  if (p === "C" || p === "F") return p;
  return Keychain.contains(UNIT_KEY) ? Keychain.get(UNIT_KEY) : "C";
}
const toUnit = (c, u) => Math.round(u === "F" ? c * 9 / 5 + 32 : c);

// ---------- data ----------
async function loadWeather() {
  try {
    Location.setAccuracyToThreeKilometers();
    const loc = await Location.current();
    let city = "Here";
    try {
      const g = await Location.reverseGeocode(loc.latitude, loc.longitude);
      city = (g[0] && (g[0].locality || g[0].administrativeArea)) || city;
    } catch (e) {}
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + loc.latitude +
      "&longitude=" + loc.longitude +
      "&current=temperature_2m,weather_code,is_day&timezone=auto";
    const j = await new Request(url).loadJSON();
    const w = {
      tempC: j.current.temperature_2m,
      code: j.current.weather_code,
      day: j.current.is_day === 1,
      city,
      at: Date.now()
    };
    fm.writeString(cachePath, JSON.stringify(w));
    return w;
  } catch (e) {
    if (fm.fileExists(cachePath)) return JSON.parse(fm.readString(cachePath));
    return null;
  }
}

function kind(code) {
  if (code >= 95) return "storm";
  if ([71,73,75,77,85,86].includes(code)) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 45 || code === 48) return "fog";
  if (code === 0 || code === 1) return "clear";
  return "cloud";
}
const LABEL = { storm: "Stormy", snow: "Snowy", rain: "Rainy", fog: "Foggy", clear: "Clear", cloud: "Cloudy" };

// ---------- cat drawing ----------
function col(h) { return new Color(h); }
function tri(ctx, a, b, c, color) {
  const p = new Path();
  p.move(new Point(a[0], a[1])); p.addLine(new Point(b[0], b[1])); p.addLine(new Point(c[0], c[1]));
  p.closeSubpath(); ctx.addPath(p); ctx.setFillColor(color); ctx.fillPath();
}
function ell(ctx, x, y, w, h, color) { ctx.setFillColor(color); ctx.fillEllipse(new Rect(x, y, w, h)); }

function drawCat(w) {
  const k = kind(w.code), cold = w.tempC <= 5, hot = w.tempC >= 28, night = !w.day;
  const ctx = new DrawContext();
  ctx.size = new Size(300, 300);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const fur = col("#F4A950"), dark = col("#C97B1E"), light = col("#FFF1DC");

  // tail + body
  ell(ctx, 195, 180, 80, 28, fur);
  ell(ctx, 85, 160, 130, 120, fur);
  ell(ctx, 120, 200, 60, 70, light);
  // raincoat for rain/storm
  if (k === "rain" || k === "storm") {
    ell(ctx, 80, 165, 140, 115, col("#F2D13B"));
    ell(ctx, 143, 215, 14, 14, col("#8A6D00"));
    ell(ctx, 143, 245, 14, 14, col("#8A6D00"));
  }
  // paws
  ell(ctx, 100, 262, 40, 26, light); ell(ctx, 160, 262, 40, 26, light);

  // ears
  tri(ctx, [82, 100], [95, 30], [140, 78], fur);
  tri(ctx, [218, 100], [205, 30], [160, 78], fur);
  tri(ctx, [97, 85], [102, 52], [124, 76], col("#F7B6B6"));
  tri(ctx, [203, 85], [198, 52], [176, 76], col("#F7B6B6"));
  // head
  ell(ctx, 70, 60, 160, 135, fur);
  // cheeks
  ell(ctx, 100, 140, 100, 50, light);

  // eyes
  if (night || k === "fog") {
    ctx.setStrokeColor(col("#3B2A12")); ctx.setLineWidth(5);
    for (const x of [112, 172]) {
      const p = new Path(); p.move(new Point(x, 118)); p.addQuadCurve(new Point(x + 26, 118), new Point(x + 13, 134));
      ctx.addPath(p); ctx.strokePath();
    }
  } else if (!(hot && k === "clear")) {
    ell(ctx, 112, 102, 26, 32, col("#3B2A12")); ell(ctx, 172, 102, 26, 32, col("#3B2A12"));
    ell(ctx, 120, 108, 9, 9, col("#FFFFFF")); ell(ctx, 180, 108, 9, 9, col("#FFFFFF"));
  }
  // nose + mouth + whiskers
  tri(ctx, [141, 143], [159, 143], [150, 155], col("#E27C7C"));
  ctx.setStrokeColor(col("#3B2A12")); ctx.setLineWidth(3);
  let m = new Path(); m.move(new Point(150, 155)); m.addQuadCurve(new Point(128, 163), new Point(144, 174));
  m.move(new Point(150, 155)); m.addQuadCurve(new Point(172, 163), new Point(156, 174));
  ctx.addPath(m); ctx.strokePath();
  for (const dy of [-6, 6]) {
    let wp = new Path();
    wp.move(new Point(112, 152)); wp.addLine(new Point(62, 152 + dy * 2));
    wp.move(new Point(188, 152)); wp.addLine(new Point(238, 152 + dy * 2));
    ctx.addPath(wp); ctx.strokePath();
  }

  // sunglasses
  if (hot && k === "clear" && !night) {
    ell(ctx, 100, 98, 48, 38, col("#1C1C1C")); ell(ctx, 162, 98, 48, 38, col("#1C1C1C"));
    ctx.setFillColor(col("#1C1C1C")); ctx.fillRect(new Rect(146, 110, 18, 5));
  }
  // scarf (cold or snow)
  if (cold || k === "snow") {
    ctx.setFillColor(col("#D94F4F")); ctx.fillRect(new Rect(95, 182, 110, 24));
    ctx.fillRect(new Rect(170, 200, 26, 52));
    ctx.setFillColor(col("#B53A3A")); ctx.fillRect(new Rect(170, 238, 26, 6));
  }
  // beanie for snow
  if (k === "snow") {
    let b = new Path(); b.move(new Point(84, 92)); b.addQuadCurve(new Point(216, 92), new Point(150, 10)); b.closeSubpath();
    ctx.addPath(b); ctx.setFillColor(col("#4F7FD9")); ctx.fillPath();
    ctx.fillRect(new Rect(84, 86, 132, 16));
    ell(ctx, 138, 16, 24, 24, col("#FFFFFF"));
  }
  // umbrella for rain / storm
  if (k === "rain" || k === "storm") {
    let u = new Path(); u.move(new Point(20, 62)); u.addQuadCurve(new Point(280, 62), new Point(150, -40)); u.closeSubpath();
    ctx.addPath(u); ctx.setFillColor(col(k === "storm" ? "#5A4FCF" : "#E2506B")); ctx.fillPath();
    ctx.setFillColor(col("#6B6B6B")); ctx.fillRect(new Rect(148, 56, 4, 40));
  }
  // moon
  if (night) { ell(ctx, 235, 20, 40, 40, col("#FFF3B0")); ell(ctx, 247, 14, 38, 38, col("#1F2A44")); }
  return ctx.getImage();
}

// ---------- widget ----------
const BG = {
  clear: ["#5BB8F5", "#B6E3FF"], cloud: ["#8FA3B8", "#C9D4DF"], rain: ["#52657A", "#8AA0B5"],
  storm: ["#3A3F5C", "#6A708F"], snow: ["#9BB8D6", "#EAF3FB"], fog: ["#A8B0B8", "#D8DDE1"]
};

async function build(w) {
  const wd = new ListWidget();
  if (!w) {
    wd.backgroundColor = col("#8FA3B8");
    const t = wd.addText("Cat can't find you. Allow location for Scriptable.");
    t.font = Font.boldSystemFont(13); t.textColor = Color.white();
    return wd;
  }
  const u = getUnit(), k = kind(w.code);
  let [c1, c2] = BG[k];
  if (!w.day) { c1 = "#1F2A44"; c2 = "#3A4A70"; }
  const g = new LinearGradient();
  g.colors = [col(c1), col(c2)]; g.locations = [0, 1];
  g.startPoint = new Point(0, 0); g.endPoint = new Point(1, 1);
  wd.backgroundGradient = g;
  wd.setPadding(10, 10, 10, 10);
  wd.url = URLScheme.forRunningScript();

  const family = config.widgetFamily || (config.runsInWidget ? "small" : "medium");
  const cat = drawCat(w);
  const text = (stack, s, size, bold) => {
    const t = stack.addText(s);
    t.font = bold ? Font.boldRoundedSystemFont(size) : Font.mediumRoundedSystemFont(size);
    t.textColor = Color.white(); t.shadowColor = new Color("#000000", 0.25); t.shadowRadius = 2;
    t.lineLimit = 1; t.minimumScaleFactor = 0.6;
    return t;
  };

  if (family === "medium" || family === "large") {
    const row = wd.addStack(); row.centerAlignContent();
    const im = row.addImage(cat); im.imageSize = new Size(110, 110);
    row.addSpacer(8);
    const col2 = row.addStack(); col2.layoutVertically();
    text(col2, toUnit(w.tempC, u) + "°" + u, 40, true);
    text(col2, LABEL[k], 16, false);
    text(col2, w.city, 13, false);
  } else {
    const im = wd.addImage(cat); im.imageSize = new Size(88, 88); im.centerAlignImage();
    const row = wd.addStack(); row.centerAlignContent();
    text(row, toUnit(w.tempC, u) + "°" + u, 24, true);
    row.addSpacer(6);
    const s = row.addStack(); s.layoutVertically();
    text(s, LABEL[k], 11, false); text(s, w.city, 10, false);
  }
  wd.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000);
  return wd;
}

// ---------- run ----------
const weather = await loadWeather();
if (config.runsInWidget) {
  Script.setWidget(await build(weather));
} else {
  // tapped / run in app: offer unit switch, then preview
  const a = new Alert();
  a.title = "Cloud Cat Weather";
  a.message = "Current unit: °" + getUnit() + " (a widget parameter C or F overrides this)";
  a.addAction("Use °C"); a.addAction("Use °F"); a.addCancelAction("Keep");
  const i = await a.presentSheet();
  if (i === 0) Keychain.set(UNIT_KEY, "C");
  if (i === 1) Keychain.set(UNIT_KEY, "F");
  (await build(weather)).presentMedium();
}
Script.complete();
