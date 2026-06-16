import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Upload,
  FileArchive,
  Sparkles,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Zap,
  Image as ImageIcon,
  Settings2,
} from "lucide-react";
import {
  convertArchive,
  DEVICE_SIZES,
  type DeviceTarget,
} from "@/lib/manga-converter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Manga2PDF — Converti CBZ in PDF nel browser" },
      {
        name: "description",
        content:
          "Converti archivi manga CBZ/ZIP in PDF ottimizzati per Kindle, Kobo, iPad. Veloce, privato, 100% nel tuo browser.",
      },
      { property: "og:title", content: "Manga2PDF — Converti CBZ in PDF" },
      {
        property: "og:description",
        content:
          "Converti CBZ/ZIP in PDF ottimizzati per i tuoi e-reader. Tutto nel browser, nessun upload.",
      },
    ],
  }),
  component: Index,
});

type Status = "idle" | "running" | "done" | "error";

function Index() {
  const [file, setFile] = useState<File | null>(null);
  const [device, setDevice] = useState<DeviceTarget>("generic");
  const [grayscale, setGrayscale] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [archiveProg, setArchiveProg] = useState(0);
  const [pageProg, setPageProg] = useState(0);
  const [pageCount, setPageCount] = useState({ cur: 0, tot: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<{ url: string; name: string; pages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    if (result) URL.revokeObjectURL(result.url);
    setFile(null);
    setStatus("idle");
    setArchiveProg(0);
    setPageProg(0);
    setPageCount({ cur: 0, tot: 0 });
    setLogs([]);
    setResult(null);
    setError(null);
  };

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFile(files[0]);
    setError(null);
    setResult(null);
    setStatus("idle");
  };

  const start = useCallback(async () => {
    if (!file) return;
    setStatus("running");
    setLogs([]);
    setArchiveProg(0);
    setPageProg(0);
    setError(null);
    setResult(null);
    try {
      const res = await convertArchive(file, {
        device,
        grayscale,
        onArchiveProgress: (c, t) => setArchiveProg(t ? c / t : 0),
        onPageProgress: (c, t) => {
          setPageProg(t ? c / t : 0);
          setPageCount({ cur: c, tot: t });
        },
        onLog: (l) => {
          setLogs((prev) => [...prev, l]);
          requestAnimationFrame(() => {
            if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
          });
        },
      });
      const url = URL.createObjectURL(res.pdfBlob);
      setResult({ url, name: res.filename, pages: res.pages });
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }, [file, device, grayscale]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/10 blur-[140px] rounded-full pointer-events-none" />

      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
            <BookOpen className="size-5 text-primary-foreground" />
          </div>
          <div className="font-display font-bold text-lg tracking-tight">
            Manga<span className="text-gradient">2PDF</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <span className="size-2 rounded-full bg-success animate-pulse" />
          100% client-side · zero upload
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-6 pt-16 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-mono mb-6">
            <Sparkles className="size-3 text-primary" />
            CBZ / ZIP → PDF ottimizzato
          </div>
          <h1 className="font-display text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05]">
            I tuoi manga,
            <br />
            <span className="text-gradient">su qualunque schermo.</span>
          </h1>
          <p className="mt-6 text-muted-foreground max-w-xl mx-auto text-lg">
            Carica un archivio, scegli il dispositivo, scarica il PDF. Tutto avviene nel
            tuo browser — niente file lasciano il tuo computer.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {status === "idle" || status === "error" ? (
            <motion.section
              key="upload"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="glass rounded-3xl p-6 sm:p-8 shadow-elevated"
            >
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  onFiles(e.dataTransfer.files);
                }}
                className={`block relative rounded-2xl border-2 border-dashed transition-all cursor-pointer p-10 text-center ${
                  dragging
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-border hover:border-primary/60 hover:bg-muted/30"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".cbz,.zip,.cbr,.rar"
                  className="sr-only"
                  onChange={(e) => onFiles(e.target.files)}
                />
                <motion.div
                  animate={{ y: dragging ? -4 : 0 }}
                  className="mx-auto size-16 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow mb-4"
                >
                  {file ? (
                    <FileArchive className="size-7 text-primary-foreground" />
                  ) : (
                    <Upload className="size-7 text-primary-foreground" />
                  )}
                </motion.div>
                {file ? (
                  <div>
                    <div className="font-display font-semibold text-lg">{file.name}</div>
                    <div className="text-sm text-muted-foreground font-mono mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                    <div className="text-xs text-muted-foreground mt-3">
                      Clicca per cambiare file
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-display font-semibold text-lg">
                      Trascina qui il tuo archivio
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      oppure clicca per sceglierlo · CBZ, ZIP
                    </div>
                  </div>
                )}
              </label>

              {error && (
                <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-sm">
                  <XCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-destructive">Conversione fallita</div>
                    <div className="text-muted-foreground mt-1">{error}</div>
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4 mt-6">
                <Field
                  icon={<Settings2 className="size-4" />}
                  label="Dispositivo target"
                >
                  <select
                    value={device}
                    onChange={(e) => setDevice(e.target.value as DeviceTarget)}
                    className="w-full bg-input rounded-xl px-4 py-3 text-sm font-medium border border-border focus:border-primary outline-none transition appearance-none"
                  >
                    {Object.entries(DEVICE_SIZES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label} — {v.w}×{v.h}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  icon={<ImageIcon className="size-4" />}
                  label="Opzioni immagine"
                >
                  <button
                    type="button"
                    onClick={() => setGrayscale((g) => !g)}
                    className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium border transition ${
                      grayscale
                        ? "bg-primary/15 border-primary text-foreground"
                        : "bg-input border-border hover:border-primary/60"
                    }`}
                  >
                    <span>Scala di grigi</span>
                    <span
                      className={`relative w-10 h-5 rounded-full transition ${
                        grayscale ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 size-4 rounded-full bg-background transition-all ${
                          grayscale ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </span>
                  </button>
                </Field>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={start}
                  disabled={!file}
                  className="group relative flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary text-primary-foreground font-semibold py-4 px-6 shadow-glow disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Zap className="size-4" />
                  Avvia conversione
                </button>
                {file && (
                  <button
                    onClick={() => {
                      setFile(null);
                      if (inputRef.current) inputRef.current.value = "";
                    }}
                    className="rounded-xl border border-border bg-card/50 px-5 py-4 text-sm font-medium hover:bg-muted transition"
                  >
                    Annulla
                  </button>
                )}
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="progress"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="glass rounded-3xl p-6 sm:p-8 shadow-elevated"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    {status === "running" && <Loader2 className="size-3 animate-spin" />}
                    {status === "done" && <CheckCircle2 className="size-3 text-success" />}
                    {status === "running" ? "ELABORAZIONE" : "COMPLETATO"}
                  </div>
                  <div className="font-display font-semibold text-xl truncate mt-1">
                    {file?.name}
                  </div>
                </div>
                {status === "done" && (
                  <button
                    onClick={reset}
                    className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted transition"
                  >
                    <RotateCcw className="size-4" /> Nuovo
                  </button>
                )}
              </div>

              <ProgressBar label="Archivio" value={archiveProg} />
              <div className="h-4" />
              <ProgressBar
                label="Pagine"
                value={pageProg}
                detail={
                  pageCount.tot
                    ? `${pageCount.cur} / ${pageCount.tot}`
                    : undefined
                }
              />

              {status === "done" && result && (
                <motion.a
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  href={result.url}
                  download={result.name}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-primary-foreground font-semibold py-4 px-6 shadow-glow hover:scale-[1.01] transition"
                >
                  <Download className="size-4" />
                  Scarica PDF · {result.pages} pagine
                </motion.a>
              )}

              <div className="mt-6">
                <div className="text-xs font-mono text-muted-foreground mb-2">LOG</div>
                <div
                  ref={logRef}
                  className="bg-black/60 border border-border rounded-xl p-4 h-48 overflow-auto font-mono text-xs text-muted-foreground space-y-1"
                >
                  {logs.length === 0 && <div className="opacity-50">In attesa...</div>}
                  {logs.map((l, i) => (
                    <div key={i} className={logColor(l)}>
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <div className="mt-12 grid sm:grid-cols-3 gap-4">
          <Feature
            icon={<Zap />}
            title="Veloce"
            desc="Conversione in parallelo direttamente nel browser, niente attese di upload."
          />
          <Feature
            icon={<Sparkles />}
            title="Privato"
            desc="I file non vengono mai inviati a un server. Tutto rimane sul tuo dispositivo."
          />
          <Feature
            icon={<BookOpen />}
            title="Ottimizzato"
            desc="Profili pronti per Kindle, Kobo, iPad e tablet generici."
          />
        </div>
      </main>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-2">
        {icon}
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function ProgressBar({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-muted-foreground">
          {detail ?? `${pct}%`}
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-primary rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
        {pct < 100 && pct > 0 && (
          <div className="absolute inset-0 shimmer rounded-full" />
        )}
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="size-9 rounded-xl bg-primary/15 text-primary grid place-items-center mb-3">
        {icon}
      </div>
      <div className="font-display font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{desc}</div>
    </div>
  );
}

function logColor(line: string) {
  if (line.includes("[WARN]")) return "text-yellow-400/90";
  if (line.includes("[OK]")) return "text-success";
  if (line.startsWith("[ERR")) return "text-destructive";
  return "";
}
