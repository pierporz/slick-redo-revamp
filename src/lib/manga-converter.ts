import JSZip from "jszip";
import { jsPDF } from "jspdf";
import wasmUrl from "node-unrar-js/dist/js/unrar.wasm?url";

export type DeviceTarget = "generic" | "kindle" | "kobo" | "ipad" | "tablet7";

export const DEVICE_SIZES: Record<DeviceTarget, { w: number; h: number; label: string }> = {
  generic: { w: 1200, h: 1800, label: "Generic (A4-ish)" },
  kindle: { w: 1072, h: 1448, label: "Kindle Paperwhite" },
  kobo: { w: 1264, h: 1680, label: "Kobo Libra" },
  ipad: { w: 1536, h: 2048, label: "iPad" },
  tablet7: { w: 800, h: 1280, label: "Tablet 7\"" },
};

const IMG_EXT = /\.(jpe?g|png|webp|gif|bmp)$/i;

export interface ConvertOptions {
  device: DeviceTarget;
  grayscale: boolean;
  onArchiveProgress?: (current: number, total: number) => void;
  onPageProgress?: (current: number, total: number) => void;
  onLog?: (line: string) => void;
}

export interface ConvertResult {
  pdfBlob: Blob;
  filename: string;
  pages: number;
}

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Immagine non leggibile"));
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function fitInto(srcW: number, srcH: number, maxW: number, maxH: number) {
  const r = Math.min(maxW / srcW, maxH / srcH, 1);
  return { w: Math.round(srcW * r), h: Math.round(srcH * r) };
}

async function renderPage(
  img: HTMLImageElement,
  maxW: number,
  maxH: number,
  grayscale: boolean,
): Promise<string> {
  const { w, h } = fitInto(img.naturalWidth, img.naturalHeight, maxW, maxH);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  if (grayscale) {
    const data = ctx.getImageData(0, 0, w, h);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(data, 0, 0);
  }
  return canvas.toDataURL("image/jpeg", 0.85);
}

export async function convertArchive(
  file: File,
  opts: ConvertOptions,
): Promise<ConvertResult> {
  const { device, grayscale, onArchiveProgress, onPageProgress, onLog } = opts;
  const { w: maxW, h: maxH } = DEVICE_SIZES[device];

  onLog?.(`[INFO] File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
  onArchiveProgress?.(0, 1);

  const lower = file.name.toLowerCase();
  if (lower.endsWith(".cbr") || lower.endsWith(".rar")) {
    throw new Error(
      "Gli archivi RAR/CBR non sono supportati nel browser. Convertili in CBZ/ZIP e riprova.",
    );
  }
  if (!lower.endsWith(".cbz") && !lower.endsWith(".zip")) {
    throw new Error("Formato non supportato. Usa CBZ o ZIP.");
  }

  onLog?.("[STEP] Lettura archivio...");
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files)
    .filter((e) => !e.dir && IMG_EXT.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (entries.length === 0) throw new Error("Nessuna immagine trovata nell'archivio.");
  onLog?.(`[INFO] Immagini trovate: ${entries.length}`);

  const pdf = new jsPDF({ unit: "pt", format: [maxW, maxH], compress: true });
  let added = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      const blob = await entry.async("blob");
      const img = await loadImage(blob);
      const dataUrl = await renderPage(img, maxW, maxH, grayscale);
      const { w, h } = fitInto(img.naturalWidth, img.naturalHeight, maxW, maxH);
      if (added > 0) pdf.addPage([maxW, maxH], w > h ? "landscape" : "portrait");
      const x = (maxW - w) / 2;
      const y = (maxH - h) / 2;
      pdf.addImage(dataUrl, "JPEG", x, y, w, h, undefined, "FAST");
      added++;
      onPageProgress?.(i + 1, entries.length);
      if ((i + 1) % 10 === 0 || i === entries.length - 1) {
        onLog?.(`[INFO] Pagina ${i + 1}/${entries.length}`);
      }
    } catch (e) {
      onLog?.(`[WARN] Pagina ${i + 1} saltata: ${(e as Error).message}`);
    }
  }

  onArchiveProgress?.(1, 1);
  onLog?.(`[STEP] Generazione PDF (${added} pagine)...`);
  const pdfBlob = pdf.output("blob");
  const baseName = file.name.replace(/\.(cbz|zip)$/i, "");
  onLog?.(`[OK] PDF pronto: ${baseName}.pdf`);
  return { pdfBlob, filename: `${baseName}.pdf`, pages: added };
}
