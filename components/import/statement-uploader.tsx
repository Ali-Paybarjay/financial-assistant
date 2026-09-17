"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileArrowUp, FilePdf, FileCsv, Image as ImageIcon, X } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/native-select";
import { Field, FormError } from "@/components/field";
import { createClient } from "@/lib/supabase/client";
import { faNumber } from "@/lib/format";
import type { CurrencyCode } from "@/lib/money";
import {
  MAX_FILES_PER_IMPORT,
  mimeTypeFor,
} from "@/lib/import/limits";
import {
  createStatementUpload,
  startStatementImport,
} from "@/app/(app)/import/actions";

const CURRENCY_LABELS: Partial<Record<CurrencyCode, string>> = {
  IRT: "تومان",
  IRR: "ریال",
};

const ACCEPT = ".pdf,.csv,.txt,image/*";

/**
 * Picking the statement files and setting them going.
 *
 * Several files per import on purpose: a three-month statement arrives as
 * three monthly exports as often as one long file, and a photographed one
 * arrives a page at a time. They are reconciled together, as one period.
 */
export function StatementUploader({
  currency,
  sourceOptions,
}: {
  currency: CurrencyCode;
  sourceOptions: CurrencyCode[];
}) {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sourceCurrency, setSourceCurrency] = useState<CurrencyCode>(
    // An Iranian bank prints rial even when the account holder counts in
    // toman, so that is the better default when both are on offer.
    sourceOptions.includes("IRR") ? "IRR" : sourceOptions[0],
  );
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [isWorking, startWorking] = useTransition();

  function add(picked: FileList | null) {
    if (!picked || picked.length === 0) return;

    // Copied out before the input is cleared, not inside the state updater. A
    // FileList is a live view of the input, so emptying the input to let the
    // same file be chosen again would empty the list the updater is holding.
    const chosen = Array.from(picked);

    setError(undefined);
    setFiles((current) => [...current, ...chosen].slice(0, MAX_FILES_PER_IMPORT));
    if (picker.current) picker.current.value = "";
  }

  function run() {
    if (files.length === 0) return;

    startWorking(async () => {
      setError(undefined);
      setStatus("دارم شروع می‌کنم…");

      const opened = await startStatementImport({ sourceCurrency });
      if ("error" in opened) {
        setError(opened.error);
        setStatus(undefined);
        return;
      }

      const supabase = createClient();

      for (const [index, file] of files.entries()) {
        setStatus(`دارم فایل ${faNumber(index + 1)} از ${faNumber(files.length)} را می‌فرستم…`);

        const target = await createStatementUpload({
          importId: opened.importId,
          filename: file.name,
          mimeType: mimeTypeFor(file),
          sizeBytes: file.size,
        });

        if ("error" in target) {
          setError(target.error);
          setStatus(undefined);
          return;
        }

        const { error: uploadError } = await supabase.storage
          .from("statements")
          .uploadToSignedUrl(target.path, target.token, file);

        if (uploadError) {
          setError("آپلود نشد. اینترنتت را چک کن و دوباره بزن.");
          setStatus(undefined);
          return;
        }
      }

      setStatus("دارم صورت‌حساب را می‌خوانم. صورت‌حساب بلند تا دو دقیقه طول می‌کشد…");

      const response = await fetch("/api/import/statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId: opened.importId }),
      });
      const result = await response.json().catch(() => null);

      setStatus(undefined);

      if (!result?.ok) {
        setError(result?.error ?? "خواندن صورت‌حساب انجام نشد. دوباره بزن.");
        router.refresh();
        return;
      }

      setFiles([]);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <FormError>{error}</FormError>

      {sourceOptions.length > 1 && (
        <Field
          label="صورت‌حساب به چه واحدی نوشته شده؟"
          htmlFor="source-currency"
          hint={`مبالغ را به ${CURRENCY_LABELS[currency] ?? currency} تبدیل می‌کنم.`}
        >
          <NativeSelect
            id="source-currency"
            value={sourceCurrency}
            onChange={(event) => setSourceCurrency(event.target.value as CurrencyCode)}
          >
            {sourceOptions.map((option) => (
              <option key={option} value={option}>
                {CURRENCY_LABELS[option] ?? option}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}

      <div className="flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-hairline-strong bg-paper px-4 py-8 text-center">
        <FileArrowUp size={30} className="text-ink-faint" />
        <p className="text-caption text-ink-muted">
          {status ?? "پرینت حساب یک تا سه ماهه را بده."}
        </p>
        {!status && (
          <p className="text-micro text-ink-faint">
            PDF یا CSV بانک، یا عکس صفحه‌ها — تا {faNumber(MAX_FILES_PER_IMPORT)} فایل
          </p>
        )}
      </div>

      {files.length > 0 && (
        <ul className="overflow-hidden rounded-card border border-hairline">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2.5 border-b border-hairline px-3 py-2.5 last:border-b-0"
            >
              <FileIcon name={file.name} />
              <span className="min-w-0 flex-1 truncate text-caption text-ink">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, i) => i !== index))}
                aria-label={`حذف ${file.name}`}
                disabled={isWorking}
                className="text-ink-faint hover:text-negative"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={picker}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => add(event.target.files)}
      />

      <div className="flex gap-2">
        <Button
          size="lg"
          variant={files.length > 0 ? "outline" : "default"}
          className="flex-1"
          disabled={isWorking || files.length >= MAX_FILES_PER_IMPORT}
          onClick={() => picker.current?.click()}
        >
          {files.length > 0 ? "فایل دیگر" : "انتخاب فایل"}
        </Button>
        {files.length > 0 && (
          <Button size="lg" className="flex-1" disabled={isWorking} onClick={run}>
            {isWorking ? "صبر کن…" : "بخوان"}
          </Button>
        )}
      </div>

      <p className="text-micro text-ink-faint">
        فایل صورت‌حساب خصوصی می‌ماند و فقط برای خواندن همین ردیف‌ها استفاده می‌شود.
      </p>
    </div>
  );
}

function FileIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return <FilePdf size={18} className="text-ink-muted" />;
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return <FileCsv size={18} className="text-ink-muted" />;
  }
  return <ImageIcon size={18} className="text-ink-muted" />;
}
