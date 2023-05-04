/**
 * Erreur générée lorsque le nom de la collection est déjà utilisée dans le controller d'assets
 * 
 * @param {string} collectionName
 */
export class CollectionNameUsedException {
    constructor(collectionName) {
        this.name = 'CollectionNameUsedException';
        this.collectionName = collectionName;
        this.message = `La collection [${collectionName}] existe déjà dans le contrôleur d'assets.`;
    }
}

/**
 * Erreur générer lorsque la collection appelée n'existe pas dans le contrôleur d'assets
 */
export class AssetsCollectionUndefinedException {
    constructor(collectionName) {
        this.name = 'CollectionNameUsedException';
        this.collectionName = collectionName;
        this.message = `La collection [${collectionName}] n'existe pas dans le contrôleur d'assets.`;
    }
}