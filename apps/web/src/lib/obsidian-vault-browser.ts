const SKIP_DIRS = new Set(['.git', '.obsidian', '.trash', 'node_modules']);

type FileWithPath = File & { webkitRelativePath?: string };

function pickVaultFolder(): Promise<File[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.webkitdirectory = true;
    input.onchange = () => {
      if (!input.files?.length) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      resolve(Array.from(input.files));
    };
    input.oncancel = () => reject(new DOMException('Aborted', 'AbortError'));
    input.click();
  });
}

function vaultMarkdownFiles(picked: File[]): { files: File[]; label: string } {
  const md: File[] = [];
  let vaultName = 'vault';

  for (const file of picked) {
    const rel = (file as FileWithPath).webkitRelativePath || file.name;
    const parts = rel.split('/');
    if (parts.length > 1 && parts[0]) vaultName = parts[0];
    if (parts.some((p) => SKIP_DIRS.has(p))) continue;
    if (!rel.toLowerCase().endsWith('.md')) continue;
    const path = parts.length > 1 ? parts.slice(1).join('/') : rel;
    md.push(new File([file], path, { type: 'text/markdown', lastModified: file.lastModified }));
  }

  if (md.length === 0) {
    throw new Error('No notes found in that folder.');
  }
  return { files: md, label: `${vaultName} · ${md.length} notes` };
}

/** Pick the user's Obsidian vault folder and return its markdown notes. */
export async function connectObsidian(): Promise<{ files: File[]; label: string }> {
  const picked = await pickVaultFolder();
  return vaultMarkdownFiles(picked);
}
