import { ButtonLink, ChaiCup } from '@chai/ui';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-6 px-4 pt-16 sm:px-8">
      <ChaiCup className="h-20 w-auto" steam={false} />
      <h1 className="font-display text-fg text-[clamp(2.6rem,10vw,5rem)] leading-[0.92] font-black tracking-tight">
        This cup is empty.
      </h1>
      <p className="text-fg-muted text-lg">
        The page you’re looking for doesn’t exist. Try the home page.
      </p>
      <ButtonLink href="/">Back home</ButtonLink>
    </div>
  );
}
