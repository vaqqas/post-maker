/* ------------------------------------------------------------------ *
 * Postmaker — main application logic
 * ------------------------------------------------------------------ */

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1350;
const STORAGE_KEY = "postmaker.state.v1";

/*
 * Predefined title options. Hindi and Urdu are counterparts by index, so the
 * nth Hindi title pairs with the nth Urdu title. The title inputs are
 * comboboxes (datalist): picking the nth option in one language auto-fills the
 * nth option in the other; free-text is also allowed (no sync then).
 */
const TITLE_OPTIONS = {
  hindi: ["ग़ज़ल", "नज़्म", "क़िता", "शेर", "दोहा"],
  urdu: ["غزل", "نظم", "قطعہ", "شعر", "دوہا"],
};

/*
 * The six text elements. `key` matches both the generated input ids and the
 * layout cell id in index.html (e.g. key "hindiTitle" -> #hindiTitle cell).
 * `fmt` holds the default formatting for that element.
 */
const ELEMENTS = [
  { key: "hindiTitle",     lang: "hindi", label: "Hindi Title",     multiline: false, defaultText: TITLE_OPTIONS.hindi[0], fmt: { size: 36, bold: false, italic: false } },
  { key: "hindiBody",      lang: "hindi", label: "Hindi Body",      multiline: true,  defaultText: "",                    fmt: { size: 36, bold: false, italic: false } },
  { key: "hindiSignature", lang: "hindi", label: "Hindi Signature", multiline: false, defaultText: "वक़्क़ास 'सिफ़र'",   fmt: { size: 36, bold: false, italic: false } },
  { key: "urduTitle",      lang: "urdu",  label: "Urdu Title",      multiline: false, defaultText: TITLE_OPTIONS.urdu[0],  fmt: { size: 36, bold: false, italic: false } },
  { key: "urduBody",       lang: "urdu",  label: "Urdu Body",       multiline: true,  defaultText: "",                    fmt: { size: 36, bold: false, italic: false } },
  { key: "urduSignature",  lang: "urdu",  label: "Urdu Signature",  multiline: false, defaultText: "وَقَّاص  صِفر",       fmt: { size: 36, bold: false, italic: false } },
];

// --- Kasheeda (tatweel) ------------------------------------------------
// Kasheeda elongates the connection between two joined letters by inserting
// U+0640 (tatweel). It can only go after a letter that joins to the LEFT, and
// before a letter that joins to the RIGHT.
const KASHIDA = "ـ";

// Right-joining-only letters: they do NOT connect to the following letter, so
// no kasheeda may be added after them (alif/dal/re/waw/yeh-barree families,
// plus isolated hamza).
const NON_CONNECTORS = new Set([
  "ا", "آ", "أ", "إ", "ٱ", "ٲ", "ٳ",
  "د", "ذ", "ڈ", "ډ", "ڊ",
  "ر", "ز", "ڑ", "ژ", "ڙ",
  "و", "ؤ", "ۇ", "ۆ", "ۈ", "ۉ", "ۋ",
  "ے", "ۓ",
  "ء",
]);

function isArabicLetter(ch) {
  const c = ch.codePointAt(0);
  if (c < 0x0620 || c > 0x06ff) return false;
  if (c >= 0x064b && c <= 0x065f) return false; // harakat
  if (c === 0x0640) return false; // tatweel itself
  if (c === 0x0670) return false; // superscript alef
  if (c >= 0x06d6 && c <= 0x06ed) return false; // Qur'anic marks
  return true;
}

function isDiacritic(ch) {
  const c = ch.codePointAt(0);
  return (
    (c >= 0x064b && c <= 0x065f) ||
    c === 0x0670 ||
    (c >= 0x06d6 && c <= 0x06ed)
  );
}

// Insert a kasheeda at every valid join. Diacritics stay attached to their base
// letter (the kasheeda goes before the *next* base letter, after any marks);
// spaces/punctuation break the run.
function addKasheeda(text) {
  let out = "";
  let prevBase = null;
  for (const c of Array.from(text)) {
    if (isArabicLetter(c)) {
      if (prevBase && !NON_CONNECTORS.has(prevBase) && c !== "ء") out += KASHIDA;
      out += c;
      prevBase = c;
    } else if (isDiacritic(c)) {
      out += c; // attaches to prevBase; keep the join state
    } else {
      out += c;
      prevBase = null; // space / punctuation / other ends the run
    }
  }
  return out;
}

// Urdu text as it should be rendered: with kasheeda when the option is on.
function urduText(raw) {
  return els.kasheedaInput.checked ? addKasheeda(raw) : raw;
}

// Default font family per language (falls back to the first manifest entry).
const DEFAULT_FONT = {
  hindi: "Eczar",
  urdu: "Noto Nastaliq Urdu",
};

