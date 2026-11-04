import type { Metadata } from "next";
import WorldStudio from "@/components/world-studio/studio";
import "./studio.css";
export const metadata: Metadata = {
  title: "World Studio — Build together",
  description: "An interactive 3D space with an embodied Meta AI collaborator.",
};
export default function StudioPage() {
  return <WorldStudio />;
}
