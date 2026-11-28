import { FitHeading } from "./fit-heading";

/**
 * The one page title used by every signed-in screen: heavy, sentence case, fixed size,
 * shrinking only when the measured text would overflow (see FitHeading).
 */
export function PageTitle({ text, id }: { text: string; id?: string }) {
  return (
    <FitHeading {...(id ? { id } : {})} text={text} className="page-title" requestedSize={36} />
  );
}
