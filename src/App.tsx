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
    name: "メロンソーダ",
    color: "#3BBF8A",
    image: null,
    imageName: null,
    colorDetected: false,
  },
  {
    id: "strawberry",
    name: "いちごソーダ",
    color: "#EA6D78",
    image: null,
    imageName: null,
    colorDetected: false,
  },
  {
    id: "blue-hawaii",
    name: "ブルーハワイ",
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
  const hasSpaces = /\s/.test(text.trim());
  const words = hasSpaces ? text.trim().split(/\s+/) : Array.from(text.trim());
  const separator = hasSpaces ? " " : "";
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const attempt = line ? `${line}${separator}${word}` : word;
    if (context.measureText(attempt).width <= maxWidth || !line) {
      line = attempt;
    } else if (lines.length < maxLines - 1) {
      lines.push(line);
      line = word;
    } else {
      line = `${line}${separator}${word}`;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

export default function Home() {
  const [title, setTitle] = useState("夏の推しソーダはどれ？");
  const [eyebrow, setEyebrow] = useState("ご近所ソーダ総選挙");
  const [callout, setCallout] = useState("好きな候補の欄にシールを貼って投票！");
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
        name: `候補${nextNumber}`,
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
      showNotice("PNG、JPG、WebP形式の画像を選んでください。");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showNotice("画像は10MB以下にしてください。");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const image = String(reader.result);
      updateOption(id, { image, imageName: file.name, colorDetected: false });
      const color = await detectPrimaryColor(image);
      updateOption(id, { color, colorDetected: true });
      showNotice(`画像から色を抽出しました：${color}`);
    };
    reader.readAsDataURL(file);
  };

  const generatedPrompt = useMemo(() => {
    const optionList = options
      .map((option, index) => `${index + 1}. ${option.name || `候補${index + 1}`} — 使用色 ${option.color}`)
      .join("\n");

    return `添付した下書き画像を構図と配色の参考にして、A4横向きのシール投票用ポスターを完成させてください。

【投票の質問】「${title}」
【上部ラベル】「${eyebrow}」
【選択肢】
${optionList}
【投票方法】「${callout}」

【用途】
このポスターをA4横向きで印刷して掲示し、来場者が好きな候補の欄へ丸いシールを1枚貼って投票します。

【必須条件】
・画像内に表示する文章は、数字と色コードを除き、すべて自然な日本語にしてください。
・質問、上部ラベル、選択肢名、投票方法は、上記の表記・順番を一字一句変えずに使用してください。
・各選択肢を同じ大きさで扱い、アップロード画像は切り取らず、全体が見える状態で正しい選択肢名と組み合わせてください。
・指定した色を各選択肢の見出しや境界線に使用してください。
・ブランド名、ロゴ、価格、日付、景品、注意書き、追加の選択肢を勝手に作らないでください。

【シール投票欄の設計】
・用紙の下半分以上を、実際にシールを貼れる明るい無地の投票欄として確保してください。
・選択肢ごとに同じ幅の縦列を1つずつ作り、境界線で明確に区切ってください。
・各列の上部には対応する画像と選択肢名、その下には大きな投票スペースを配置してください。
・直径10〜15mm程度の丸いシールを複数貼れる、十分な余白を確保してください。
・各投票欄には「この欄にシールを貼って投票」という案内だけを表示してください。
・円形ガイド、丸い点、シール、集計記号など、投票済みに見える要素は一切生成しないでください。
・案内文以外の投票欄は完全な空白にしてください。架空の投票結果を描かないでください。

【アートディレクション】
日本の選挙ポスターや店頭アンケートを思わせる、元気で編集的な構成にしてください。上部は大胆な見出しと候補画像で楽しく見せ、下部の投票欄はシールを貼りやすいよう装飾を控えてください。わずかな紙の粒子感、くっきりした高コントラストの縁取り、遊び心のあるレトロな広告表現を使いながら、印刷時の読みやすさと書き込みやすさを最優先してください。重要な要素は裁ち落としを避け、安全領域内に収めてください。

【出力結果】
A4横向き（297×210mm、比率1.414:1）、300dpi相当の高解像度（3508×2480px）の印刷用画像を、完成版として1枚だけ出力してください。画像内の文字はすべて日本語にし、投票欄は空のままにしてください。`;
  }, [callout, eyebrow, options, title]);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    showNotice("プロンプトをコピーしました。");
  };

  const exportDraft = async () => {
    const width = 3508;
    const height = 2480;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "#FFFDF5";
    context.fillRect(0, 0, width, height);

    const bandWidth = width / options.length;
    options.forEach((option, index) => {
      context.fillStyle = option.color;
      context.fillRect(index * bandWidth, 0, bandWidth + 1, 42);
    });

    context.fillStyle = "#171713";
    context.fillRect(0, 42, width, 570);
    context.fillStyle = "#FFFDF5";
    context.font = "800 42px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(eyebrow, width / 2, 125, width - 240);

    context.font = "900 150px Arial Black, Arial, sans-serif";
    const titleLines = wrapCanvasText(context, title, width - 320, 2);
    const titleStart = titleLines.length === 1 ? 315 : 255;
    context.lineJoin = "round";
    context.strokeStyle = "#171713";
    context.lineWidth = 18;
    context.fillStyle = "#FFFDF5";
    titleLines.forEach((line, index) => {
      const y = titleStart + index * 150;
      context.strokeText(line, width / 2, y, width - 240);
      context.fillText(line, width / 2, y, width - 240);
    });

    context.fillStyle = "#E7FF52";
    context.fillRect(420, 515, width - 840, 112);
    context.fillStyle = "#171713";
    context.font = "900 42px Arial Black, Arial, sans-serif";
    context.fillText(callout, width / 2, 571, width - 900);

    const margin = 100;
    const gap = 22;
    const boardTop = 680;
    const boardBottom = 2305;
    const usableWidth = width - margin * 2;
    const columnWidth = (usableWidth - gap * (options.length - 1)) / options.length;
    const candidateHeight = 540;
    const voteTop = boardTop + candidateHeight;
    const voteHeight = boardBottom - voteTop;

    for (const [index, option] of options.entries()) {
      const x = margin + index * (columnWidth + gap);
      const centerX = x + columnWidth / 2;

      context.fillStyle = option.color;
      context.fillRect(x, boardTop, columnWidth, candidateHeight);

      const imageSize = Math.min(columnWidth - 44, 450);
      const imageX = centerX - imageSize / 2;
      const imageY = boardTop + 16;
      context.fillStyle = "#FFFDF5";
      context.fillRect(imageX, imageY, imageSize, imageSize);
      context.lineWidth = 7;
      context.strokeStyle = "#171713";
      context.strokeRect(imageX, imageY, imageSize, imageSize);

      if (option.image) {
        try {
          const image = await loadCanvasImage(option.image);
          drawContainImage(context, image, imageX, imageY, imageSize, imageSize, 12);
        } catch {
          context.fillStyle = `${option.color}33`;
          context.fillRect(imageX + 8, imageY + 8, imageSize - 16, imageSize - 16);
        }
      } else {
        context.fillStyle = `${option.color}33`;
        context.fillRect(imageX + 8, imageY + 8, imageSize - 16, imageSize - 16);
        context.fillStyle = "#171713";
        context.font = "900 88px Arial Black, Arial, sans-serif";
        context.fillText(String(index + 1).padStart(2, "0"), centerX, imageY + imageSize / 2);
      }

      context.fillStyle = readableInk(option.color);
      context.font = `900 ${options.length > 4 ? 34 : 44}px Arial Black, Arial, sans-serif`;
      const name = option.name || `候補${index + 1}`;
      context.fillText(name, centerX, boardTop + 510, columnWidth - 32);

      context.fillStyle = "#FFFDF5";
      context.fillRect(x, voteTop, columnWidth, voteHeight);
      context.lineWidth = 8;
      context.strokeStyle = option.color;
      context.strokeRect(x, voteTop, columnWidth, voteHeight);

      context.fillStyle = "#171713";
      context.font = `900 ${options.length > 4 ? 48 : 62}px Arial Black, Arial, sans-serif`;
      context.fillText("この欄にシールを貼って投票", centerX, voteTop + 62, columnWidth - 30);

    }

    context.fillStyle = "#171713";
    context.font = "700 25px Arial, sans-serif";
    context.fillText("A4横・300dpi構図下書き ｜ LLMで仕上げた後、印刷して丸いシールで投票してください", width / 2, 2400);

    const link = document.createElement("a");
    link.download = "投票ラボ-A4横-シール投票-下書き.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    showNotice("下書き画像をダウンロードしました。");
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="投票ラボ ホーム">
          <span className="brand-mark">投</span>
          <span>
            <strong>投票ラボ</strong>
            <small>みんなの推しを決めよう</small>
          </span>
        </a>
        <div className="header-progress" aria-label="作成手順">
          <span className="progress-step active"><b>01</b> つくる</span>
          <span className="progress-line" />
          <span className="progress-step"><b>02</b> 仕上げる</span>
        </div>
        <a className="header-link" href="#prompt">LLM用プロンプト <span aria-hidden="true">↘</span></a>
      </header>

      <section className="intro" id="top">
        <p className="kicker"><span>新機能</span> いつもの話題を投票ポスターに</p>
        <h1>あなたの一票を<br /><em>見逃せなくする。</em></h1>
        <p className="intro-copy">候補と写真を追加するだけ。画像から色を読み取り、A4横向きのシール投票ポスターと、画像生成AIに渡せる日本語プロンプトをつくります。</p>
      </section>

      <section className="studio-shell" aria-label="投票ポスター作成画面">
        <div className="builder-panel">
          <div className="panel-heading">
            <span className="panel-number">01</span>
            <div>
              <p>投票内容をつくる</p>
              <span>編集内容はすぐに反映されます</span>
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="question">投票の質問</label>
            <input id="question" value={title} maxLength={54} onChange={(event) => setTitle(event.target.value)} />
            <span className="character-count">{title.length}/54</span>
          </div>

          <div className="field-row">
            <div className="field-group compact">
              <label htmlFor="eyebrow">上部ラベル</label>
              <input id="eyebrow" value={eyebrow} maxLength={36} onChange={(event) => setEyebrow(event.target.value)} />
            </div>
            <div className="field-group compact">
              <label htmlFor="callout">投票方法</label>
              <input id="callout" value={callout} maxLength={40} onChange={(event) => setCallout(event.target.value)} />
            </div>
          </div>

          <div className="options-heading">
            <div>
              <h2>投票の候補</h2>
              <p>候補は2〜6個。背景がシンプルな写真がおすすめです。</p>
            </div>
            <span>{options.length}/6</span>
          </div>

          <div className="option-list">
            {options.map((option, index) => (
              <article className="option-card" key={option.id} style={{ "--option-color": option.color } as React.CSSProperties}>
                <div className="option-card-top">
                  <span className="option-index">{String(index + 1).padStart(2, "0")}</span>
                  <input
                    aria-label={`候補${index + 1}の名前`}
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
                    aria-label={`${option.name}を削除`}
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
                      <img src={option.image} alt={`${option.name}のアップロード画像`} />
                    ) : (
                      <>
                        <span className="upload-plus">+</span>
                        <span>写真を追加</span>
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
                      <span>候補の色</span>
                      <strong>{option.color}</strong>
                    </div>
                    <label className="color-swatch" style={{ background: option.color }}>
                      <span className="sr-only">{option.name}の色を選択</span>
                      <input
                        type="color"
                        value={option.color}
                        onChange={(event) => updateOption(option.id, { color: event.target.value.toUpperCase(), colorDetected: false })}
                      />
                    </label>
                    <span className={`color-status ${option.colorDetected ? "detected" : ""}`}>
                      {option.colorDetected ? "自動抽出済み" : "色を変更可能"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <button className="add-option" type="button" onClick={addOption} disabled={options.length >= 6}>
            <span>+</span> 候補を追加
          </button>
        </div>

        <div className="preview-panel">
          <div className="preview-toolbar">
            <div>
              <span className="live-dot" /> A4横・シール投票ポスター
            </div>
            <button type="button" onClick={exportDraft}>A4横の下書きを保存 <span aria-hidden="true">↓</span></button>
          </div>

          <div className="poster-frame">
            <div className={`poster poster-${options.length}`}>
              <div className="poster-grain" />
              <div className="poster-heading">
                <div className="poster-topline">
                  <span>★</span>
                  <strong>{eyebrow || "みんなの推し総選挙"}</strong>
                  <span>★</span>
                </div>
                <div className="poster-title-row">
                  <h2>{title || "あなたの一票はどれ？"}</h2>
                  <div className="poster-method"><span>投票方法</span><strong>{callout || "好きな候補の欄にシールを貼って投票！"}</strong></div>
                </div>
              </div>
              <div className="poster-voting-board">
                {options.map((option, index) => (
                  <div className="vote-column" key={option.id} style={{ "--option-color": option.color } as React.CSSProperties}>
                    <div className="vote-candidate" style={{ background: option.color, color: readableInk(option.color) }}>
                      <div className="poster-image-wrap">
                        <span className="poster-number">{String(index + 1).padStart(2, "0")}</span>
                        {option.image ? (
                          <img src={option.image} alt="" />
                        ) : (
                          <div className="poster-placeholder">
                            <span>{(option.name || "?").slice(0, 1).toUpperCase()}</span>
                            <small>写真を追加</small>
                          </div>
                        )}
                      </div>
                      <h3>{option.name || `候補${index + 1}`}</h3>
                    </div>
                    <div className="sticker-zone">
                      <p>この欄にシールを貼って投票</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="poster-footer">
                <span>A4横向き</span><b>•</b><span>シールで投票</span><b>•</b><span>みんなで決着</span>
              </div>
            </div>
          </div>
          <p className="preview-note"><span>ヒント</span> 下半分の空白は、印刷後に丸いシールを自由に貼る投票欄です。</p>
        </div>
      </section>

      <section className="prompt-section" id="prompt">
        <div className="prompt-intro">
          <span className="panel-number inverted">02</span>
          <p>AIで完成させる</p>
          <h2>LLMへの入力内容は<br />これで完成。</h2>
          <p className="prompt-copy">上のA4横向き下書きを保存し、画像を扱えるLLMへ添付して、この日本語プロンプトを貼り付けてください。候補名・順番・色と、空のシール投票欄が自動で指示に反映されます。</p>
          <ol>
            <li><span>1</span> A4横の下書きPNGを保存する</li>
            <li><span>2</span> LLMへ画像を添付する</li>
            <li><span>3</span> プロンプトを貼って生成する</li>
          </ol>
        </div>
        <div className="prompt-card">
          <div className="prompt-card-head">
            <span>LLMへ貼り付ける日本語プロンプト</span>
            <button type="button" onClick={copyPrompt}>プロンプトをコピー <span aria-hidden="true">⧉</span></button>
          </div>
          <pre>{generatedPrompt}</pre>
          <div className="prompt-card-foot">
            <span><b>{options.length}</b>個の候補を反映</span>
            <span>用紙 <b>A4横</b></span>
            <span><b>300dpi</b>を指定</span>
          </div>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark">投</span>
          <span><strong>投票ラボ</strong><small>楽しい議論を、きれいに決着</small></span>
        </div>
        <p>お菓子の人気投票、チーム分け、パーティーのアンケート。どんな小さな疑問も、大きなポスターに。</p>
        <a href="#top">ページ上部へ ↑</a>
      </footer>

      <div className={`toast ${notice ? "show" : ""}`} role="status" aria-live="polite">{notice}</div>
    </main>
  );
}
