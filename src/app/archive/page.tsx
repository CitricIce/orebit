import type { Metadata } from "next";
import ArchiveList from "@/components/ArchiveList";

export const metadata: Metadata = { title: "Archive", alternates: { canonical: "/archive" } };

export default function ArchivePage() {
  return <ArchiveList />;
}
