import Link from "next/link";
import { CarFront, Store } from "lucide-react";
export default function SceneSwitch({
  current,
}: {
  current: "market" | "car";
}) {
  return (
    <nav className="ws-scene-switch" aria-label="Studio scene">
      <Link
        href="/studio"
        aria-current={current === "market" ? "page" : undefined}
      >
        <Store size={15} />
        Market
      </Link>
      <Link
        href="/studio/car"
        aria-current={current === "car" ? "page" : undefined}
      >
        <CarFront size={16} />
        Car design
      </Link>
    </nav>
  );
}
