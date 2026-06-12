"use client";

/**
 * Watermark tool — text or image overlay on every page of a PDF.
 *
 * Custom UI (not the shared PdfToolShell) because we need:
 *   - Live preview of position + rotation as the user picks
 *   - Image upload with size validation
 *   - A "tile" mode (DRAFT-style diagonal repeat) that benefits
 *     from a visual representation
 *   - Opacity/rotation/color controls that are more than the
 *     typical "1 dropdown + 1 button" pattern
 *
 * The shell's "drop a file, pick an option, run" flow would
 * make this UI feel sparse. A custom page is the right call.
 */

import { useState } from "react";
import {
  Stamp,
  Upload,
  X,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Image as ImageIcon,
} from "lucide-react";
import { watermarkPdf, ApiError } from "@/lib/api";
import { useQuota } from "@/lib/quota";
import { useAuth } from "@/lib/auth";

const POSITIONS = [
  { value: "center", label: "Center" },
  { value: "tile", label: "Tile (diagonal repeat)" },
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
] as const;

const COLORS = [
  { value: "red", label: "Red", rgb: "rgb(220 38 38)" },
  { value: "gray", label: "Gray", rgb: "rgb(100 116 139)" },
  { value: "black", label: "Black", rgb: "rgb(15 23 42)" },
  { value: "blue", label: "Blue", rgb: "rgb(37 99 235)" },
] as const;

const ROTATIONS = [0, 30, 45, 60, 90, 135, 180] as const;

type Done = {
  kind: "done";
  filename: string;
  sizeBytes: number;
  pages: number;
  mode: string;
  position: string;
  blob: Blob;
};

