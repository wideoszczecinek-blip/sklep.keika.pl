import { Suspense } from "react";

import MoskitieryFlowEntry from "@/features/moskitiery/MoskitieryFlowEntry";

export default function MoskitieryEntryPage() {
  return (
    <Suspense fallback={<div style={{ padding: "24px" }}>Ładuję konfigurator...</div>}>
      <MoskitieryFlowEntry
        initialProductSlug="moskitiery-ramkowe"
        entryPath="/moskitiery"
      />
    </Suspense>
  );
}
