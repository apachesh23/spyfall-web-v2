import { LobbyScreen } from "@/features/lobby";

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function LobbyPage({ params }: PageProps) {
  const { code } = await params;
  return <LobbyScreen code={code} />;
}
