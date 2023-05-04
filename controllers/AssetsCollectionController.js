import { UndefinedCollectionException, UndefinedIdException } from "../exceptions/AssetsCollectionExceptions";

export class AssetsCollectionController {

    /**
     * Initialise le controller
     * 
     * @param {object} app Instance de l'application VueJS
     * @param {object} options 
     * - @param {string} assetName Clé de la collection cible dans le state du store
     * - @param {string} apiRoute Nom de la route d'API à contacter pour récupérer une ressource
     * - @param {string} updateAction Nom de l'action à déclencher dans le store pour mettre à jour la collection
     * - @param {object} requestPayload Paramètres passés en GET pour chaque requêtes
     */
    constructor(app, options) {
        /**
         * L'ensemble de l'instance de l'application VueJS
         */
        this.app = app;

        /**
         * Raccourcis vers l'instance du store VueX
         */
        this.store = app.$store;

        /**
         * Raccourcis vers l'instance de l'API
         */
        this.api = app.$app.api;

        /**
         * Clé de la collection cible dans le store
         */
        this.assetName = options.assetName;

        /**
         * Route d'API à contacter pour récupérer les informations
         */
        this.apiRoute = options.apiRoute;

        /**
         * Nom de l'action à déclencher dans le store pour mettre à jour la collection
         */
        this.updateAction = options.updateAction;

        /**
         * Paramètres passés en GET pour chaque requête à l'API
         */
        this.requestPayload = options.requestPayload;

        /**
         * Raccourcis vers la collection
         */
        this.collection = this.store.state[this.assetName];

        if (typeof this.collection === 'undefined') {
            throw new UndefinedCollectionException(this.assetName);
        }

        this.notFoundIds = [];
    }

    /**
     * Récupère une ressource avec son ID.
     * 
     * @param {number} id ID de la ressource à trouver
     * @param {object} options 
     * - @param {bool} bypass_not_found_cache (Défaut : false). Ignorer le cache pour les valeurs non-trouvées
     */
    getById(id, options) {

        options = typeof options === 'undefined' ? {} : options;

        return new Promise((resolve) => {
            const found = this.collection.find(e => e.id == id);

            if (!id) {
                throw new UndefinedIdException();
            }

            if (found) {
                this.removeFromNotFound(found.id);
                resolve(found);
            }

            else {
                if (this.isNotFound(id) && !options.bypass_not_found_cache) {
                    console.warn("La ressource n'existe pas sur l'API");
                    resolve(null);
                }
                else {
                    return this.getFromApi(this.apiRoute+'/'+id, this.requestPayload)
                    .then(data => {
                        if (data) {
                            this.removeFromNotFound(id);
                        }
                        else {
                            this.addToNotFound(id);
                        }
                        this.store.dispatch(this.updateAction, [data]);
                        resolve(data);
                    });
                }
            }
        })
    }

    /**
     * Retire un ID des éléments non-trouvés
     * 
     * @param {number} id ID de l'élément à retirer des non-trouvés
     */
    removeFromNotFound(id) {
        const index = this.notFoundIds.findIndex(e => e == id);

        if (index !== -1) {
            this.notFoundIds.splice(index, 1);
        }
    }

    /**
     * Ajoute un ID dans les éléments non-trouvés
     * 
     * @param {number} id ID de l'élément à ajouter dans les non-trouvés
     */
    addToNotFound(id) {
        const index = this.notFoundIds.findIndex(e => e == id);

        if (index === -1) {
            this.notFoundIds.push(id);
        }
    }

    /**
     * Teste si un élément se trouve dans les non-trouvés
     * 
     * @param {number} id ID de l'élément à tester
     * 
     * @return {bool}
     */
    isNotFound(id) {
        const index = this.notFoundIds.findIndex(e => e == id);
        return index !== -1;
    }

    /**
     * Charge les informations depuis l'API
     * 
     * @param {object} payload Un payload additionnel à envoyer lors de la requête
     */
    async load(payload) {
        let pl = this.requestPayload ?? {};
        pl = payload ? {...pl, ...payload} : pl;

        const data = await this.getFromApi(this.apiRoute, pl);

        if (payload?.id) {
            const ids = payload.id.split(",");
            this.checkForNotFound(ids, data);
        }

        this.store.dispatch(this.updateAction, data);
    }

    /**
     * Met à jour les ids non trouvés depuis une liste d'ids et de résultats
     * 
     * @param {array} requestIds Liste des ids passés lors de la requête
     * @param {array} responseData Collection retournée par la requête
     */
    checkForNotFound(requestIds, responseData) {
        requestIds.forEach(id => {
            const found = responseData.find(e => e.id === id);

            if (found) {
                this.removeFromNotFound(id);
            }
            else {
                this.addToNotFound(id);

            }
        });
    }

    /**
     * Récupère des informations depuis l'API
     * 
     * @param {string} route Nom de la route d'API à contacter
     * @param {object} payload Payload à passer sur la requête
     * 
     * @returns {Promise}
     */
    async getFromApi(route, payload) {
        const data = await this.api.get(route, payload);
        return data;
    }

}