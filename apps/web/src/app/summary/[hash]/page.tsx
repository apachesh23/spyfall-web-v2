import { SummaryPageContent } from "@/features/summary/SummaryPageContent";
import { loadMatchHistoryByShareHash } from "@/lib/matchHistory/loadMatchHistory";

type PageProps = {
  params: Promise<{ hash: string }>;
  searchParams: Promise<{ room?: string }>;
};

export default async function SummaryPage({ params, searchParams }: PageProps) {
  const { hash } = await params;
  const { room: roomCode } = await searchParams;
  const { row, error } = await loadMatchHistoryByShareHash(hash);
  if (error || !row) {
    return <SummaryPageContent notFound roomCode={roomCode} />;
  }
  const lobbyCode = roomCode ?? row.lobby_room_code ?? undefined;
  return <SummaryPageContent data={row} roomCode={lobbyCode} />;
}
