import { InviteRoomForm } from "@/features/entry";

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function InvitePage({ params }: PageProps) {
  const { code } = await params;
  return <InviteRoomForm urlCode={code} />;
}
