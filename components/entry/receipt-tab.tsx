"use client";

import { useRef, useState, useTransition } from "react";
import imageCompression from "browser-image-compression";
import { Camera, Images, Receipt } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/field";
import { ConfirmCard, toDraft, type DraftTransaction } from "./confirm-card";
import { createClient } from "@/lib/supabase/client";
import type { CurrencyCode } from "@/lib/money";
import type { CategoryRow } from "@/lib/supabase/database.types";
import {
  createReceiptUpload,
  saveParsedTransactions,
} from "@/app/(app)/transactions/actions";

export function ReceiptTab({
  currency,
  categories,
  onSaved,
}: {
  currency: CurrencyCode;
  categories: CategoryRow[];
  onSaved: (message: string) => void;
}) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [drafts, setDrafts] = useState<DraftTransaction[] | null>(null);
  const [mediaAssetId, setMediaAssetId] = useState<string>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [isReading, startReading] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function pick(file: File | undefined) {
    if (!file) return;
    setError(undefined);

    startReading(async () => {
      try {
        setStatus("دارم عکس را کوچک می‌کنم…");
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: 1500,
          initialQuality: 0.8,
          maxSizeMB: 5,
          useWebWorker: true,
        });

        setStatus("دارم آپلود می‌کنم…");
        const target = await createReceiptUpload({
          mimeType: compressed.type,
          sizeBytes: compressed.size,
        });
        if ("error" in target) {
          setError(target.error);
          return;
        }

        // Straight to Storage with a one-time token: the image never passes
        // through a route handler, so the platform's body ceiling never applies.
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("receipts")
          .uploadToSignedUrl(target.path, target.token, compressed);

        if (uploadError) {
          setError("آپلود نشد. اینترنتت را چک کن و دوباره بزن.");
          return;
        }

        setStatus("دارم فاکتور را می‌خوانم…");
        const response = await fetch("/api/parse/receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaAssetId: target.mediaAssetId }),
        });
        const result = await response.json();

        if (!result.ok) {
          setError(result.error);
          return;
        }
        setMediaAssetId(target.mediaAssetId);
        setDrafts(result.transactions.map(toDraft));
      } catch {
        setError("عکس خوانده نشد. دوباره بگیرش یا مبلغ را دستی بزن.");
      } finally {
        setStatus(undefined);
      }
    });
  }

  function save() {
    if (!drafts) return;
    startSaving(async () => {
      const result = await saveParsedTransactions({
        source: "receipt",
        mediaAssetId,
        transactions: drafts.map((draft) => ({
          type: draft.type,
          amountMinor: draft.amount_minor,
          categorySlug: draft.category_slug,
          merchant: draft.merchant,
          note: draft.note,
          occurredOn: draft.occurred_on,
          confidence: draft.confidence,
          needsReview: draft.needs_review.filter(
            (field) => !draft.resolved.includes(field),
          ),
        })),
      });
      if ("error" in result) setError(result.error);
      else onSaved(`ثبت شد. ${result.balanceText} برایت مانده.`);
    });
  }

  if (drafts) {
    return (
      <div className="flex flex-col gap-3">
        <FormError>{error}</FormError>
        <ConfirmCard
          drafts={drafts}
          currency={currency}
          categories={categories}
          isPending={isSaving}
          onChange={(index, next) =>
            setDrafts(drafts.map((draft, i) => (i === index ? next : draft)))
          }
          onSubmit={save}
          onCancel={() => setDrafts(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormError>{error}</FormError>

      <div className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-hairline-strong bg-paper px-4 text-center">
        <Receipt size={28} className="text-ink-faint" />
        <p className="text-caption text-ink-muted">
          {status ?? "فقط مبلغ کل را برمی‌دارم، نه تک‌تک آیتم‌ها."}
        </p>
        {!status && (
          <p className="text-micro text-ink-faint">
            تا ۱۵۰۰ پیکسل و کیفیت ۸۰٪ فشرده می‌شود
          </p>
        )}
      </div>

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => pick(event.target.files?.[0])}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => pick(event.target.files?.[0])}
      />

      <div className="flex gap-2">
        <Button
          size="lg"
          className="flex-1"
          disabled={isReading}
          onClick={() => cameraInput.current?.click()}
        >
          <Camera size={18} />
          دوربین
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="flex-1"
          disabled={isReading}
          onClick={() => galleryInput.current?.click()}
        >
          <Images size={18} />
          از گالری
        </Button>
      </div>
    </div>
  );
}
