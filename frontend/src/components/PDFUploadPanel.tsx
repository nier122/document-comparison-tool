type PDFUploadPanelProps = {
  label: string;
};

function PDFUploadPanel({ label }: PDFUploadPanelProps) {
  return <input aria-label={label} type="file" accept=".pdf" />;
}

export default PDFUploadPanel;
