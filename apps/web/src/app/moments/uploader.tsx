'use client';

import { AnimatePresence, motion } from 'motion/react';
import SparkMD5 from 'spark-md5';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LIMITS } from '@chai/core';
import { Field, Input, cn, useToast } from '@chai/ui';

type Status = 'hashing' | 'queued' | 'uploading' | 'verifying' | 'done' | 'skipped' | 'failed';

interface Item {
  key: string;
  file: File;
  preview: string | null;
  status: Status;
  sent: number;
  md5: string | null;
  error: string | null;
}

const CONCURRENCY = 3;
const DONE_KEY = 'cc_moments_done';
const HASH_SLICE = 2 * 1024 * 1024;

function doneSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function remember(md5: string, size: number) {
  try {
    const set = doneSet();
    set.add(`${md5}:${size}`);
    localStorage.setItem(DONE_KEY, JSON.stringify([...set].slice(-2000)));
  } catch {
    // storage unavailable
  }
}

async function md5Of(file: File): Promise<string> {
  const spark = new SparkMD5.ArrayBuffer();
  for (let offset = 0; offset < file.size; offset += HASH_SLICE) {
    spark.append(await file.slice(offset, offset + HASH_SLICE).arrayBuffer());
  }
  return spark.end();
}

/** Small WebP cover made on the phone; EXIF never leaves with it. The original is untouched. */
async function makeCover(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.8, 0.65, 0.5]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );
      if (blob && blob.type === 'image/webp' && blob.size <= 60_000) return blob;
    }
    return null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function formatBytes(n: number) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function MomentsUploader({ open }: { open: boolean }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [started, setStarted] = useState<number | null>(null);
  const batchId = useRef(`b${Date.now().toString(36)}`);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const active = useRef(0);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const patch = useCallback((key: string, change: Partial<Item>) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...change } : i)));
  }, []);

  const busy = items.some(
    (i) =>
      i.status === 'uploading' ||
      i.status === 'verifying' ||
      i.status === 'queued' ||
      i.status === 'hashing',
  );

  // Keep the screen awake and warn before closing mid-upload.
  useEffect(() => {
    if (!busy) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    nav.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {});
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      lock?.release().catch(() => {});
    };
  }, [busy]);

  const upload = useCallback(
    async (item: Item) => {
      const { file } = item;
      patch(item.key, { status: 'uploading', error: null });
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const init = await fetch('/api/moments/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              batchId: batchId.current,
              uploaderName: name,
              title: title || undefined,
              fileName: file.name,
              size: file.size,
              mime: file.type || 'image/jpeg',
              md5: item.md5,
            }),
          });
          const info = (await init.json()) as {
            id: string;
            receivedBytes: number;
            alreadyDone: boolean;
            error?: string;
          };
          if (!init.ok) throw new Error(info.error ?? 'Could not start the upload.');
          if (info.alreadyDone) {
            remember(item.md5!, file.size);
            patch(item.key, { status: 'skipped', sent: file.size });
            return;
          }
          // Resumable: continue from whatever the server already has.
          let offset = info.receivedBytes;
          patch(item.key, { sent: offset });
          while (offset < file.size) {
            const piece = file.slice(offset, offset + LIMITS.uploadChunkBytes);
            let tries = 0;
            for (;;) {
              try {
                const res = await fetch(`/api/moments/chunk?id=${info.id}&offset=${offset}`, {
                  method: 'POST',
                  body: piece,
                });
                const data = (await res.json()) as { received?: number; error?: string };
                if (!res.ok || data.received == null)
                  throw new Error(data.error ?? 'Upload interrupted.');
                offset = data.received;
                break;
              } catch (error) {
                if (++tries > 4) throw error;
                await sleep(800 * 2 ** tries);
              }
            }
            patch(item.key, { sent: offset });
          }
          patch(item.key, { status: 'verifying' });
          const form = new FormData();
          form.set('id', info.id);
          const cover = await makeCover(file);
          if (cover) form.set('cover', cover, 'cover.webp');
          const done = await fetch('/api/moments/complete', { method: 'POST', body: form });
          const result = (await done.json()) as { ok: boolean; reason?: string; error?: string };
          if (result.ok) {
            remember(item.md5!, file.size);
            patch(item.key, { status: 'done', sent: file.size });
            return;
          }
          // Checksum mismatch: the server reset the upload; send it again once.
          patch(item.key, { status: 'uploading', sent: 0 });
        }
        throw new Error('The photo did not arrive intact. Tap retry.');
      } catch (error) {
        patch(item.key, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Upload failed.',
        });
      }
    },
    [name, title, patch],
  );

  // Queue runner: three at a time.
  useEffect(() => {
    const queued = items.filter((i) => i.status === 'queued');
    for (const item of queued) {
      if (active.current >= CONCURRENCY) break;
      active.current++;
      patch(item.key, { status: 'uploading' });
      upload(item).finally(() => {
        active.current--;
        setItems((list) => [...list]);
      });
    }
  }, [items, upload, patch]);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (name.trim().length < LIMITS.nameMin) {
      setNameError('Add your name first, so we can credit the photos.');
      toast('Add your name first.', 'error');
      return;
    }
    setNameError(null);
    if (!started) setStarted(Date.now());
    const done = doneSet();
    const fresh: Item[] = [...files]
      .filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
      .map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: URL.createObjectURL(file),
        status: 'hashing' as const,
        sent: 0,
        md5: null,
        error: null,
      }));
    if (fresh.length < files.length) toast('Only photos can be shared here.', 'info');
    setItems((list) => [...fresh, ...list]);
    for (const item of fresh) {
      const md5 = await md5Of(item.file);
      if (done.has(`${md5}:${item.file.size}`))
        patch(item.key, { md5, status: 'skipped', sent: item.file.size });
      else patch(item.key, { md5, status: 'queued' });
    }
  };

  const totals = useMemo(() => {
    const counted = items.filter((i) => i.status !== 'skipped');
    const total = counted.reduce((s, i) => s + i.file.size, 0);
    const sent = counted.reduce((s, i) => s + i.sent, 0);
    const finished = items.filter((i) => i.status === 'done' || i.status === 'skipped').length;
    const elapsed = started ? (Date.now() - started) / 1000 : 0;
    const speed = elapsed > 1 ? sent / elapsed : 0;
    const eta = speed > 0 ? Math.ceil((total - sent) / speed) : null;
    return { total, sent, finished, eta };
  }, [items, started]);

  if (!open) return null;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" error={nameError ?? undefined} hint="Shown under your photos.">
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              value={name}
              maxLength={LIMITS.nameMax}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          )}
        </Field>
        <Field label="Title" hint="Optional, for this batch.">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              value={title}
              maxLength={LIMITS.momentTitleMax}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The panel"
            />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="group bg-plum text-ink flex aspect-[5/4] flex-col items-start justify-between rounded-[28px] p-5 text-left transition-transform active:scale-[0.98] sm:aspect-[2/1] sm:p-7"
        >
          <svg viewBox="0 0 24 24" className="size-8" aria-hidden>
            <path
              d="M4 8h3l2-3h6l2 3h3v11H4z"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
          <span className="font-display text-xl font-bold sm:text-2xl">Take photo</span>
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="group bg-prussian text-petal ring-grape hover:ring-plum flex aspect-[5/4] flex-col items-start justify-between rounded-[28px] p-5 text-left ring-1 transition-[transform,box-shadow] active:scale-[0.98] sm:aspect-[2/1] sm:p-7"
        >
          <svg viewBox="0 0 24 24" className="text-plum size-8" aria-hidden>
            <rect
              x="3"
              y="4"
              width="18"
              height="16"
              rx="3"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="m3 16 5-5 4 4 3-3 6 6"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-display text-xl font-bold sm:text-2xl">Choose from gallery</span>
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <p className="text-petal-72 -mt-4 text-sm">
        Photos arrive in full quality, never compressed. For the very best quality, shoot in your
        camera app and then choose from your gallery. On iPhone, picking through{' '}
        <span className="text-petal">Files</span> always sends the untouched original.
      </p>

      <AnimatePresence>
        {items.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-5"
            aria-label="Upload progress"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-petal font-semibold">
                  {totals.finished} of {items.length} done
                </span>
                <span className="text-petal-72 tabular font-mono">
                  {formatBytes(totals.sent)} / {formatBytes(totals.total)}
                  {busy &&
                    totals.eta != null &&
                    ` · about ${totals.eta > 90 ? `${Math.ceil(totals.eta / 60)} min` : `${totals.eta}s`} left`}
                </span>
              </div>
              <div
                className="bg-petal-12 h-2 overflow-hidden rounded-full"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={totals.total ? Math.round((totals.sent / totals.total) * 100) : 0}
              >
                <motion.div
                  className="bg-plum h-full rounded-full"
                  animate={{ width: `${totals.total ? (totals.sent / totals.total) * 100 : 0}%` }}
                  transition={{ ease: 'easeOut' }}
                />
              </div>
              {busy && (
                <p className="text-petal-72 text-sm">
                  Keep this page open until every photo shows a tick.
                </p>
              )}
            </div>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {items.map((item) => (
                <QueueTile
                  key={item.key}
                  item={item}
                  onRetry={() => patch(item.key, { status: 'queued', error: null })}
                />
              ))}
            </ul>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function QueueTile({ item, onRetry }: { item: Item; onRetry: () => void }) {
  const pct = item.file.size ? item.sent / item.file.size : 0;
  const finished = item.status === 'done' || item.status === 'skipped';
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-prussian ring-grape relative aspect-square overflow-hidden rounded-2xl ring-1"
    >
      {item.preview && (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img
          src={item.preview}
          alt=""
          className={cn(
            'size-full object-cover transition-opacity',
            finished ? 'opacity-100' : 'opacity-45',
          )}
        />
      )}
      <div className="absolute inset-0 grid place-items-center">
        {finished ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="bg-plum text-ink grid size-9 place-items-center rounded-full"
            aria-label={item.status === 'skipped' ? 'Already uploaded' : 'Uploaded'}
          >
            <svg viewBox="0 0 24 24" className="size-5">
              <path
                d="m5 12 5 5 9-10"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </motion.span>
        ) : item.status === 'failed' ? (
          <button
            type="button"
            onClick={onRetry}
            className="bg-coral text-ink rounded-full px-3 py-1.5 text-xs font-bold"
            title={item.error ?? undefined}
          >
            Retry
          </button>
        ) : (
          <svg
            viewBox="0 0 40 40"
            className="size-11 -rotate-90"
            aria-label={`${Math.round(pct * 100)}%`}
          >
            <circle
              cx="20"
              cy="20"
              r="16"
              stroke="var(--cc-petal-12)"
              strokeWidth="4"
              fill="none"
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              stroke="var(--cc-plum)"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={100.5}
              strokeDashoffset={100.5 * (1 - pct)}
              className="transition-[stroke-dashoffset] duration-300"
            />
          </svg>
        )}
      </div>
    </motion.li>
  );
}
