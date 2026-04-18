import SummaryLayoutClient from "./SummaryLayoutClient";

export default function SummaryLayout({ children }: { children: React.ReactNode }) {
  return <SummaryLayoutClient>{children}</SummaryLayoutClient>;
}
