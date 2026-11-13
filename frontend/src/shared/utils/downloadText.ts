/**
 * Offers `content` to the visitor as a plain-text file download, built
 * entirely in the browser (nothing is sent to the server).
 */
export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick: some browsers start the download asynchronously.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
