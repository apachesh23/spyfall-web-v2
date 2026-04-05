import { EntryShellLayout } from "@/features/entry";

export default function EntryRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EntryShellLayout>{children}</EntryShellLayout>;
}