// Static element references (the dynamic ones are looked up per element).
const els = {
  form: document.getElementById("postForm"),
  generateBtn: document.getElementById("generateBtn"),
  hindiInputs: document.getElementById("hindiInputs"),
  urduInputs: document.getElementById("urduInputs"),
  hindiFontSelect: document.getElementById("hindiFontSelect"),
  urduFontSelect: document.getElementById("urduFontSelect"),
  topMarginInput: document.getElementById("topMarginInput"),
  allSizeInput: document.getElementById("allSizeInput"),
  allSizeBtn: document.getElementById("allSizeBtn"),
  bgImageInput: document.getElementById("bgImageInput"),
  bgClearBtn: document.getElementById("bgClearBtn"),
  bgModeInput: document.getElementById("bgModeInput"),
  hindiEnabled: document.getElementById("hindiEnabled"),
  urduEnabled: document.getElementById("urduEnabled"),
  kasheedaInput: document.getElementById("kasheedaInput"),
  debugBordersInput: document.getElementById("debugBordersInput"),
  debugLegend: document.getElementById("debugLegend"),

  frame: document.getElementById("mainFrame"),
  frameWrapper: document.getElementById("frameWrapper"),
  bodyWarning: document.getElementById("bodyWarning"),

  pageNav: document.getElementById("pageNav"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageIndicator: document.getElementById("pageIndicator"),

  resultArea: document.getElementById("resultArea"),
  resultImages: document.getElementById("resultImages"),
  downloadAllBtn: document.getElementById("downloadAllBtn"),
};

// Per-element control handles, filled in by buildInputs().
const controls = {}; // key -> { text, size, bold, italic }

// --- build the input form dynamically ----------------------------------
function buildInputs() {
  ELEMENTS.forEach((el) => {
    const wrapper = document.createElement("div");
    wrapper.className = "mb-3";

    const label = document.createElement("label");
    label.className = "form-label";
    label.setAttribute("for", `${el.key}Input`);
    label.textContent = el.label;
    wrapper.appendChild(label);

    // text input / textarea
    const text = el.multiline
      ? document.createElement("textarea")
      : document.createElement("input");
    text.className = "form-control";
    text.id = `${el.key}Input`;
    if (el.multiline) text.rows = 4;
    else text.type = "text";
    if (el.lang === "urdu") text.dir = "rtl";
    wrapper.appendChild(text);

    // Title fields are comboboxes: a datalist of predefined titles, plus the
    // ability to type custom text.
    const isTitle = el.key === "hindiTitle" || el.key === "urduTitle";
    if (isTitle) {
      const dl = document.createElement("datalist");
      dl.id = `${el.key}List`;
      TITLE_OPTIONS[el.lang].forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v;
        dl.appendChild(opt);
      });
      text.setAttribute("list", dl.id);
      wrapper.appendChild(dl);
    }

    // formatting row: size + bold + italic
    const fmtRow = document.createElement("div");
    fmtRow.className = "fmt-controls";

    const sizeLabel = document.createElement("span");
    sizeLabel.className = "fmt-size-label";
    sizeLabel.textContent = "Size";

    const size = document.createElement("input");
    size.type = "number";
    size.min = "8";
    size.max = "200";
    size.className = "form-control form-control-sm fmt-size";
    size.id = `${el.key}Size`;

    const bold = document.createElement("button");
    bold.type = "button";
    bold.className = "btn btn-sm btn-outline-secondary fmt-bold";
    bold.textContent = "B";
    bold.title = "Bold";
    bold.setAttribute("aria-pressed", "false");

    const italic = document.createElement("button");
    italic.type = "button";
    italic.className = "btn btn-sm btn-outline-secondary fmt-italic";
    italic.textContent = "I";
    italic.title = "Italic";
    italic.setAttribute("aria-pressed", "false");

    fmtRow.append(sizeLabel, size);

    // The Urdu signature is the one element whose line width is settable: it
    // is stretched (justified) to fill that width. Blank = match the Hindi
    // signature automatically. See urduSignatureWidth().
    const hasWidth = el.key === "urduSignature";
    let width = null;
    if (hasWidth) {
      const widthLabel = document.createElement("span");
      widthLabel.className = "fmt-size-label";
      widthLabel.textContent = "Width";

      width = document.createElement("input");
      width.type = "number";
      width.min = "0";
      width.max = "880";
      width.placeholder = "auto";
      width.className = "form-control form-control-sm fmt-size";
      width.id = `${el.key}Width`;
      width.title =
        "Signature line width in px. Leave blank to match the Hindi signature.";

      fmtRow.append(widthLabel, width);
    }

    // Both bodies get a `Height` box: it pins the height of each body row.
    // Blank = auto, the measured natural line height of the chosen font.
    // See fontRowHeight() / langRowHeight().
    const hasHeight = el.key === "hindiBody" || el.key === "urduBody";
    let height = null;
    if (hasHeight) {
      const heightLabel = document.createElement("span");
      heightLabel.className = "fmt-size-label";
      heightLabel.textContent = "Height";

      height = document.createElement("input");
      height.type = "number";
      height.min = "0";
      height.max = "600";
      height.placeholder = "auto";
      height.className = "form-control form-control-sm fmt-size";
      height.id = `${el.key}Height`;
      height.title =
        "Body line height in px. Leave blank to fit the font automatically.";

      fmtRow.append(heightLabel, height);
    }

    fmtRow.append(bold, italic);
    wrapper.appendChild(fmtRow);

    (el.lang === "hindi" ? els.hindiInputs : els.urduInputs).appendChild(wrapper);

    controls[el.key] = { text, size, bold, italic, width, height };

    // wire change handlers (toggle buttons flip their pressed state)
    bold.addEventListener("click", () => {
      togglePressed(bold);
      onChange();
    });
    italic.addEventListener("click", () => {
      togglePressed(italic);
      onChange();
    });
    // Title inputs also sync their counterpart language by index.
    if (isTitle) {
      text.addEventListener("input", () => {
        syncTitle(el.lang);
        onChange();
      });
    } else {
      text.addEventListener("input", onChange);
    }
    size.addEventListener("input", onChange);
    if (width) width.addEventListener("input", onChange);
    if (height) height.addEventListener("input", onChange);
  });
}

