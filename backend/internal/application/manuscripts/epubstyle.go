package manuscripts

// epubStylesheet is attached to every section of a generated EPUB.
//
// Without it a reader falls back to its own defaults and the book loses
// everything the author set up on screen — the image wrap modes in
// particular are pure CSS (see manuscriptImages.ts and
// ManuscritoTab.module.css) and would otherwise collapse to plain
// full-width blocks. Sizes are left in relative units rather than pinned
// to points: an e-reader is expected to re-flow and rescale text, so the
// job here is to preserve *relationships* (this is a heading, this image
// floats right at 40% width), not to freeze a physical layout the way the
// PDF export does.
const epubStylesheet = `
body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.6;
  margin: 0 5%;
  text-align: left;
  widows: 2;
  orphans: 2;
}

p {
  margin: 1em 0;
}

h1, h2, h3, h4, h5, h6 {
  font-weight: bold;
  page-break-after: avoid;
  break-after: avoid;
}

.ms-chapter-title {
  text-align: center;
  font-size: 1.6em;
  margin: 1em 0 1.4em;
}

.ms-cover-title {
  text-align: center;
  font-size: 2.2em;
  margin: 25% 0 1em;
}

blockquote {
  margin: 1em 40px;
  font-style: italic;
}

ul, ol {
  margin: 1em 0;
  padding-left: 40px;
}

li {
  margin: 0.2em 0;
}

hr {
  border: 0;
  border-top: 1px solid currentColor;
  opacity: 0.35;
  margin: 1.5em 0;
}

img {
  max-width: 100%;
  height: auto;
}

/* Image placement — mirrors the editor's own wrap modes. "free" has no
   meaningful equivalent in a re-flowable book (there is no fixed page to
   pin it to), so it renders centred, the same fallback the PDF export
   uses. */
figure.ms-image {
  margin: 1em 0;
  padding: 0;
  max-width: 100%;
}

figure.ms-image--center,
figure.ms-image--free {
  margin-left: auto;
  margin-right: auto;
  text-align: center;
}

figure.ms-image--left {
  float: left;
  margin: 0.3em 1em 0.6em 0;
}

figure.ms-image--right {
  float: right;
  margin: 0.3em 0 0.6em 1em;
}
`
