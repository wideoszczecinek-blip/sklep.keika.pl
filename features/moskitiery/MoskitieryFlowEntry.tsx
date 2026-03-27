"use client";

import { useSearchParams } from "next/navigation";

import MoskitieryFlow from "./MoskitieryFlow";

type MoskitieryFlowEntryProps = {
  initialProductSlug?: string;
};

export default function MoskitieryFlowEntry({
  initialProductSlug = "",
}: MoskitieryFlowEntryProps) {
  const searchParams = useSearchParams();

  return (
    <MoskitieryFlow
      initialQuoteCode={searchParams.get("quote_code") ?? ""}
      initialResumeToken={searchParams.get("resume_token") ?? ""}
      initialProductSlug={initialProductSlug}
    />
  );
}
