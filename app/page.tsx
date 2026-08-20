"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

type BallotOption = {
  id: string;
  name: string;
  color: string;
  image: string | null;
  imageName: string | null;
  colorDetected: boolean;
};

const FALLBACK_COLORS = [
  "#39B7B1",
  "#F0C737",
  "#EF6B72",
  "#87A6D5",
  "#B9C972",
  "#B18BC8",
];

const INITIAL_OPTIONS: BallotOption[] = [
  {
    id: "melon",
    name: "Melon",
    color: "#3BBF8A",
    image: null,
    imageName: null,
    colorDetected: false,
  },
  {
    id: "strawberry",
    name: "Strawberry",
    color: "#EA6D78",
    image: null,
    imageName: null,
    colorDetected: false,
  },
  {
    id: "blue-hawaii",
    name: "Blue Hawaii",
    color: "#52AFCF",
    image: null,
    imageName: null,
    colorDetected: false,
  },
];

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function readableInk(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.66 ? "#171713" : "#fffdf5";
}

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
    if (max === green) hue = (blue - red) / delta + 2;
    if (max === blue) hue = (red - green) / delta + 4;
    hue /= 6;
  }

  return { h: hue, s: saturation, l: lightness };
}

function hslToHex(h: number, s: number, l: number) {
  const hueToRgb = (p: number, q: number, t: number) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };

  let r = l;
  let g = l;
  let b = l;
  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }

  return `#${[r, g, b]
    .map((value) => Math.round(value * 255).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function detectPrimaryColor(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 72;
      canvas.height = 72;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        resolve(FALLBACK_COLORS[0]);
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const buckets = new Map<string, { score: number; r: number; g: number; b: number; count: number }>();

      for (let index = 0; index < pixels.length; index += 16) {
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const a = pixels[index + 3];
        if (a < 180) continue;

        const { s, l } = rgbToHsl(r, g, b);
        if (l > 0.93 || l < 0.07) continue;

        const qr = Math.min(224, Math.round(r / 32) * 32);
        const qg = Math.min(224, Math.round(g / 32) * 32);
        const qb = Math.min(224, Math.round(b / 32) * 32);
        const key = `${qr}-${qg}-${qb}`;
        const weight = 0.2 + s * 1.8 + (1 - Math.abs(l - 0.55)) * 0.25;
        const bucket = buckets.get(key) ?? { score: 0, r: 0, g: 0, b: 0, count: 0 };
        bucket.score += weight;
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
        bucket.count += 1;
        buckets.set(key, bucket);
      }

      const winner = [...buckets.values()].sort((a, b) => b.score - a.score)[0];
      if (!winner) {
        resolve(FALLBACK_COLORS[0]);
        return;
      }

      const average = {
        r: winner.r / winner.count,
        g: winner.g / winner.count,
        b: winner.b / winner.count,
      };
      const hsl = rgbToHsl(average.r, average.g, average.b);
      resolve(hslToHex(hsl.h, Math.max(0.42, hsl.s), Math.min(0.7, Math.max(0.38, hsl.l))));
    };
    image.onerror = () => resolve(FALLBACK_COLORS[0]);
    image.src = dataUrl;
  });
}

function loadCanvasImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function drawContainImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  padding = 0,
) {
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const scale = Math.min(availableWidth / image.naturalWidth, availableHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const attempt = line ? `${line} ${word}` : word;
    if (context.measureText(attempt).width <= maxWidth || !line) {
      line = attempt;
    } else if (lines.length < maxLines - 1) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

export default function Home() {
  const [title, setTitle] = useState("Which soda wins summer?");
  const [eyebrow, setEyebrow] = useState("THE NEIGHBORHOOD TASTE TEST");
  const [callout, setCallout] = useState("PICK ONE. SETTLE THE DEBATE.");
  const [options, setOptions] = useState<BallotOption[]>(INITIAL_OPTIONS);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2400);
  };

  const updateOption = (id: string, update: Partial<BallotOption>) => {
    setOptions((current) => current.map((option) => (option.id === id ? { ...option, ...update } : option)));
  };

  const addOption = () => {
    if (options.length >= 6) return;
    const nextNumber = options.length + 1;
    setOptions((current) => [
      ...current,
      {
        id: createId(),
        name: `Option ${nextNumber}`,
        color: FALLBACK_COLORS[current.length % FALLBACK_COLORS.length],
        image: null,
        imageName: null,
        colorDetected: false,
      },
    ]);
  };

  const removeOption = (id: string) => {
    if (options.length <= 2) return;
    setOptions((current) => current.filter((option) => option.id !== id));
  };

  const handleFile = (id: string, file?: File) => {
    if (!file || !file.type.startsWith("image/")) {
      showNotice("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showNotice("That image is over the 10 MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const image = String(reader.result);
      updateOption(id, { image, imageName: file.name, colorDetected: false });
      const color = await detectPrimaryColor(image);
      updateOption(id, { color, colorDetected: true });
      showNotice(`Palette found: ${color}`);
    };
    reader.readAsDataURL(file);
  };

  const generatedPrompt = useMemo(() => {
    const optionList = options
      .map((option, index) => `${index + 1}. ${option.name || `Option ${index + 1}`} — color ${option.color}`)
      .join("\n");

    return `Create a finished square voting pamphlet using the attached draft image as the layout and color reference.

