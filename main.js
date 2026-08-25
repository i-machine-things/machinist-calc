const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

const isMac = process.platform === 'darwin';
const iconPath = path.join(__dirname, 'build', isMac ? 'icon.icns' : (process.platform === 'win32' ? 'icon.ico' : 'icon.png'));

let mainWindow = null;

/**
 * Auto-download and prompt-to-restart on a background release check.
 * Errors are only logged here (not shown to the user) — this runs silently
 * on every launch, and a failed background check shouldn't interrupt work.
 * Manual checks (Help menu) get their own listeners with user-facing dialogs.
 */
function setupAutoUpdater() {
  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err);
  });
  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Machinist Calc ${info.version} has been downloaded.`,
      detail: 'Restart now to install the update?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) autoUpdater.quitAndInstall();
    });
  });
}

/** Manual "Check for Updates" — surfaces both the up-to-date and error cases, unlike the silent auto-check. */
function checkForUpdatesManually() {
  if (!app.isPackaged) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Check for Updates',
      message: 'Update checks are only available in packaged builds.'
    });
    return;
  }
  const onNotAvailable = () => { cleanup(); showUpToDate(); };
  const onError = (err) => { cleanup(); showCheckFailed(err); };
  function cleanup() {
    autoUpdater.removeListener('update-not-available', onNotAvailable);
    autoUpdater.removeListener('error', onError);
  }
  function showUpToDate() {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Up to Date',
      message: 'Machinist Calc is up to date.'
    });
  }
  function showCheckFailed(err) {
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Update Check Failed',
      message: `Could not check for updates:\n${err.message}`
    });
  }
  autoUpdater.once('update-not-available', onNotAvailable);
  autoUpdater.once('error', onError);
  autoUpdater.checkForUpdates();
}

function buildMenu() {
  const template = [];

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  template.push({
    label: 'File',
    submenu: [isMac ? { role: 'close' } : { role: 'quit' }]
  });

  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  });

  template.push({
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  });

  if (isMac) {
    template.push({
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }]
    });
  }

  template.push({
    label: 'Help',
    submenu: [
      {
        label: 'Check for Updates...',
        click: () => checkForUpdatesManually()
      },
      { type: 'separator' },
      {
        label: 'About Machinist Calc',
        click: () => shell.openExternal('https://theoreticalmachinist.com')
      }
    ]
  });

  return Menu.buildFromTemplate(template);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e1f24',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: iconPath
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildMenu());
  mainWindow = createWindow();
  setupAutoUpdater();
  if (app.isPackaged) {
    // Delay so the window is up and responsive before making any network call.
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 3000);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});
