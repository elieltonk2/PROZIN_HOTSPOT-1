const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "PROZIN_HOTSPOT - Gerenciador Mikrotik",
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Em produção, ele abre o link do seu app na nuvem
  // Assim o app fica leve e sempre atualizado
  win.loadURL('https://ais-pre-ajf6ybijypsxszat3iwnxc-253992139945.us-east1.run.app');
  
  // Remove o menu superior para parecer um app nativo
  win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
