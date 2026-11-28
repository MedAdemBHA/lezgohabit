import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@/lib/i18n";
import { proofSize } from "@/lib/proof-image";

const upload = vi.fn();
const clean = new Blob(["clean-jpeg"], { type: "image/jpeg" });
vi.mock("@/lib/proof-image", async (orig) => ({
  ...(await orig<typeof import("@/lib/proof-image")>()),
  compressProof: vi.fn(async () => clean),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ upload, remove: vi.fn(), createSignedUrl: vi.fn() }) },
    rpc: vi.fn(async () => ({ error: null })),
  },
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn(async () => ({})) }));
vi.mock("@/lib/admin.functions", () => ({ fingerprintProof: {} }));

import { ProofCompose } from "@/components/lezgo/today/proof-compose";
import { compressProof } from "@/lib/proof-image";

beforeEach(() => {
  upload.mockReset().mockResolvedValue({ error: null });
  globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe("proof photos never keep their original metadata", () => {
  it("Today proof uploads the re-encoded JPEG, not the original file", async () => {
    // A JPEG whose bytes include an EXIF GPS block.
    const original = new File(["\xFF\xD8\xFF\xE1Exif\0\0GPSLatitude"], "p.png", {
      type: "image/png",
    });
    const { container } = render(
      <ProofCompose
        uid="u1"
        seasonId="s1"
        day="2026-11-28"
        existingPath={null}
        onSaved={async () => {}}
      />,
    );
    fireEvent.change(container.querySelector("input[type=file]")!, {
      target: { files: [original] },
    });
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(upload).toHaveBeenCalled());
    const [path, body, options] = upload.mock.calls[0]!;
    expect(compressProof).toHaveBeenCalledWith(original);
    expect(body).toBe(clean);
    expect(body).not.toBe(original);
    expect(path).toMatch(/^u1\/2026-11-28\/[0-9a-f-]+\.jpg$/);
    expect(options).toEqual({ contentType: "image/jpeg" });
  });

  it("caps the longest edge at 1280px and never upscales", () => {
    expect(proofSize(4032, 3024)).toEqual({ width: 1280, height: 960 });
    expect(proofSize(3024, 4032)).toEqual({ width: 960, height: 1280 });
    expect(proofSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
