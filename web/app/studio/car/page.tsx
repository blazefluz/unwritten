import type { Metadata } from "next";
import CarStudio from "@/components/world-studio/car-studio";
import "../studio.css";
import "./car.css";
export const metadata: Metadata = {
  title: "Car Design — World Studio",
  description:
    "Shape a concept car with editable dimensions and a Meta AI collaborator.",
};
export default function CarPage() {
  return <CarStudio />;
}
