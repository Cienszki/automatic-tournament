
import { HomeBanner } from "@/components/app/home/HomeBanner";
import { InfoWidgets } from "@/components/app/home/InfoWidgets";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <HomeBanner />
      <InfoWidgets />
    </div>
  );
}