// When a title matches one of the predefined options, set the other language's
// title to its counterpart (same index). Custom text leaves the other as-is.
function syncTitle(changedLang) {
  const other = changedLang === "hindi" ? "urdu" : "hindi";
  const value = controls[`${changedLang}Title`].text.value;
  const idx = TITLE_OPTIONS[changedLang].indexOf(value);
  if (idx >= 0) {
    controls[`${other}Title`].text.value = TITLE_OPTIONS[other][idx];
  }
}

function togglePressed(btn) {
  const pressed = btn.getAttribute("aria-pressed") === "true";
  btn.setAttribute("aria-pressed", pressed ? "false" : "true");
  btn.classList.toggle("active", !pressed);
}

function isPressed(btn) {
  return btn.getAttribute("aria-pressed") === "true";
}

function setPressed(btn, on) {
  btn.setAttribute("aria-pressed", on ? "true" : "false");
  btn.classList.toggle("active", !!on);
}

// --- font dropdowns -----------------------------------------------------
function populateFontSelect(select, fonts) {
  select.innerHTML = "";
  fonts.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.family;
    opt.textContent = f.family;
    select.appendChild(opt);
  });
}

// --- shared layout builders (used by the layout modules) ----------------
function currentTheme() {
  return document.querySelector('input[name="theme"]:checked').value;
}

// Text to render for an element: Urdu gets kasheeda applied when enabled.
function styledText(control, lang) {
  return lang === "urdu" ? urduText(control.text.value) : control.text.value;
}

// Minimum advance width of one space, as a fraction of the font size.
//
// The Urdu fonts ship a space glyph that is effectively zero-width — measured
// advances are 0.003em (Jameel Khushkhati), 0.006em (Jameel Noori Nastaleeq),
// 0.024em (Mehr Nastaliq), 0.030em (Urdu Khush Khati) and 0.132em (Noto
// Nastaliq Urdu), against ~0.27em for Eczar. Typed spaces therefore all but
// vanish and adding more of them changes nothing visible. `word-spacing` tops
// every space up to this fraction, so spacing behaves the same in every font.
// Fonts whose space is already wider than this (the Hindi ones) are untouched.
const MIN_SPACE_EM = 0.25;

// Natural advance width of a single space in `style`, in px.
function measureSpaceWidth(style) {
  const m = measurerWith(style);
  m.style.whiteSpace = "pre"; // `nowrap` collapses the run down to one space
  m.textContent = " ".repeat(10);
  const w = m.offsetWidth / 10;
  m.style.whiteSpace = "nowrap";
  return w;
}

// Extra px that must be added to every space to reach MIN_SPACE_EM.
function extraWordSpacing(style) {
  return Math.max(0, style.size * MIN_SPACE_EM - measureSpaceWidth(style));
}

// Apply font size / line-height / weight / style / family inline. Line-height
// follows the chosen font's natural line height (measured) so tall fonts like
// Nastaliq aren't squeezed and short fonts don't get an over-tall row.
function applyTextStyle(node, control, lang) {
  const size = Number(control.size.value) || 36;
  const font = lang === "hindi" ? els.hindiFontSelect.value : els.urduFontSelect.value;
  const style = {
    family: font,
    size,
    weight: isPressed(control.bold) ? "700" : "400",
    style: isPressed(control.italic) ? "italic" : "normal",
  };
  node.style.fontSize = `${size}px`;
  node.style.lineHeight = `${Math.ceil(measureTextHeight(ROW_SAMPLE[lang] || "x", style))}px`;
  node.style.fontWeight = style.weight;
  node.style.fontStyle = style.style;
  if (font) node.style.fontFamily = `"${font}"`;
  node.style.wordSpacing = `${extraWordSpacing(style).toFixed(2)}px`;
}

// Width of `text` as a title/signature cell actually draws it: the
// MIN_SPACE_EM top-up that applyTextStyle() puts on every space is included,
// and `preserveSpaces` picks the cell's white-space mode — `pre` for a cell
// left at the stylesheet's `pre-wrap` (typed runs of spaces survive), `nowrap`
// for one switched to `normal` by justifyToWidth() (runs collapse to one).
function measureStyledWidth(text, style, preserveSpaces) {
  const extra = extraWordSpacing(style); // uses the measurer — compute first
  const m = measurerWith(style);
  m.style.whiteSpace = preserveSpaces ? "pre" : "nowrap";
  m.style.wordSpacing = `${extra.toFixed(2)}px`;
  m.textContent = text || "";
  const w = m.offsetWidth;
  m.style.whiteSpace = "nowrap";
  m.style.wordSpacing = "normal";
  return w;
}

// Stretch a title/signature span to an exact width, spreading the slack across
// its spaces — the same treatment makeLineDiv() gives a body line.
// `white-space: normal` is required (justification is suppressed under the
// cell's `pre-wrap`), and `text-align-last` is what does the stretching, since
// a one-line block is also its own last line.
function justifyToWidth(node, width) {
  node.style.display = "inline-block";
  node.style.width = `${width}px`;
  node.style.whiteSpace = "normal";
  node.style.textAlign = "justify";
  node.style.textAlignLast = "justify";
}