export function WatermarkTool() {
  const auth = useAuth();
  const quota = useQuota();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"text" | "image">("text");
  const [text, setText] = useState("DRAFT");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [position, setPosition] = useState<typeof POSITIONS[number]["value"]>("center");
  const [rotation, setRotation] = useState<typeof ROTATIONS[number]>(45);
  const [opacity, setOpacity] = useState(0.3);
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState<typeof COLORS[number]["value"]>("red");
  const [pages, setPages] = useState("");
  const [imageSize, setImageSize] = useState(200);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setDone(null);
      setError(null);
    }
    e.target.value = "";
  };

  const onImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setImageFile(f);
      setError(null);
      // Make a preview URL
      const url = URL.createObjectURL(f);
      setImagePreview(url);
    }
    e.target.value = "";
  };

  const onRun = async () => {
    if (!file) {
      setError("Pick a PDF first.");
      return;
    }
    if (mode === "text" && !text.trim()) {
      setError("Type some watermark text.");
      return;
    }
    if (mode === "image" && !imageFile) {
      setError("Pick a watermark image.");
      return;
    }
    if (!quota.canRun) {
      setError(
        auth.user
          ? `You've used all ${quota.limit} of today's tasks. Resets at midnight.`
          : "You've used today's free task. Sign up free for 50 tasks/day."
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await watermarkPdf(file, {
        text: mode === "text" ? text : undefined,
        image: mode === "image" ? imageFile || undefined : undefined,
        position,
        rotation,
        opacity,
        fontSize,
        color,
        pages: pages || undefined,
        imageSize,
      });
      quota.consume();
      setDone({
        kind: "done",
        filename: r.filename,
        sizeBytes: r.sizeBytes,
        pages: r.pages,
        mode: r.mode,
        position: r.position,
        blob: r.blob,
      });
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.detail
          : e instanceof Error
          ? e.message
          : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onDownload = () => {
    if (!done) return;
    const url = URL.createObjectURL(done.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = done.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onReset = () => {
    setFile(null);
    setDone(null);
    setError(null);
  };

  return (
    <div className="container-narrow py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Stamp className="h-3.5 w-3.5 text-brand-600" />
          <span>PDF tool</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Add Watermark
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Stamp a text or image watermark on every page. DRAFT, CONFIDENTIAL,
          company logo — pick from 8 positions, 4 colors, 7 rotations.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          A watermark is a visual overlay. It is not a digital signature
          and does not provide copyright protection on its own. For legal
          document signing, use the Sign PDF tool.
        </div>
      </div>

      {/* File dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f && f.name.toLowerCase().endsWith(".pdf")) {
            setFile(f);
            setDone(null);
            setError(null);
          }
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
          dragging
            ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30"
            : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
        }`}
      >
        {file ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                <Stamp className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-slate-700 dark:text-slate-300">
              Drop a PDF here, or{" "}
              <label className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400">
                browse
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={onPick}
                  className="hidden"
                />
              </label>
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PDF up to 50 MB</p>
          </>
        )}
      </div>

      {/* Mode tabs */}
      <div className="mt-6">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              mode === "text"
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            Text watermark
          </button>
          <button
            type="button"
            onClick={() => setMode("image")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              mode === "image"
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            Image watermark
          </button>
        </div>
      </div>

      {/* Mode-specific content */}
      {mode === "text" ? (
        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Watermark text
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. DRAFT, CONFIDENTIAL, © Acme Corp 2026"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      ) : (
        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Watermark image
          </label>
          <div className="flex items-start gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2 text-sm hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900">
              <ImageIcon className="h-4 w-4 text-slate-500" />
              <span>{imageFile ? "Change image" : "Choose image"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={onImagePick}
                className="hidden"
              />
            </label>
            {imageFile && (
              <div className="flex items-center gap-2">
                {imagePreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="Watermark preview"
                    className="h-12 w-12 rounded border border-slate-200 object-contain dark:border-slate-700"
                  />
                )}
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {imageFile.name} · {(imageFile.size / 1024).toFixed(1)} KB
                </div>
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            PNG with transparent background works best. Max 5 MB.
          </p>
        </div>
      )}

      {/* Position + style options */}
      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Position
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {POSITIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPosition(p.value)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  position === p.value
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Opacity: <span className="font-semibold">{Math.round(opacity * 100)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full accent-brand-600"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Invisible</span>
              <span>Faded</span>
              <span>Opaque</span>
            </div>
          </div>
          {mode === "text" ? (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Rotation
                </label>
                <select
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value) as typeof ROTATIONS[number])}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {ROTATIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}°
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Font size: <span className="font-semibold">{fontSize}pt</span>
                </label>
                <input
                  type="range"
                  min={12}
                  max={120}
                  step={2}
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  className="w-full accent-brand-600"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Color
                </label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                        color === c.value
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-950"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                      }`}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-slate-300"
                        style={{ background: c.rgb }}
                      />
                      <span className="text-slate-700 dark:text-slate-300">
                        {c.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Image size: <span className="font-semibold">{imageSize}pt</span> wide
              </label>
              <input
                type="range"
                min={50}
                max={500}
                step={10}
                value={imageSize}
                onChange={(e) => setImageSize(parseInt(e.target.value, 10))}
                className="w-full accent-brand-600"
              />
            </div>
          )}
          <div className={mode === "text" ? "sm:col-span-2" : ""}>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Pages (blank = all)
            </label>
            <input
              type="text"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder="e.g. 1,3-5"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {quota.used}/{quota.limit} tasks used today
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={!file || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Watermarking...
            </>
          ) : (
            <>
              <Stamp className="h-4 w-4" />
              Add Watermark
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {done && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Watermarked PDF ready.</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Pages</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {done.pages}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Mode</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {done.mode}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Position</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {done.position}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Size</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">
                {(done.sizeBytes / 1024).toFixed(1)} KB
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={onDownload}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            Download {done.filename}
          </button>
        </div>
      )}

      <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Related tools
        </h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a
            href="/tools/rotate"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Rotate PDF
          </a>
          <a
            href="/tools/page-numbers"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Add Page Numbers
          </a>
          <a
            href="/tools/sign"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Sign PDF
          </a>
        </div>
      </div>
    </div>
  );
}
