import iconv from 'iconv-lite';
import { BrowserWindow } from 'electron';

function getStorageWindow() {
  return (
    BrowserWindow.getFocusedWindow() ||
    BrowserWindow.getAllWindows().find((window) => !window.isDestroyed())
  );
}

function getStorageItem(key: string) {
  return getStorageWindow()?.webContents.executeJavaScript(
    `localStorage.getItem("${key}");`,
    true,
  );
}

function setStorageItem(key: string, value: string) {
  return getStorageWindow()?.webContents.executeJavaScript(
    `localStorage.setItem("${key}", ${JSON.stringify(value)});`,
    true,
  );
}

async function setStoredEncoding(buffer: any) {
  const storedEncoding = await getStorageItem('encoding');
  return iconv.decode(
    buffer,
    storedEncoding ? storedEncoding.toLowerCase() : 'utf-8',
  );
}

function setEncoding(buffer: any, encoding: string) {
  return iconv.decode(buffer, encoding ? encoding.toLowerCase() : 'utf-8');
}

export default {
  setStoredEncoding,
  setEncoding,
  getStorageItem,
  setStorageItem,
};
