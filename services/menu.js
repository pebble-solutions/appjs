/**
 * Modifie ou ajout un élément du menu
 * 
 * @param {object} app Instance AppController
 * @param {object} menuItem L'élément de menu à modifier
 */
export function setMenuItem(app, menuItem) 
{
    if (typeof app.cfg.appMenu === 'undefined') {
        app.cfg.appMenu = [];
    }

    const menu = app.cfg.appMenu.find(e => e.key === menuItem.key);

    // Mise à jour du menu
    if (menu) {
        for (const key in menuItem) {
            menu[key] = menuItem[key];
        }
    }
    // Ajout du menu
    else {
        app.cfg.appMenu.push(menuItem);
    }

    app.dispatchEvent("appMenuUpdated", app.cfg.appMenu);
}

/**
 * Retire un élément du menu par sa clé.
 * 
 * @param {object} app Instance AppController
 * @param {string} key Clé de l'élément de menu à retirer
 */
export function removeFromMenu(app, key) 
{
    const index = app.cfg.appMenu.findIndex(e => e.key === key);

    if (index !== -1) {
        app.cfg.appMenu.splice(index, 1);
        app.dispatchEvent("appMenuUpdated", app.cfg.appMenu);
    }
}