QUESTION: “${title}”
TOP LABEL: “${eyebrow}”
OPTIONS:
${optionList}
CALL TO ACTION: “${callout}”

Art direction: energetic Japanese campaign-poster composition, editorial rather than corporate. Build bold vertical color fields from the supplied option colors. Give every option equal visual weight and keep each uploaded product image recognizable, cleanly cut out, and paired only with its correct name. Use oversized, tightly composed headline typography, subtle print grain, crisp high-contrast outlines, and a playful retro retail-advertising feel. Preserve the spelling and order above exactly. Do not invent brands, logos, prices, dates, prizes, legal copy, or additional options. Keep all key text safely inside the image. Output one polished 1:1 social-ready poster at high resolution.`;
  }, [callout, eyebrow, options, title]);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    showNotice("Prompt copied to clipboard.");
  };

  const exportDraft = async () => {
    const size = 1400;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return;

    const bandWidth = size / options.length;
    options.forEach((option, index) => {
      context.fillStyle = option.color;
      context.fillRect(index * bandWidth, 0, bandWidth + 1, size);
    });

    context.fillStyle = "rgba(255, 253, 245, 0.95)";
    context.fillRect(0, 0, size, 118);
    context.fillStyle = "#171713";
    context.font = "800 34px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(eyebrow.toUpperCase(), size / 2, 61, size - 110);

    context.font = "900 112px Arial Black, Arial, sans-serif";
    const titleLines = wrapCanvasText(context, title.toUpperCase(), size - 160, 3);
    const titleStart = 205;
    context.lineJoin = "round";
    context.strokeStyle = "#171713";
    context.lineWidth = 25;
    context.fillStyle = "#FFFDF5";
    titleLines.forEach((line, index) => {
      const y = titleStart + index * 120;
      context.strokeText(line, size / 2, y, size - 120);
      context.fillText(line, size / 2, y, size - 120);
    });

    const imageTop = titleStart + titleLines.length * 120 + 40;
    const imageSize = Math.min(260, bandWidth - 34);
    const imageHeight = Math.min(310, imageSize * 1.18);
    for (const [index, option] of options.entries()) {
      const centerX = index * bandWidth + bandWidth / 2;
      const x = centerX - imageSize / 2;
      const y = imageTop;

      context.fillStyle = "#FFFDF5";
      context.fillRect(x, y, imageSize, imageHeight);
      context.lineWidth = 10;
      context.strokeStyle = "#171713";
      context.strokeRect(x, y, imageSize, imageHeight);

      if (option.image) {
        try {
          const image = await loadCanvasImage(option.image);
          drawContainImage(context, image, x, y, imageSize, imageHeight, 16);
        } catch {
          context.fillStyle = option.color;
          context.fillRect(x + 8, y + 8, imageSize - 16, imageHeight - 16);
        }
      } else {
        context.fillStyle = `${option.color}33`;
        context.fillRect(x + 8, y + 8, imageSize - 16, imageHeight - 16);
        context.fillStyle = "#171713";
        context.font = "900 92px Arial Black, Arial, sans-serif";
        context.fillText(String(index + 1).padStart(2, "0"), centerX, y + imageHeight / 2);
      }

      context.fillStyle = readableInk(option.color);
      context.strokeStyle = readableInk(option.color) === "#171713" ? "#FFFDF5" : "#171713";
      context.lineWidth = 12;
      context.font = `900 ${options.length > 4 ? 30 : 42}px Arial Black, Arial, sans-serif`;
      const name = (option.name || `Option ${index + 1}`).toUpperCase();
      context.strokeText(name, centerX, y + imageHeight + 58, bandWidth - 22);
      context.fillText(name, centerX, y + imageHeight + 58, bandWidth - 22);
    }

    context.fillStyle = "#171713";
    context.fillRect(70, size - 220, size - 140, 132);
    context.fillStyle = "#FFFDF5";
    context.font = "900 42px Arial Black, Arial, sans-serif";
    context.fillText(callout.toUpperCase(), size / 2, size - 154, size - 210);
    context.font = "700 23px Arial, sans-serif";
    context.fillStyle = "rgba(255,253,245,.86)";
    context.fillText("DRAFT COMPOSITION • ADD THIS IMAGE TO YOUR LLM PROMPT", size / 2, size - 42);

    const link = document.createElement("a");
    link.download = "ballot-lab-draft.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    showNotice("Draft image downloaded.");
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Ballot Lab home">
          <span className="brand-mark">BL</span>
          <span>
            <strong>Ballot Lab</strong>
            <small>MAKE A LITTLE NOISE</small>
          </span>
        </a>
        <div className="header-progress" aria-label="Workflow progress">
          <span className="progress-step active"><b>01</b> Build</span>
          <span className="progress-line" />
          <span className="progress-step"><b>02</b> Share</span>
        </div>
        <a className="header-link" href="#prompt">Your LLM prompt <span aria-hidden="true">↘</span></a>
      </header>

      <section className="intro" id="top">
        <p className="kicker"><span>NEW</span> Turn any friendly debate into a poster</p>
        <h1>Make your pick<br /><em>impossible to ignore.</em></h1>
        <p className="intro-copy">Add the contenders. Drop in their photos. We’ll pull the colors and compose a bold visual ballot you can finish with your favorite image model.</p>
      </section>

      <section className="studio-shell" aria-label="Pamphlet builder">
        <div className="builder-panel">
          <div className="panel-heading">
            <span className="panel-number">01</span>
            <div>
              <p>Build your ballot</p>
              <span>Everything updates live</span>
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="question">The big question</label>
            <input id="question" value={title} maxLength={54} onChange={(event) => setTitle(event.target.value)} />
            <span className="character-count">{title.length}/54</span>
          </div>

          <div className="field-row">
            <div className="field-group compact">
              <label htmlFor="eyebrow">Top label</label>
              <input id="eyebrow" value={eyebrow} maxLength={36} onChange={(event) => setEyebrow(event.target.value)} />
            </div>
            <div className="field-group compact">
              <label htmlFor="callout">Call to action</label>
              <input id="callout" value={callout} maxLength={40} onChange={(event) => setCallout(event.target.value)} />
            </div>
          </div>

          <div className="options-heading">
            <div>
              <h2>The contenders</h2>
              <p>2–6 options. Photos work best on a simple background.</p>
            </div>
            <span>{options.length}/6</span>
          </div>

          <div className="option-list">
            {options.map((option, index) => (
              <article className="option-card" key={option.id} style={{ "--option-color": option.color } as React.CSSProperties}>
                <div className="option-card-top">
                  <span className="option-index">{String(index + 1).padStart(2, "0")}</span>
                  <input
                    aria-label={`Name for option ${index + 1}`}
                    className="option-name"
                    value={option.name}
                    maxLength={24}
                    onChange={(event) => updateOption(option.id, { name: event.target.value })}
                  />
                  <button
                    className="remove-option"
                    type="button"
                    onClick={() => removeOption(option.id)}
                    disabled={options.length <= 2}
                    aria-label={`Remove ${option.name}`}
                  >
                    ×
                  </button>
                </div>

                <div className="option-card-body">
                  <label
                    className={`upload-zone ${option.image ? "has-image" : ""}`}
                    htmlFor={`upload-${option.id}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event: DragEvent<HTMLLabelElement>) => {
                      event.preventDefault();
                      handleFile(option.id, event.dataTransfer.files[0]);
                    }}
                  >
                    {option.image ? (
                      <img src={option.image} alt={`${option.name} upload preview`} />
                    ) : (
                      <>
                        <span className="upload-plus">+</span>
                        <span>Drop photo</span>
                      </>
                    )}
                    <input
                      id={`upload-${option.id}`}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event: ChangeEvent<HTMLInputElement>) => handleFile(option.id, event.target.files?.[0])}
                    />
                  </label>

                  <div className="color-control">
                    <div>
                      <span>Option color</span>
                      <strong>{option.color}</strong>
                    </div>
                    <label className="color-swatch" style={{ background: option.color }}>
                      <span className="sr-only">Choose color for {option.name}</span>
                      <input
                        type="color"
                        value={option.color}
                        onChange={(event) => updateOption(option.id, { color: event.target.value.toUpperCase(), colorDetected: false })}
                      />
                    </label>
                    <span className={`color-status ${option.colorDetected ? "detected" : ""}`}>
                      {option.colorDetected ? "Auto-picked" : "Editable"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <button className="add-option" type="button" onClick={addOption} disabled={options.length >= 6}>
            <span>+</span> New option
          </button>
        </div>

        <div className="preview-panel">
          <div className="preview-toolbar">
            <div>
              <span className="live-dot" /> LIVE POSTER
            </div>
            <button type="button" onClick={exportDraft}>Download draft <span aria-hidden="true">↓</span></button>
          </div>

          <div className="poster-frame">
            <div className={`poster poster-${options.length}`}>
              <div className="poster-bands" aria-hidden="true">
                {options.map((option) => <span key={option.id} style={{ background: option.color }} />)}
              </div>
              <div className="poster-grain" />
              <div className="poster-topline">
                <span>★</span>
                <strong>{eyebrow || "YOUR TASTE TEST"}</strong>
                <span>★</span>
              </div>
              <h2>{title || "What gets your vote?"}</h2>
              <div className="poster-options">
                {options.map((option, index) => (
                  <div className="poster-option" key={option.id}>
                    <div className="poster-image-wrap">
                      <span className="poster-number">{String(index + 1).padStart(2, "0")}</span>
                      {option.image ? (
                        <img src={option.image} alt="" />
                      ) : (
                        <div className="poster-placeholder">
                          <span>{(option.name || "?").slice(0, 1).toUpperCase()}</span>
                          <small>ADD PHOTO</small>
                        </div>
                      )}
                    </div>
                    <h3 style={{ color: readableInk(option.color) }}>{option.name || `Option ${index + 1}`}</h3>
                  </div>
                ))}
              </div>
              <div className="poster-callout">
                <span>VOTE NOW</span>
                <strong>{callout || "PICK YOUR FAVORITE"}</strong>
                <span aria-hidden="true">→</span>
              </div>
              <div className="poster-footer">
                <span>ONE QUESTION</span><b>•</b><span>ONE PICK</span><b>•</b><span>BRAGGING RIGHTS</span>
              </div>
            </div>
          </div>
          <p className="preview-note"><span>Tip</span> Your exported draft becomes the visual blueprint for the final LLM-generated pamphlet.</p>
        </div>
      </section>

      <section className="prompt-section" id="prompt">
        <div className="prompt-intro">
          <span className="panel-number inverted">02</span>
          <p>Finish with AI</p>
          <h2>Your art director,<br />briefed and ready.</h2>
          <p className="prompt-copy">Download the draft above, attach it to your favorite image-capable LLM, then paste this prompt. The option names, order, and colors update as you edit.</p>
          <ol>
            <li><span>1</span> Download the draft PNG</li>
            <li><span>2</span> Attach it to your LLM</li>
            <li><span>3</span> Paste the prompt and generate</li>
          </ol>
        </div>
        <div className="prompt-card">
          <div className="prompt-card-head">
            <span>READY-TO-PASTE PROMPT</span>
            <button type="button" onClick={copyPrompt}>Copy prompt <span aria-hidden="true">⧉</span></button>
          </div>
          <pre>{generatedPrompt}</pre>
          <div className="prompt-card-foot">
            <span><b>{options.length}</b> options included</span>
            <span><b>1:1</b> output ratio</span>
            <span><b>HQ</b> recommended</span>
          </div>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark">BL</span>
          <span><strong>Ballot Lab</strong><small>FRIENDLY DEBATES, BEAUTIFULLY SETTLED</small></span>
        </div>
        <p>Made for snack rankings, team picks, party polls, and every tiny question that deserves a big poster.</p>
        <a href="#top">Back to top ↑</a>
      </footer>

      <div className={`toast ${notice ? "show" : ""}`} role="status" aria-live="polite">{notice}</div>
    </main>
  );
}
