"use client";

// Live product preview of the roof blind: the chosen fabric (swatch photo,
// cover-fitted) showing through the transparent pane of the chosen
// cassette/rail render (preview_layer_url PNG from the CRM) - the same
// two-layer composite the Allegro configurator draws. Without a layer PNG
// (offline snapshot without one, or a CRM entry missing it) it falls back
// to the masked tint of the cassette photo used before.
import { optimizeImageUrl } from "@/lib/image-optim";
import { buildRdLayerSurfaceStyle, type FabricOption, type HardwareOption } from "./shared";

export default function RoofBlindPreview({
  hardware,
  fabric,
  className = "",
  size = 500,
}: {
  hardware: HardwareOption | null;
  fabric: FabricOption | null;
  className?: string;
  size?: number;
}) {
  const layerUrl = hardware?.previewLayerUrl || "";
  const fabricUrl = fabric?.imageUrl || "";
  return (
    <div
      className={`rd-preview ${className}`}
      role="img"
      aria-label={`Podgląd: kaseta ${hardware?.label || "—"}, tkanina ${fabric?.label || "—"}`}
    >
      {layerUrl ? (
        <>
          <div
            className="rd-preview-fabric"
            style={
              fabricUrl
                ? { backgroundImage: `url(${optimizeImageUrl(fabricUrl, 400)})` }
                : { background: `linear-gradient(180deg, ${fabric?.color || "#EDEAE3"} 0%, ${fabric?.color || "#E1DDD4"} 100%)` }
            }
          />
          <img className="rd-preview-hardware" src={optimizeImageUrl(layerUrl, size)} alt="" aria-hidden="true" draggable={false} />
        </>
      ) : hardware ? (
        <>
          <div className="mosk-preview-surface" style={buildRdLayerSurfaceStyle(hardware.imageUrl, hardware.color)} />
          <div className="mosk-preview-overlay" style={{ backgroundImage: `url(${optimizeImageUrl(hardware.imageUrl, size)})`, opacity: 0.42 }} />
        </>
      ) : null}
    </div>
  );
}
