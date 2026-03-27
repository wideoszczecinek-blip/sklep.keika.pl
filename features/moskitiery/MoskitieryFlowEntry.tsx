"use client";

import { useSearchParams } from "next/navigation";

import MoskitieryFlow from "./MoskitieryFlow";

type MoskitieryFlowEntryProps = {
  initialProductSlug?: string;
  entryPath?: string;
};

export default function MoskitieryFlowEntry({
  initialProductSlug = "",
  entryPath = "",
}: MoskitieryFlowEntryProps) {
  const searchParams = useSearchParams();
  const productFromQuery = searchParams.get("product") ?? "";

  return (
    <MoskitieryFlow
      initialQuoteCode={searchParams.get("quote_code") ?? ""}
      initialResumeToken={searchParams.get("resume_token") ?? ""}
      initialProductSlug={productFromQuery || initialProductSlug}
      entryPath={entryPath}
    />
  );
}
