import { EmptyState, LinkButton } from "@/components/ui";

export default function NotFound() {
  return <EmptyState title="Niet gevonden" description="Deze pagina of dit deck bestaat niet (meer)." action={<LinkButton href="/">Naar dashboard</LinkButton>} />;
}