// Target width for the Urdu signature line. The user can set it explicitly
// (the Width box under Urdu Signature); left blank it matches the Hindi
// signature's rendered width so the two line up. 0 means "leave the Urdu
// signature at its natural width". The Hindi side is never touched.
function urduSignatureWidth(both) {
  const uControl = controls.urduSignature;
  const uText = styledText(uControl, "urdu");

  // Justification stretches the gaps between words, so it needs at least one.
  // With no space there is nothing to stretch and a wider box would only shove
  // the text sideways, so leave it alone even if a width was typed.
  if (!/\s/.test(uText)) return 0;

  // Never wider than the cell it sits in (full width when Urdu is alone).
  const cap = bodyColWidth(both ? 2 : 1);

  // An explicit width wins, and applies whether or not Hindi is shown.
  const typed = uControl.width ? uControl.width.value.trim() : "";
  if (typed !== "") {
    const manual = Number(typed);
    if (Number.isFinite(manual) && manual > 0) return Math.min(Math.ceil(manual), cap);
  }

  // Auto: match the Hindi signature — which needs a Hindi signature to match.
  if (!both) return 0;
  const hControl = controls.hindiSignature;
  const hStyle = lineStyleFor(hControl, els.hindiFontSelect.value);
  const target = Math.min(
    measureStyledWidth(styledText(hControl, "hindi"), hStyle, true),
    cap
  );
  // Justification can only stretch, never compress: a naturally wider Urdu
  // signature is left alone rather than forced to wrap onto a second line.
  const uStyle = lineStyleFor(uControl, els.urduFontSelect.value);
  const natural = measureStyledWidth(uText, uStyle, false);
  return natural < target ? Math.ceil(target) : 0;
}

// Build the 1-row, 2-column table used for the title or signature.
// `kind` is "Title" or "Signature".
function buildPairTable(kind) {
  const enabled = getEnabled();
  const both = enabled.hindi && enabled.urdu;
  const cellClass = `${kind.toLowerCase()}Cell`;

  // Only the signature line is width-managed (auto-matched to Hindi, or set
  // explicitly via the Width box).
  const urduWidth = kind === "Signature" ? urduSignatureWidth(both) : 0;

  const table = document.createElement("table");
  table.className = `lineTable ${kind.toLowerCase()}Area`;
  const tr = document.createElement("tr");

  const addCell = (lang) => {
    const td = document.createElement("td");
    td.className = `${lang}Cell ${cellClass}`;
    if (!both) {
      td.style.width = "100%";
      td.style.paddingLeft = "0";
      td.style.paddingRight = "0";
    }
    const span = document.createElement("span");
    const control = controls[`${lang}${kind}`];
    span.textContent = styledText(control, lang);
    applyTextStyle(span, control, lang);
    if (lang === "urdu" && urduWidth) justifyToWidth(span, urduWidth);
    td.appendChild(span);
    tr.appendChild(td);
  };

  if (enabled.hindi) addCell("hindi");
  if (enabled.urdu) addCell("urdu");
  table.appendChild(tr);
  return table;
}

// Footer logo, pinned bottom-right. Uses the inlined data URI so the export
// canvas isn't tainted (dark bg → white logo, light bg → black logo).
function buildFooter() {
  const div = document.createElement("div");
  div.className = "footerArea logo";
  const img = document.createElement("img");
  img.alt = "logo";
  img.src = currentTheme() === "dark" ? LOGO_DATA_URI.white : LOGO_DATA_URI.black;
  div.appendChild(img);
  return div;
}

// Frame inner height = full height minus the (adjustable) top margin and the
// fixed bottom margin.
function frameInnerHeight() {
  return els.frame.clientHeight - getTopMargin() - DEFAULT_MARGIN;
}

// --- body lines ---------------------------------------------------------
// Line height = font size * this factor. Each text line gets its own row of
// exactly this height, so the number of rows that fit is deterministic.
const LINE_FACTOR = 1.5;

// Equal empty space above the first body line (below the title) and below the
// last body line (above the signature). Applied as margins in app.js so the
// two gaps always match.
const BODY_GAP = 60;

// Split a textarea value into lines, ignoring blank/whitespace-only lines.
function splitLines(text) {
  return (text || "").split("\n").filter((line) => line.trim() !== "");
}

// How many content lines fit in `availableH`, given a row height of `rowH`
// and an empty spacer line inserted after every two content lines.
function bodyCapacity(availableH, rowH) {
  if (rowH <= 0 || availableH <= 0) return 0;
  let n = 0;
  while (true) {
    const next = n + 1;
    // spacers among `next` lines: one after each completed pair, except a
    // trailing pair-boundary that ends the block.
    const spacers = next % 2 === 0 ? next / 2 - 1 : (next - 1) / 2;
    if ((next + spacers) * rowH > availableH) break;
    n = next;
  }
  return n;
}

function lineStyleFor(control, font) {
  return {
    family: font,
    size: Number(control.size.value) || 36,
    weight: isPressed(control.bold) ? "700" : "400",
    style: isPressed(control.italic) ? "italic" : "normal",
  };
}

// Fixed left/right page margin (matches `.mainFrame` horizontal padding).
const FRAME_SIDE_MARGIN = 100;

// Which languages are enabled (both by default). Returns { hindi, urdu }.
function getEnabled() {
  return {
    hindi: els.hindiEnabled.checked,
    urdu: els.urduEnabled.checked,
  };
}

