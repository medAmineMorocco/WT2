import iconv from 'iconv-lite';
import { BrowserWindow } from 'electron';

function getStorageItem(key: string) {
  return BrowserWindow.getFocusedWindow()?.webContents.executeJavaScript(
    `localStorage.getItem("${key}");`,
    true,
  );
}

async function setEncoding(buffer: any) {
  const storedEncoding = await getStorageItem('encoding');
  return iconv.decode(buffer, storedEncoding.toLowerCase() || 'utf-8');
}

export default {
  setEncoding,
  getStorageItem,
};
