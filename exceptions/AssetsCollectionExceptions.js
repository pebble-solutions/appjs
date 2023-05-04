/**
 * Erreur générée lorsque la clé demandée par AssetsCollection n'existe pas dans le state du store
 * 
 * @param {string} assetName
 */
export class UndefinedCollectionException {
    constructor(assetName) {
        this.name = 'UndefinedCollectionException';
        this.assetName = assetName;
        this.message = `Erreur de configuration dans l'initialisation de la collection de ressources : la clé [${assetName}] n'existe pas dans le store.`;
    }
}

export class UndefinedIdException {
    constructor() {
        this.name = 'UndefinedIdException';
        this.message = `Aucun ID de ressource n'est fournis.`;
    }
}