// Content width available to a body column, minus the 10px inner-edge padding.
// Full width when only one language is shown, else half.
function bodyColWidth(enabledCount) {
  const innerW = 1080 - 2 * FRAME_SIDE_MARGIN; // 880
  return (enabledCount === 2 ? innerW / 2 : innerW) - 10;
}

// Hidden span used to measure text. It has no explicit line-height, so its
// offsetHeight reflects the font's *natural* line height (tall for Nastaliq,
// short for Latin/Devanagari) — that's how row height follows the font choice.
let _measurer = null;
function measurerWith(style) {
  if (!_measurer) {
    _measurer = document.createElement("span");
    _measurer.style.cssText =
      "position:absolute;visibility:hidden;left:-9999px;top:0;white-space:nowrap;";
    document.body.appendChild(_measurer);
  }
  _measurer.style.fontFamily = style.family ? `"${style.family}"` : "";
  _measurer.style.fontSize = `${style.size}px`;
  _measurer.style.fontWeight = style.weight;
  _measurer.style.fontStyle = style.style;
  return _measurer;
}

function measureTextWidth(text, style) {
  const m = measurerWith(style);
  m.textContent = text || "";
  return m.offsetWidth;
}

function measureTextHeight(text, style) {
  const m = measurerWith(style);
  m.textContent = text || "x";
  return m.offsetHeight;
}

// A sample per language with typical ascenders/descenders, used to size a row
// to the chosen font at its size.
const ROW_SAMPLE = { hindi: "आपंगं", urdu: "بحمﷺلا" };

// Row height pinned in a body's `Height` box, or null for auto (blank, zero or
// junk). Clamped to the frame so a stray number can't blow the layout apart.
function pinnedRowHeight(control) {
  const typed = control && control.height ? control.height.value.trim() : "";
  if (typed === "") return null;
  const n = Number(typed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.ceil(n), OUTPUT_HEIGHT);
}

// Row height for one language: the `Height` box when the user pinned one, else
// the measured natural line height of that font at its size.
function langRowHeight(control, sample, style) {
  const pinned = pinnedRowHeight(control);
  return pinned !== null ? pinned : measureTextHeight(sample, style);
}

// Row height that fits the enabled languages' fonts at their sizes (or the
// heights they pinned). Where one row holds both languages (sideBySide,
// onePair) it can only have a single height, so the taller wins; `stack` calls
// this once per language and so gets each block's own height.
function fontRowHeight(enabled, hStyle, uStyle) {
  const hs = [];
  if (enabled.hindi) hs.push(langRowHeight(controls.hindiBody, ROW_SAMPLE.hindi, hStyle));
  if (enabled.urdu) hs.push(langRowHeight(controls.urduBody, ROW_SAMPLE.urdu, uStyle));
  return Math.ceil(hs.length ? Math.max(...hs) : 36 * LINE_FACTOR);
}

function makeLineDiv(cls, text, style, rowH, width) {
  const div = document.createElement("div");
  div.className = cls;
  div.textContent = text || "";
  if (style.family) div.style.fontFamily = `"${style.family}"`;
  div.style.fontSize = `${style.size}px`;
  div.style.fontWeight = style.weight;
  div.style.fontStyle = style.style;
  div.style.lineHeight = `${rowH}px`;
  // Every line is as wide as the longest line in its column; shorter lines are
  // justified (inter-word) to fill that width.
  div.style.display = "inline-block";
  div.style.width = `${width}px`;
  div.style.whiteSpace = "normal";
  div.style.textAlign = "justify";
  div.style.textAlignLast = "justify";
  return div;
}

// The body builders live in the layout modules (js/layouts/*.js).

function updateBodyWarning(total, cap, availableH) {
  const el = els.bodyWarning;
  // availableH 0 means the frame isn't laid out yet — don't warn.
  if (availableH > 0 && total > cap) {
    if (cap === 0) {
      el.textContent =
        "The body font size is too large — not even one line fits. Reduce the font size.";
    } else {
      const remaining = total - cap;
      el.textContent =
        `At this font size only ${cap} line${cap === 1 ? "" : "s"} fit on the image. ` +
        `${remaining} more line${remaining === 1 ? "" : "s"} won't fit — ` +
        `please create another image for the remaining text.`;
    }
    el.classList.remove("d-none");
  } else {
    el.classList.add("d-none");
  }
}

// Default frame padding (matches `.mainFrame` in style.css). Only the top is
// adjustable via the Top Margin input; the other three stay at this value.
const DEFAULT_MARGIN = 100;

function getTopMargin() {
  const v = Number(els.topMarginInput.value);
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_MARGIN;
}

function applyTopMargin() {
  els.frame.style.paddingTop = `${getTopMargin()}px`;
}

// Optional background image, held as a data URI (so it survives reloads and
// never taints the export canvas). null = no background.
let backgroundImage = null;
let backgroundMode = "fill";
let bgNaturalSize = null; // { w, h } — needed for shrink/scale-down modes

// Load the natural pixel size of the current background image, then re-render.
function loadBgNaturalSize() {
  bgNaturalSize = null;
  if (!backgroundImage) return;
  const img = new Image();
  img.onload = () => {
    bgNaturalSize = { w: img.naturalWidth, h: img.naturalHeight };
    refreshLayout();
  };
  img.src = backgroundImage;
}

