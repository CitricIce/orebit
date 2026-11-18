import type { Metadata } from "next";
import ArchiveList from "@/components/ArchiveList";

export const metadata: Metadata = { title: "Archive" };

export default function ArchivePage() {
  return <ArchiveList />;
}
