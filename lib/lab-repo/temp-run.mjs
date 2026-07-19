import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function createTempRunDir() {
  const dir = path.join(os.tmpdir(), 'rplus-lab-repo', randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeTempPdf(dir, folio, buffer) {
  const file = path.join(dir, `${folio}.pdf`);
  fs.writeFileSync(file, buffer);
  return file;
}

export function deleteTempFile(file) {
  try {
    fs.unlinkSync(file);
  } catch {
    // Best-effort cleanup; ignore missing or locked files.
  }
}

export function deleteTempRunDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; ignore missing or locked dirs.
  }
}