// Draw the background according to the chosen display mode. `border-box` origin
// makes the frame's full 1080×1350 the reference box (ignores the page margin).
function applyBackground() {
  const f = els.frame;
  if (!backgroundImage) {
    f.style.backgroundImage = "none";
    return;
  }
  f.style.backgroundImage = `url("${backgroundImage}")`;
  f.style.backgroundOrigin = "border-box";

  const fits = bgNaturalSize
    ? bgNaturalSize.w <= OUTPUT_WIDTH && bgNaturalSize.h <= OUTPUT_HEIGHT
    : false;

  let size = "cover";
  let position = "center";
  let repeat = "no-repeat";
  switch (backgroundMode) {
    case "fill": // cover — enlarge to cover, crop excess
      size = "cover";
      break;
    case "fit": // contain — whole image visible
      size = "contain";
      break;
    case "stretch": // fill exactly, may distort
      size = "100% 100%";
      break;
    case "shrink": // only scale down; never enlarge
    case "scaleDown": // original if it fits, else contain
      size = fits ? "auto" : "contain";
      break;
    case "center": // natural size, centered (crops if larger)
      size = "auto";
      break;
    case "tile": // repeat at natural size from the top-left
      size = "auto";
      position = "0 0";
      repeat = "repeat";
      break;
  }
  f.style.backgroundSize = size;
  f.style.backgroundPosition = position;
  f.style.backgroundRepeat = repeat;
}

// --- layout selection & paging -----------------------------------------
let currentPage = 0;

function currentLayoutId() {
  const radio = document.querySelector('input[name="layout"]:checked');
  return radio ? radio.value : "sideBySide";
}

function getLayout() {
  return window.LAYOUTS[currentLayoutId()] || window.LAYOUTS.sideBySide;
}

// True only while generateImage() is capturing. Debug outlines are suppressed
// during capture so they never appear in the exported PNG.
let capturing = false;

function debugBordersOn() {
  return !!(els.debugBordersInput && els.debugBordersInput.checked) && !capturing;
}

// Show/hide the colour legend that explains the debug outlines.
function applyDebugLegend() {
  els.debugLegend.classList.toggle(
    "d-none",
    !(els.debugBordersInput && els.debugBordersInput.checked)
  );
}

// --- preview scaling ----------------------------------------------------
// The frame is a fixed 1080 x 1350 — far wider than a phone screen — so the
// preview is shrunk to fit its wrapper with a `scale()` transform.
//
// A transform does NOT change the layout box, which is what makes this safe:
// every measurement in here (offsetWidth / offsetHeight / clientHeight, and so
// `measureTextWidth()`, `frameInnerHeight()`, `bodyCapacity()`, …) still sees
// the true 1080 x 1350 geometry, so line fitting and the capacity warning are
// identical on a phone and on a monitor. Don't switch this to `zoom` or to
// shrinking the frame's width/height — either would change the layout box and
// the page would then lay out differently from the exported PNG.
//
// The transform is dropped for the duration of the capture via the same
// `capturing` flag that hides the debug outlines: html2canvas 1.4.1 *does*
// honour transforms, so leaving it on would export a shrunken, offset image.
function previewScale() {
  const wrap = els.frameWrapper;
  if (!wrap) return 1;
  const cs = getComputedStyle(wrap);
  const avail =
    wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (!(avail > 0)) return 1;
  // -1px so floating-point rounding can't leave the frame a hair too wide and
  // trip the wrapper's scrollbar.
  return Math.min(1, (avail - 1) / OUTPUT_WIDTH);
}

function applyPreviewScale() {
  const wrap = els.frameWrapper;
  if (!wrap) return;

  if (capturing) {
    els.frame.style.transform = "none";
    wrap.style.height = "";
    return;
  }

  const k = previewScale();
  els.frame.style.transform = k < 1 ? `scale(${k})` : "none";

  if (k < 1) {
    // The transform leaves the layout box at 1350px tall, so the wrapper would
    // reserve the full height and leave a large gap under the shrunken frame.
    // Pin it to the scaled height instead (border-box: add padding + border).
    const cs = getComputedStyle(wrap);
    const extra =
      parseFloat(cs.paddingTop) +
      parseFloat(cs.paddingBottom) +
      parseFloat(cs.borderTopWidth) +
      parseFloat(cs.borderBottomWidth);
    wrap.style.height = `${Math.ceil(OUTPUT_HEIGHT * k + extra)}px`;
  } else {
    wrap.style.height = "";
  }
}

// Apply the frame-level styling (theme, layout, top margin, background) that is
// shared by every layout. Inline styles persist across innerHTML rebuilds.
function applyFrameChrome() {
  const layout = getLayout();
  els.frame.className =
    `mainFrame theme-${currentTheme()} layout-${layout.id}` +
    (debugBordersOn() ? " debug-borders" : "");
  applyTopMargin();
  applyBackground();
  applyPreviewScale();
}

// Render the current page of the current layout into #mainFrame.
function renderCurrentPage() {
  const layout = getLayout();
  applyFrameChrome();
  const count = Math.max(1, layout.pageCount());
  currentPage = Math.min(Math.max(0, currentPage), count - 1);
  els.frame.innerHTML = "";
  layout.renderPage(currentPage);
  updatePageNav(count);
}

function updatePageNav(count) {
  if (count > 1) {
    els.pageNav.classList.add("show");
    els.pageIndicator.textContent = `Page ${currentPage + 1} of ${count}`;
    els.prevPageBtn.disabled = currentPage === 0;
    els.nextPageBtn.disabled = currentPage === count - 1;
  } else {
    els.pageNav.classList.remove("show");
  }
}

