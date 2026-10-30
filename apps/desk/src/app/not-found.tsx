import { ButtonLink } from '@chai/ui';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-start gap-5 px-4 pt-24">
      <h1 className="font-display text-fg text-4xl font-black tracking-tight">Not found.</h1>
      <ButtonLink href="/">Back to the desk</ButtonLink>
    </main>
  );
}
