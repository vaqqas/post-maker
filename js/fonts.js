/*
 * Font manifest.
 *
 * A static web page cannot enumerate a directory on disk, so the fonts that
 * live under ./assets/fonts/hindi and ./assets/fonts/urdu are listed here.
 * If you add a font, drop a new entry in the matching array and the dropdowns
 * pick it up automatically.
 *
 * `family` is the CSS font-family name we register the file under (must be
 * unique). `file` is the path to the .ttf, relative to index.html.
 */
const FONT_MANIFEST = {
  hindi: [
    {
      family: "Eczar",
      file: "assets/fonts/hindi/Eczar/static/Eczar-Regular.ttf",
    },
    {
      family: "Kurale",
      file: "assets/fonts/hindi/Kurale/Kurale-Regular.ttf",
    },
  ],
  urdu: [
    {
      family: "Jameel Khushkhati",
      file: "assets/fonts/urdu/Jameel-Khushkhati-Font-UrduFonts.com_/Jameel Khushkhati Regular - [UrduFonts.com].ttf",
    },
    {
      family: "Jameel Noori Nastaleeq Kasheeda",
      file: "assets/fonts/urdu/Jameel-Noori-Nastaleeq-Kasheeda-Font-UrduFonts.com_/Jameel Noori Nastaleeq Kasheeda - [UrduFonts.com].ttf",
    },
    {
      family: "Mehr Nastaliq Web",
      file: "assets/fonts/urdu/Mehr-Nastaliq-Web-Font-UrduFonts.com_/Mehr Nastaliq Web - [UrduFonts.com].ttf",
    },
    {
      family: "Noto Nastaliq Urdu",
      file: "assets/fonts/urdu/Noto_Nastaliq_Urdu/static/NotoNastaliqUrdu-Regular.ttf",
    },
    {
      family: "Urdu Khush Khati",
      file: "assets/fonts/urdu/Urdu-Khush-Khati-Font-UrduFonts.com_/Urdu Khush Khati Regular - [UrduFonts.com].ttf",
    },
  ],
};

/*
 * Register every font with the document via the FontFace API and resolve once
 * they are all loaded (or have failed). We must wait for this before rendering
 * to canvas, otherwise html2canvas captures the fallback font.
 */
async function loadAllFonts() {
  const all = [...FONT_MANIFEST.hindi, ...FONT_MANIFEST.urdu];
  await Promise.all(
    all.map(async (f) => {
      try {
        const face = new FontFace(f.family, `url("${encodeURI(f.file)}")`);
        await face.load();
        document.fonts.add(face);
      } catch (err) {
        console.warn(`Could not load font "${f.family}" from ${f.file}`, err);
      }
    })
  );
}