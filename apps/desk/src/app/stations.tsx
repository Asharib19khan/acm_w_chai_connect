'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { GameWithCounts, PublicStation } from '@chai/db';
import { Button, EmptyState, Field, Input, Modal, cn, useToast } from '@chai/ui';
import { createStationAction, revokeStationAction } from './actions';

interface NewKey {
  station: PublicStation;
  key: string;
  gameSlug: string;
}

/** The config file the game reads from next to its .exe (acmw_config.json). */
function configFor(origin: string, slug: string, key: string): string {
  const base = `${origin}/api/games/${slug}`;
  return `${JSON.stringify(
    {
      game_slug: slug,
      leaderboard: {
        enabled: true,
        endpoint: `${base}/scores`,
        api_key: key,
        timeout_seconds: 8,
      },
      registration: {
        enabled: true,
        endpoint: `${base}/registrations`,
        replay_endpoint: `${base}/replays`,
        api_key: key,
        local_list_file: 'registered_players.txt',
        allow_when_offline: false,
        timeout_seconds: 6,
      },
    },
    null,
    2,
  )}\n`;
}

/** Settings for a physical game's own server (Hide & Seek reads these from its .env.local). */
function envFor(origin: string, key: string): string {
  return `CHAI_URL=${origin}\nCHAI_STATION_KEY=${key}\n`;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ago(iso: string | null, now: number): string {
  if (!iso) return 'never';
  const s = Math.round((now - Date.parse(iso)) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' });
}

export function StationPanel({
  game,
  stations,
}: {
  game: GameWithCounts;
  stations: PublicStation[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [created, setCreated] = useState<NewKey | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<PublicStation | null>(null);
  // "Last heard from" clock, ticking every 30 s.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const active = stations.filter((s) => !s.revokedAt);
  const server = game.category === 'physical';
  // DONDA's kiosk takes the desk address and key in its own Settings screen, not a config file.
  const kiosk = game.slug === 'donda';

  const create = () =>
    start(async () => {
      const r = await createStationAction(game.id, name);
      if (!r.ok) return toast(r.message, 'error');
      setCreated(r.data);
      setName('');
      router.refresh();
    });

  const revoke = (s: PublicStation) =>
    start(async () => {
      const r = await revokeStationAction(s.id);
      setConfirmRevoke(null);
      if (r.ok) {
        toast(`${s.name} can no longer send scores.`, 'success');
        router.refresh();
      } else toast(r.message, 'error');
    });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="bg-surface ring-edge flex flex-col gap-4 rounded-[24px] p-5 ring-1 sm:p-6">
        <div>
          <h2 className="font-display text-fg text-xl font-bold">Game stations</h2>
          <p className="text-fg-muted mt-1 text-sm">
            {server
              ? `The ${game.name} game server. It signs players in with their roll number and pass code, checks them in when their phone reaches the gathering spot, and keeps every player's total here for the leaderboards.`
              : `Laptops running ${game.name}. Each one checks who may play and sends every finished round here; each player gets one turn, and that round is their score.`}
          </p>
        </div>
        {stations.length === 0 ? (
          <EmptyState title="No stations yet." align="start" className="py-6">
            Create a key for the first laptop below.
          </EmptyState>
        ) : (
          <ul className="flex flex-col">
            {stations.map((s) => (
              <li
                key={s.id}
                className="border-line flex flex-wrap items-center justify-between gap-3 border-t py-4 first:border-0"
              >
                <div className="min-w-0">
                  <p className="text-fg flex items-center gap-2 font-semibold">
                    <span
                      aria-hidden
                      className={cn(
                        'size-2 rounded-full',
                        s.revokedAt
                          ? 'bg-fg-subtle'
                          : s.lastSeenAt && now - Date.parse(s.lastSeenAt) < 10 * 60_000
                            ? 'bg-ok'
                            : 'bg-accent-strong',
                      )}
                    />
                    {s.name}
                    {s.revokedAt && (
                      <span className="text-fg-subtle text-xs font-medium">revoked</span>
                    )}
                  </p>
                  <p className="text-fg-muted mt-0.5 text-sm">
                    Last heard from {ago(s.lastSeenAt, now)} · {s.runs} round
                    {s.runs === 1 ? '' : 's'}
                    {s.unmatchedRuns > 0 && (
                      <span className="text-danger">
                        {' '}
                        · {s.unmatchedRuns} from roll numbers not registered
                      </span>
                    )}
                  </p>
                </div>
                {!s.revokedAt && (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(s)}>
                    Revoke key
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-surface ring-edge flex flex-col gap-4 self-start rounded-[24px] p-5 ring-1 sm:p-6">
        <h2 className="font-display text-fg text-xl font-bold">{server ? 'Connect the game server' : 'Connect a laptop'}</h2>
        {server ? (
          <ol className="text-fg-muted marker:text-accent-strong flex list-decimal flex-col gap-1.5 pl-5 text-sm">
            <li>Create a key named after the machine running the game.</li>
            <li>
              Download <span className="text-fg font-mono text-xs">.env.local</span> into the game’s
              folder and restart it. The roster then syncs by itself.
            </li>
          </ol>
        ) : kiosk ? (
          <ol className="text-fg-muted marker:text-accent-strong flex list-decimal flex-col gap-1.5 pl-5 text-sm">
            <li>Name the racing laptop and create a key.</li>
            <li>
              On the laptop, open DONDA → Settings (staff PIN) and paste the desk address and the
              key, then Save.
            </li>
            <li>
              The player list then saves itself for offline use, and results sent while offline go
              up when the internet is back.
            </li>
          </ol>
        ) : (
        <ol className="text-fg-muted marker:text-accent-strong flex list-decimal flex-col gap-1.5 pl-5 text-sm">
          <li>Name the laptop and create a key.</li>
          <li>
            Download <span className="text-fg font-mono text-xs">acmw_config.json</span> and put it
            next to the game’s .exe, replacing the old one.
          </li>
          <li>
            Optional: download the offline player list too, in case the Wi-Fi drops. Download it
            again after registration closes.
          </li>
        </ol>
        )}
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <Field label={server ? 'Machine name' : 'Laptop name'}>
            {({ id }) => (
              <Input
                id={id}
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                placeholder={server ? 'Game server' : `Laptop ${active.length + 1}`}
                className="h-11"
              />
            )}
          </Field>
          <Button type="submit" loading={pending} disabled={name.trim().length < 2}>
            Create station key
          </Button>
        </form>
        {!server && <a
          href={`/stations/players?game=${encodeURIComponent(game.id)}`}
          className="text-accent-strong text-sm font-semibold underline-offset-4 hover:underline"
        >
          Download offline player list ({game.registered})
        </a>}
      </section>

      <Modal
        open={Boolean(created)}
        onClose={() => setCreated(null)}
        title={`Key for ${created?.station.name ?? ''}`}
        description="This key is shown once. Download the config now; if it is lost, revoke it and make a new one."
      >
        {created && (
          <div className="flex flex-col gap-4">
            <code className="bg-wash text-fg block rounded-xl px-4 py-3 font-mono text-xs break-all">
              {created.key}
            </code>
            {kiosk && (
              <p className="text-fg-muted text-sm">
                Desk address:{' '}
                <span className="text-fg font-mono text-xs break-all">{window.location.origin}</span>
              </p>
            )}
            {!kiosk && <Button
              onClick={() =>
                server
                  ? download('.env.local', envFor(window.location.origin, created.key))
                  : download(
                      'acmw_config.json',
                      configFor(window.location.origin, created.gameSlug, created.key),
                    )
              }
            >
              {server ? 'Download .env.local' : 'Download acmw_config.json'}
            </Button>}
            <Button
              variant="secondary"
              onClick={() =>
                navigator.clipboard
                  .writeText(created.key)
                  .then(() => toast('Key copied.', 'success'))
                  .catch(() => toast('Copy failed. Select the key and copy it.', 'error'))
              }
            >
              Copy key
            </Button>
            <p className="text-fg-muted text-sm">
              {server
                ? 'Put the file in the game’s folder, then restart the game server.'
                : kiosk
                  ? 'Paste both into DONDA → Settings on the racing laptop and press Save.'
                  : 'Put the file next to the game’s .exe on the laptop, then restart the game.'}
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(confirmRevoke)}
        onClose={() => setConfirmRevoke(null)}
        title={`Revoke ${confirmRevoke?.name ?? ''}?`}
        description="That laptop stops being able to check players or send scores straight away. Scores it already sent stay."
      >
        <div className="flex gap-3">
          <Button
            variant="danger"
            loading={pending}
            onClick={() => confirmRevoke && revoke(confirmRevoke)}
          >
            Revoke key
          </Button>
          <Button variant="ghost" onClick={() => setConfirmRevoke(null)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
