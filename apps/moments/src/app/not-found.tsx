import { ButtonLink, ChaiCup } from '@chai/ui';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-4 pt-16 sm:px-8">
      <ChaiCup className="h-20 w-auto" steam={false} />
      <h1 className="font-display text-fg text-[clamp(2.4rem,9vw,4.5rem)] leading-[0.92] font-black tracking-tight">
        Nothing here.
      </h1>
      <ButtonLink href="/">Share photos</ButtonLink>
    </div>
  );
}
