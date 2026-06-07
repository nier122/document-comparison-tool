import PDFUploadPanel from './PDFUploadPanel';

type PDFViewerProps = {
  title: string;
};

function PDFViewer({ title }: PDFViewerProps) {
  return (
    <section
      style={{
        flex: 1,
        border: '1px solid #ccc',
        padding: '16px',
      }}
    >
      <h2>{title}</h2>
      <PDFUploadPanel label={`${title} upload`} />
    </section>
  );
}

export default PDFViewer;