function gotoPage(delta) {
  const count = Math.max(1, getLayout().pageCount());
  currentPage = Math.min(Math.max(0, currentPage + delta), count - 1);
  renderCurrentPage();
}

function refreshLayout() {
  renderCurrentPage();
}

// --- state persistence (localStorage) ----------------------------------
function collectState() {
  const state = {
    elements: {},
    fonts: {
      hindi: els.hindiFontSelect.value,
      urdu: els.urduFontSelect.value,
    },
    theme: currentTheme(),
    layout: currentLayoutId(),
    topMargin: getTopMargin(),
    enabled: getEnabled(),
    kasheeda: els.kasheedaInput.checked,
    debugBorders: els.debugBordersInput.checked,
    backgroundImage,
    backgroundMode,
  };
  ELEMENTS.forEach((el) => {
    const c = controls[el.key];
    state.elements[el.key] = {
      text: c.text.value,
      size: Number(c.size.value) || el.fmt.size,
      bold: isPressed(c.bold),
      italic: isPressed(c.italic),
    };
    // Only some elements have these; null means "auto" (blank box).
    if (c.width) {
      const v = c.width.value.trim();
      state.elements[el.key].width = v === "" ? null : Number(v);
    }
    if (c.height) {
      const v = c.height.value.trim();
      state.elements[el.key].height = v === "" ? null : Number(v);
    }
  });
  return state;
}

function saveState() {
  const state = collectState();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    // A large background image can exceed the localStorage quota. Drop it and
    // retry so the rest of the settings still persist.
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, backgroundImage: null })
      );
      console.warn("Background image too large to persist; saved without it.", err);
    } catch (err2) {
      console.warn("Could not save state to localStorage", err2);
    }
  }
}

function loadState() {
  let saved = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch (err) {
    console.warn("Could not read saved state", err);
  }

  // Apply per-element values (saved values win, otherwise defaults).
  ELEMENTS.forEach((el) => {
    const c = controls[el.key];
    const s = saved && saved.elements ? saved.elements[el.key] : null;
    c.text.value = s && s.text != null ? s.text : el.defaultText;
    c.size.value = s && s.size != null ? s.size : el.fmt.size;
    setPressed(c.bold, s ? !!s.bold : el.fmt.bold);
    setPressed(c.italic, s ? !!s.italic : el.fmt.italic);
    // Blank box = auto.
    if (c.width) c.width.value = s && s.width != null ? s.width : "";
    if (c.height) c.height.value = s && s.height != null ? s.height : "";
  });

  // Fonts
  setSelectValue(els.hindiFontSelect, saved && saved.fonts ? saved.fonts.hindi : null, DEFAULT_FONT.hindi);
  setSelectValue(els.urduFontSelect, saved && saved.fonts ? saved.fonts.urdu : null, DEFAULT_FONT.urdu);

  // Theme
  const theme = (saved && saved.theme) || "dark";
  const themeRadio = document.querySelector(`input[name="theme"][value="${theme}"]`);
  if (themeRadio) themeRadio.checked = true;

  // Layout
  const layout = saved && saved.layout ? saved.layout : "sideBySide";
  const layoutRadio = document.querySelector(`input[name="layout"][value="${layout}"]`);
  if (layoutRadio) layoutRadio.checked = true;

  // Top margin
  if (saved && saved.topMargin != null) els.topMarginInput.value = saved.topMargin;

  // Enabled languages (default both on; never both off)
  if (saved && saved.enabled) {
    els.hindiEnabled.checked = saved.enabled.hindi !== false;
    els.urduEnabled.checked = saved.enabled.urdu !== false;
    if (!els.hindiEnabled.checked && !els.urduEnabled.checked) {
      els.hindiEnabled.checked = true;
      els.urduEnabled.checked = true;
    }
  }

  // Kasheeda
  if (saved && saved.kasheeda != null) els.kasheedaInput.checked = !!saved.kasheeda;

  // Debug outlines (preview only)
  if (saved && saved.debugBorders != null) {
    els.debugBordersInput.checked = !!saved.debugBorders;
  }
  applyDebugLegend();

  // Background image (data URI) + display mode
  backgroundImage = saved && saved.backgroundImage ? saved.backgroundImage : null;
  backgroundMode = saved && saved.backgroundMode ? saved.backgroundMode : "fill";
  els.bgModeInput.value = backgroundMode;
  if (backgroundImage) loadBgNaturalSize();
}

// Pick `value` if it is a real option, else `fallback`, else leave the first.
function setSelectValue(select, value, fallback) {
  const has = (v) => v != null && [...select.options].some((o) => o.value === v);
  if (has(value)) select.value = value;
  else if (has(fallback)) select.value = fallback;
}

// Set every element's font size at once. The individual size inputs keep their
// own values (they're overwritten here but remain editable afterwards).
function applyAllSizes() {
  const v = Number(els.allSizeInput.value);
  if (!Number.isFinite(v) || v <= 0) return;
  ELEMENTS.forEach((el) => {
    controls[el.key].size.value = v;
  });
  onChange();
}

// At least one language must stay enabled — revert an unchecking that would
// hide both sections.
function onToggleLang(e) {
  if (!els.hindiEnabled.checked && !els.urduEnabled.checked) {
    e.target.checked = true;
    return;
  }
  onChange();
}

