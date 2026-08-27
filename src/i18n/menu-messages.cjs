/* Native-menu strings for the Electron main process (CJS).
   Kept in sync with the renderer catalogs for dock.* and menu.* keys. */

const catalogs = {
  en: {
    'dock.bible': 'Bible',
    'dock.songs': 'Songs',
    'dock.presentation': 'Pro Slides',
    'dock.media': 'Media',
    'dock.output': 'Output',
    'dock.stage': 'Stage Display',
    'dock.live': 'Live Scripture',
    'dock.transcript': 'Live Transcript',
    'dock.queue': 'Queue',
    'dock.history': 'History',
    'dock.scenes': 'Scenes',
    'dock.themes': 'Themes',
    'menu.edit': 'Edit',
    'menu.view': 'View',
    'menu.dock': 'Dock',
    'menu.workspace': 'Workspace',
    'menu.window': 'Window',
    'menu.resetLayout': 'Reset Layout',
    'menu.defaultLayout': 'Default Layout',
    'menu.saveLayout': 'Save Layout…',
    'menu.saveAsLayout': 'Save as New Layout…',
    'menu.updateLayout': 'Update {name}',
    'menu.renameLayout': 'Rename {name}…',
    'menu.deleteLayout': 'Delete {name}',
    'menu.importWorkspace': 'Import Workspace…',
    'menu.exportLayout': 'Export {name}…',
    'menu.showLayoutsFolder': 'Show Layouts Folder',
  },
  fr: {
    'dock.bible': 'Bible',
    'dock.songs': 'Chants',
    'dock.presentation': 'Pro Slides',
    'dock.media': 'Médias',
    'dock.output': 'Sortie',
    'dock.stage': 'Écran scène',
    'dock.live': 'Écriture en direct',
    'dock.transcript': 'Transcription live',
    'dock.queue': 'File',
    'dock.history': 'Historique',
    'dock.scenes': 'Scènes',
    'dock.themes': 'Thèmes',
    'menu.edit': 'Édition',
    'menu.view': 'Affichage',
    'menu.dock': 'Dock',
    'menu.workspace': 'Espace de travail',
    'menu.window': 'Fenêtre',
    'menu.resetLayout': 'Réinitialiser la disposition',
    'menu.defaultLayout': 'Disposition par défaut',
    'menu.saveLayout': 'Enregistrer la disposition…',
    'menu.saveAsLayout': 'Enregistrer comme nouvelle…',
    'menu.updateLayout': 'Mettre à jour {name}',
    'menu.renameLayout': 'Renommer {name}…',
    'menu.deleteLayout': 'Supprimer {name}',
    'menu.importWorkspace': 'Importer un espace…',
    'menu.exportLayout': 'Exporter {name}…',
    'menu.showLayoutsFolder': 'Afficher le dossier des dispositions',
  },
  es: {
    'dock.bible': 'Biblia',
    'dock.songs': 'Canciones',
    'dock.presentation': 'Pro Slides',
    'dock.media': 'Medios',
    'dock.output': 'Salida',
    'dock.stage': 'Pantalla de escenario',
    'dock.live': 'Escritura en vivo',
    'dock.transcript': 'Transcripción en vivo',
    'dock.queue': 'Cola',
    'dock.history': 'Historial',
    'dock.scenes': 'Escenas',
    'dock.themes': 'Temas',
    'menu.edit': 'Editar',
    'menu.view': 'Ver',
    'menu.dock': 'Dock',
    'menu.workspace': 'Espacio de trabajo',
    'menu.window': 'Ventana',
    'menu.resetLayout': 'Restablecer disposición',
    'menu.defaultLayout': 'Disposición por defecto',
    'menu.saveLayout': 'Guardar disposición…',
    'menu.saveAsLayout': 'Guardar como nueva…',
    'menu.updateLayout': 'Actualizar {name}',
    'menu.renameLayout': 'Renombrar {name}…',
    'menu.deleteLayout': 'Eliminar {name}',
    'menu.importWorkspace': 'Importar espacio…',
    'menu.exportLayout': 'Exportar {name}…',
    'menu.showLayoutsFolder': 'Mostrar carpeta de disposiciones',
  },
  pt: {
    'dock.bible': 'Bíblia',
    'dock.songs': 'Cânticos',
    'dock.presentation': 'Pro Slides',
    'dock.media': 'Média',
    'dock.output': 'Saída',
    'dock.stage': 'Ecrã de palco',
    'dock.live': 'Escritura ao vivo',
    'dock.transcript': 'Transcrição ao vivo',
    'dock.queue': 'Fila',
    'dock.history': 'Histórico',
    'dock.scenes': 'Cenas',
    'dock.themes': 'Temas',
    'menu.edit': 'Editar',
    'menu.view': 'Ver',
    'menu.dock': 'Dock',
    'menu.workspace': 'Espaço de trabalho',
    'menu.window': 'Janela',
    'menu.resetLayout': 'Repor disposição',
    'menu.defaultLayout': 'Disposição predefinida',
    'menu.saveLayout': 'Guardar disposição…',
    'menu.saveAsLayout': 'Guardar como nova…',
    'menu.updateLayout': 'Atualizar {name}',
    'menu.renameLayout': 'Mudar nome de {name}…',
    'menu.deleteLayout': 'Eliminar {name}',
    'menu.importWorkspace': 'Importar espaço…',
    'menu.exportLayout': 'Exportar {name}…',
    'menu.showLayoutsFolder': 'Mostrar pasta de disposições',
  },
};

let locale = 'en';

function setMenuLocale(next) {
  locale = catalogs[next] ? next : 'en';
}

function mt(key, vars) {
  const catalog = catalogs[locale] || catalogs.en;
  let text = catalog[key] || catalogs.en[key] || key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }
  return text;
}

module.exports = { setMenuLocale, mt };
