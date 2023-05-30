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
     * - @param {string} resetAction Nom de l'action à déclencher dans le store pour vider la collection
     * - @param {object} requestPayload Paramètres passés en GET pour chaque requêtes
     * - @param {string} idParam Paramètre du payload transportant l'IDs ou la liste d'ID en cas de requête de liste
     * - @param {string} namespace Précise le namespace du store à utiliser pour le state
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
         * Paramètre du payload transportant l'ID ou la liste d'IDs en cas de requête de liste
         */
        this.idParam = options.idParam ?? 'id';

        /**
         * Précise le namespace du store à utiliser pour le state
         */
        this.namespace = options.namespace ?? null;

        /**
         * Raccourcis vers la collection
         */
        this.collection = this.namespace ? this.store.state[this.namespace][this.assetName] : this.store.state[this.assetName];

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
            if (!id) {
                throw new UndefinedIdException();
            }

            const found = this.collection.find(e => e.id == id);

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
     * Retourne la liste des ID de ressources qui ne sont pas encore chargées depuis l'API
     * 
     * @param {array} ids Liste des ID à tester
     * 
     * @returns {array}
     */
    listNotLoadedIds(ids) {
        let notLoadedIds = [];
        let checkedIds = [];

        ids.forEach(id => {
            if (!this.isLoaded(id) && !checkedIds.find(e => e == id) && id) {
                notLoadedIds.push(id);
            }
            checkedIds.push(id);
        });

        return notLoadedIds;
    }

    /**
     * Contrôle si l'ID d'une ressource a déjà été chargée depuis l'API
     * 
     * @param {number} id L'ID de la ressource à tester
     * 
     * @returns {bool}
     */
    isLoaded(id) {
        const found = this.collection.find(e => e.id == id);
        return found || this.isNotFound(id) ? true : false;
    }

    /**
     * Charge les informations depuis l'API
     * 
     * @param {object} payload Un payload additionnel à envoyer lors de la requête
     */
    async load(payload) {
        payload = typeof payload === 'undefined' ? {} : payload;

        let pl = this.requestPayload ?? {};
        pl = payload ? {...pl, ...payload} : pl;

        const idParam = this.idParam;

        if (pl[idParam]) {
            let ids = pl[idParam].split(",");
            pl[idParam] = this.listNotLoadedIds(ids).join(',');
            
            if (!pl[idParam]) return;
        }

        const data = await this.getFromApi(this.apiRoute, pl);

        if (payload[idParam]) {
            const ids = payload[idParam].split(",");
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


    /**
     * Ré-initialise la collection sur le store et sur le controller
     */
    reset() {
        this.notFoundIds = [];
        this.store.dispatch(this.resetAction);
    }
}