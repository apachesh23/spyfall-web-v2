import { MatchScreen } from "@/features/match";
import { getPublicColyseusUrl } from "@/lib/env";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function PlayPage({ params }: PageProps) {
  const { sessionId } = await params;
  return (
    <MatchScreen sessionId={sessionId} colyseusUrl={getPublicColyseusUrl()} />
  );
}
