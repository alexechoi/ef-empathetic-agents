import type { Moment } from "@/lib/moments";

import { MomentCard } from "./moment-card";

export function MomentFeed({ moments }: { moments: Moment[] }) {
  return (
    <div className="flex flex-col gap-4">
      {moments.map((moment) => (
        <MomentCard key={moment.id} moment={moment} />
      ))}
    </div>
  );
}
