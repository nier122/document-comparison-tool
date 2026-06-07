import type { ChangeEvent } from 'react';

type PDFUploadPanelProps = {
  label: string;
  onFileSelect: (file: File | null) => void;
};

function PDFUploadPanel({ label, onFileSelect }: PDFUploadPanelProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFileSelect(event.target.files?.[0] ?? null);
  }

  return <input aria-label={label} type="file" accept=".pdf" onChange={handleChange} />;
}

export default PDFUploadPanel;