// Called on every UI change: refresh preview + persist.
function onChange() {
  refreshLayout();
  saveState();
}

// --- generate the PNG(s) ------------------------------------------------
// Wait until every <img> inside `root` has finished loading.
function waitForImages(root) {
  const imgs = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((res) => {
            img.onload = res;
            img.onerror = res;
          })
    )
  );
}

async function captureFrame() {
  await waitForImages(els.frame);
  const canvas = await html2canvas(els.frame, {
    width: OUTPUT_WIDTH,
    height: OUTPUT_HEIGHT,
    windowWidth: OUTPUT_WIDTH,
    windowHeight: OUTPUT_HEIGHT,
    scale: 1,
    useCORS: true,
    backgroundColor: null,
  });
  return canvas.toDataURL("image/png");
}

// Render every page of the current layout and capture each one to a PNG.
async function generateImage() {
  await document.fonts.ready;

  const layout = getLayout();
  const count = Math.max(1, layout.pageCount());

  const images = [];
  capturing = true; // drops the debug outlines for the duration of the capture
  try {
    applyFrameChrome();
    for (let p = 0; p < count; p++) {
      els.frame.innerHTML = "";
      layout.renderPage(p);
      images.push(await captureFrame());
    }
  } finally {
    capturing = false;
  }

  renderCurrentPage(); // restore the live preview (outlines come back here)
  showResults(images);
}

function showResults(images) {
  els.resultImages.innerHTML = "";
  images.forEach((dataUrl, i) => {
    const wrap = document.createElement("div");
    wrap.className = "mb-3";

    const bar = document.createElement("div");
    bar.className = "d-flex align-items-center justify-content-between mb-1";
    const label = document.createElement("span");
    label.className = "text-muted small";
    label.textContent = images.length > 1 ? `Page ${i + 1} of ${images.length}` : "Image";
    const link = document.createElement("a");
    link.className = "btn btn-outline-success btn-sm";
    link.href = dataUrl;
    link.download = images.length > 1 ? `postmaker-${i + 1}.png` : "postmaker.png";
    link.textContent = "Download";
    bar.append(label, link);

    const img = document.createElement("img");
    img.className = "result-img";
    img.src = dataUrl;
    img.alt = `generated page ${i + 1}`;

    wrap.append(bar, img);
    els.resultImages.appendChild(wrap);
  });

  // "Download all" triggers each link in turn.
  els.downloadAllBtn.classList.toggle("d-none", images.length <= 1);
  els.downloadAllBtn.onclick = () => {
    els.resultImages.querySelectorAll("a[download]").forEach((a, i) => {
      setTimeout(() => a.click(), i * 300);
    });
  };

  els.resultArea.classList.remove("d-none");
  els.resultArea.scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- init ---------------------------------------------------------------
function init() {
  buildInputs();
  populateFontSelect(els.hindiFontSelect, FONT_MANIFEST.hindi);
  populateFontSelect(els.urduFontSelect, FONT_MANIFEST.urdu);

  loadState();

  // Load fonts in the background; update the preview once available.
  loadAllFonts().then(refreshLayout);

  els.hindiFontSelect.addEventListener("change", onChange);
  els.urduFontSelect.addEventListener("change", onChange);
  els.topMarginInput.addEventListener("input", onChange);
  els.kasheedaInput.addEventListener("change", onChange);
  els.debugBordersInput.addEventListener("change", () => {
    applyDebugLegend();
    onChange();
  });
  els.allSizeBtn.addEventListener("click", applyAllSizes);
  els.allSizeInput.addEventListener("change", applyAllSizes);
  [els.hindiEnabled, els.urduEnabled].forEach((cb) =>
    cb.addEventListener("change", onToggleLang)
  );

  // Layout switch resets to the first page.
  document.querySelectorAll('input[name="layout"]').forEach((r) =>
    r.addEventListener("change", () => {
      currentPage = 0;
      onChange();
    })
  );
  els.prevPageBtn.addEventListener("click", () => gotoPage(-1));
  els.nextPageBtn.addEventListener("click", () => gotoPage(1));

  els.bgImageInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      backgroundImage = reader.result; // data URI
      loadBgNaturalSize();
      onChange();
    };
    reader.readAsDataURL(file);
  });
  els.bgClearBtn.addEventListener("click", () => {
    backgroundImage = null;
    bgNaturalSize = null;
    els.bgImageInput.value = "";
    onChange();
  });
  els.bgModeInput.addEventListener("change", () => {
    backgroundMode = els.bgModeInput.value;
    onChange();
  });
  document
    .querySelectorAll('input[name="theme"]')
    .forEach((r) => r.addEventListener("change", onChange));

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.generateBtn.disabled = true;
    els.generateBtn.textContent = "Generating…";
    try {
      await generateImage();
    } catch (err) {
      console.error("Image generation failed", err);
      alert("Sorry, image generation failed. See the console for details.");
    } finally {
      els.generateBtn.disabled = false;
      els.generateBtn.textContent = "Generate Image";
    }
  });

  // Re-fit the preview when the viewport changes (phone rotation, window
  // resize). Only the scale depends on the viewport — the layout itself is
  // measured in output pixels — so there is no need to re-render the page.
  window.addEventListener("resize", applyPreviewScale);

  refreshLayout();
}

document.addEventListener("DOMContentLoaded", init);