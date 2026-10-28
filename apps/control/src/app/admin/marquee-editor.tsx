'use client';

import { useState, useTransition } from 'react';
import { Button, Field, Input, useToast } from '@chai/ui';
import { updateSettingsAction } from './actions';

export function MarqueeEditor({
  marquee,
  announcement,
}: {
  marquee: string[];
  announcement: string | null;
}) {
  const toast = useToast();
  const [items, setItems] = useState(marquee.join(' / '));
  const [note, setNote] = useState(announcement ?? '');
  const [pending, start] = useTransition();
  const save = (clear = false) =>
    start(async () => {
      const r = await updateSettingsAction({
        marquee: items
          .split('/')
          .map((s) => s.trim())
          .filter(Boolean),
        announcement: clear ? null : note.trim() || null,
      });
      if (r.ok) {
        if (clear) setNote('');
        toast(clear ? 'Announcement cleared.' : 'Strip updated.', 'success');
      } else toast(r.message, 'error');
    });
  return (
    <form
      className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field label="Announcement" hint="Shown first, e.g. “Quiz starts in 5 minutes”.">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            value={note}
            maxLength={80}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nothing right now"
          />
        )}
      </Field>
      <Field label="Strip text" hint="Separate items with /">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            value={items}
            onChange={(e) => setItems(e.target.value)}
          />
        )}
      </Field>
      <div className="flex gap-2">
        {announcement && (
          <Button variant="secondary" size="lg" onClick={() => save(true)} disabled={pending}>
            Clear
          </Button>
        )}
        <Button type="submit" size="lg" loading={pending}>
          Update
        </Button>
      </div>
    </form>
  );
}
