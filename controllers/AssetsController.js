import { AssetsCollectionUndefinedException } from "../exceptions/AssetsExceptions";

export class AssetsController {

    constructor() {
        this.collections = {};
    }

    /**
     * Ajoute une nouvelle collection de ressource dans la liste des ressources disponibles sur le contrôleur.
     * 
     * @param {string} name Nom de la collection de ressources
     * @param {object} collectionController Instance de la collection de ressource
     */
    addCollection(name, collectionController) {
        collectionController.reset();
        this.collections[name] = collectionController;
    }

    /**
     * Charge une collection de données et l'ajoute au contrôleur.
     * 
     * @param {string} name Nom de la collection de ressources
     * @param {object} collectionController Instance de la collection de ressource
     * 
     * @return {Promise}
     */
    async import(name, collectionController) {
        collectionController.reset();
        await collectionController.load();
        this.addCollection(name, collectionController);
    }

    /**
     * Retourne une collection du contrôleur.
     * 
     * @param {string} name Le nom de la collection à retourner
     * 
     * @return {object}
     */
    getCollection(name) {
        if (typeof this.collections[name] === 'undefined') {
            throw new AssetsCollectionUndefinedException(name);
        }

        return this.collections[name];
    }

}