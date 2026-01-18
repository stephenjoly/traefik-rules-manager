import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function atomicWrite(filePath, content) {
  const dir = path.dirname(filePath);
  try {
    await ensureDir(dir);
    const tempPath = path.join(dir, `.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    await fs.writeFile(tempPath, content, 'utf8');
    await fs.rename(tempPath, filePath);
  } catch (err) {
    // As a last resort, ensure the directory exists and write directly without temp.
    await ensureDir(dir);
    await fs.writeFile(filePath, content, 'utf8');
  }
}

export async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export async function writeJson(filePath, data) {
  const content = `${JSON.stringify(data, null, 2)}\n`;
  await atomicWrite(filePath, content);
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listYamlFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => name.endsWith('.yaml') || name.endsWith('.yml'))
    .map(name => path.join(dirPath, name));
}

export async function copyFileSafe(source, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(source, dest);
}

export async function removeFileSafe(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

export async function statSafe(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}
