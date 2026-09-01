import iconv from 'iconv-lite';
import { BrowserWindow } from 'electron';

function getStorageItem(key: string) {
  return BrowserWindow.getFocusedWindow()?.webContents.executeJavaScript(
    `localStorage.getItem("${key}");`,
    true,
  );
}

function setStorageItem(key: string, value: string) {
  return BrowserWindow.getFocusedWindow()?.webContents.executeJavaScript(
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
